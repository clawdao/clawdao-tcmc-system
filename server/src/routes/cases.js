const fs = require('fs');
const path = require('path');
const Router = require('@koa/router');
const multer = require('@koa/multer');
const ExcelJS = require('exceljs');
const db = require('../models/db');
const config = require('../config');
const { ok, fail } = require('../middlewares/error');
const { requireRole } = require('../middlewares/auth');
const caseService = require('../services/caseService');
const ocrService = require('../services/ocr/ocrService');
const { writeLog } = require('../utils/log');
const { maskCase, maskName, maskPhone } = require('../utils/mask');

const router = new Router({ prefix: '/api/cases' });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, config.uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: config.upload.maxSize },
  fileFilter: (req, file, cb) => {
    if (!config.upload.allowedTypes.includes(file.mimetype)) {
      return cb(new Error('仅支持 jpg / png / webp 图片'));
    }
    cb(null, true);
  },
});

// 列表（组合检索）
router.get('/', async (ctx) => {
  const { total, page, pageSize, rows } = caseService.listCases(ctx.query);
  // 医生和管理员可看明文患者姓名；readonly 脱敏。电话统一脱敏
  const role = ctx.state.user.role;
  const data = rows.map((r) => (role === 'readonly' ? maskCase(r) : { ...r, phone: maskPhone(r.phone) }));
  ok(ctx, { total, page, pageSize, list: data });
});

// 上传图片 + OCR 识别 + 结构化解析
router.post('/upload-image', requireRole('admin', 'doctor'), upload.single('image'), async (ctx) => {
  if (!ctx.file) return fail(ctx, 400, '未接收到图片文件');
  const imageRelPath = path.basename(ctx.file.path);
  let ocrText = null;
  let draft = {};
  let ocrStatus = '已识别';
  try {
    const result = await ocrService.recognizeAndParse(ctx.file.path);
    ocrText = result.ocrText;
    draft = result.draft;
  } catch (err) {
    ocrStatus = '识别失败';
    console.error('[OCR 识别失败]', err.message);
  }
  const info = db.prepare('INSERT INTO case_images (image_path, ocr_text, ocr_status) VALUES (?, ?, ?)')
    .run(imageRelPath, ocrText, ocrStatus);
  ok(ctx, {
    imageId: info.lastInsertRowid,
    imagePath: imageRelPath,
    ocrText,
    ocrStatus,
    draft,
  }, ocrStatus === '识别失败' ? '图片已保存，OCR 识别失败，请手工录入' : '识别完成，请校对后提交');
});

// 详情
router.get('/:id(\\d+)', async (ctx) => {
  const row = caseService.getCase(Number(ctx.params.id));
  if (!row) return fail(ctx, 404, '医案不存在');
  if (ctx.state.user.role === 'readonly') {
    row.patient_name = maskName(row.patient_name);
    row.phone = maskPhone(row.phone);
  }
  // 同患者历史医案（复诊时间轴）
  row.related = db.prepare(
    "SELECT id, case_no, visit_date, case_type, tcm_diagnosis, outcome FROM medical_cases WHERE patient_name = ? AND id != ? AND status != '已归档' ORDER BY visit_date DESC"
  ).all(row.patient_name, row.id);
  ok(ctx, row);
});

// 新建
router.post('/', requireRole('admin', 'doctor'), async (ctx) => {
  const body = ctx.request.body || {};
  if (!body.patient_name || !body.visit_date) return fail(ctx, 400, '患者姓名和就诊日期为必填项');
  const id = caseService.createCase(body, ctx.state.user.id);
  ok(ctx, caseService.getCase(id), '医案创建成功');
});

// 更新（本人或 admin）
router.put('/:id(\\d+)', requireRole('admin', 'doctor'), async (ctx) => {
  const id = Number(ctx.params.id);
  const row = db.prepare('SELECT created_by FROM medical_cases WHERE id = ?').get(id);
  if (!row) return fail(ctx, 404, '医案不存在');
  if (ctx.state.user.role !== 'admin' && row.created_by !== ctx.state.user.id) {
    return fail(ctx, 403, '只能编辑本人创建的医案');
  }
  caseService.updateCase(id, ctx.request.body || {}, ctx.state.user.id);
  ok(ctx, caseService.getCase(id), '医案更新成功');
});

// 删除：默认软删除；?hard=true 且 admin 时物理删除
router.delete('/:id(\\d+)', requireRole('admin', 'doctor'), async (ctx) => {
  const id = Number(ctx.params.id);
  const row = db.prepare('SELECT id FROM medical_cases WHERE id = ?').get(id);
  if (!row) return fail(ctx, 404, '医案不存在');
  if (ctx.query.hard === 'true') {
    if (ctx.state.user.role !== 'admin') return fail(ctx, 403, '物理删除需要管理员权限');
    caseService.hardDeleteCase(id, ctx.state.user.id);
  } else {
    caseService.softDeleteCase(id, ctx.state.user.id);
  }
  ok(ctx, null, '医案已删除');
});

// 导出筛选结果为 Excel / CSV（患者信息默认脱敏）
router.get('/export', requireRole('admin', 'doctor'), async (ctx) => {
  const { rows } = caseService.listCases({ ...ctx.query, page: 1, pageSize: 10000 });
  const masked = rows.map(maskCase);
  writeLog(ctx.state.user.id, 'export', 'medical_case', null, { count: rows.length, query: ctx.query });
  const columns = [
    ['case_no', '医案编号'], ['visit_date', '就诊日期'], ['patient_name', '患者姓名'],
    ['gender', '性别'], ['age', '年龄'], ['tcm_diagnosis', '中医诊断'],
    ['western_diagnosis', '西医诊断'], ['syndrome', '证型'], ['treatment_principle', '治法'],
    ['formula_name', '方剂'], ['doses', '剂数'], ['outcome', '疗效'], ['doctor_name', '医师'],
    ['chief_complaint', '主诉'],
  ];
  if (ctx.query.format === 'csv') {
    const header = columns.map(([, label]) => label).join(',');
    const lines = masked.map((r) =>
      columns.map(([k]) => `"${String(r[k] ?? '').replace(/"/g, '""')}"`).join(','));
    ctx.set('Content-Type', 'text/csv; charset=utf-8');
    ctx.set('Content-Disposition', 'attachment; filename="cases.csv"');
    ctx.body = '﻿' + [header, ...lines].join('\n');
    return;
  }
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('医案');
  ws.columns = columns.map(([key, label]) => ({ header: label, key, width: 16 }));
  masked.forEach((r) => ws.addRow(r));
  ctx.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  ctx.set('Content-Disposition', 'attachment; filename="cases.xlsx"');
  ctx.body = await wb.xlsx.writeBuffer();
});

// 单条医案导出 JSON
router.get('/:id(\\d+)/export-json', requireRole('admin', 'doctor'), async (ctx) => {
  const row = caseService.getCase(Number(ctx.params.id));
  if (!row) return fail(ctx, 404, '医案不存在');
  writeLog(ctx.state.user.id, 'export', 'medical_case', row.id, { format: 'json' });
  ctx.set('Content-Type', 'application/json; charset=utf-8');
  ctx.set('Content-Disposition', `attachment; filename="${row.case_no}.json"`);
  ctx.body = maskCase(row);
});

module.exports = router;
