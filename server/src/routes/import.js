const Router = require('@koa/router');
const multer = require('@koa/multer');
const ExcelJS = require('exceljs');
const { ok, fail } = require('../middlewares/error');
const { requireRole } = require('../middlewares/auth');
const caseService = require('../services/caseService');
const { writeLog } = require('../utils/log');

const router = new Router({ prefix: '/api/import' });
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// Excel 模板列头 -> 字段映射
const HEADER_MAP = {
  '就诊日期': 'visit_date', '患者姓名': 'patient_name', '性别': 'gender', '年龄': 'age',
  '联系电话': 'phone', '主诉': 'chief_complaint', '中医诊断': 'tcm_diagnosis',
  '西医诊断': 'western_diagnosis', '证型': 'syndrome', '治法': 'treatment_principle',
  '方剂': 'formula_name', '剂数': 'doses', '用法用量': 'usage_text', '医嘱': 'advice',
  '疗效': 'outcome', '医师': 'doctor_name', '按语': 'commentary', '备注': 'remark',
  '处方': '_prescription',
};

function parseDateCell(v) {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim().replace(/[年月.\/]/g, '-').replace(/日/g, '');
  const m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : null;
}

router.post('/', requireRole('admin', 'doctor'), upload.single('file'), async (ctx) => {
  if (!ctx.file) return fail(ctx, 400, '未接收到文件');
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(ctx.file.buffer);
  } catch {
    return fail(ctx, 400, '文件解析失败，请上传有效的 .xlsx 文件');
  }
  const ws = wb.worksheets[0];
  if (!ws || ws.rowCount < 2) return fail(ctx, 400, '表格为空或缺少数据行');

  const headers = [];
  ws.getRow(1).eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col] = HEADER_MAP[String(cell.value || '').trim()] || null;
  });

  const results = { success: 0, failed: [] };
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const body = { source: '批量导入' };
    let rx = null;
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const field = headers[col];
      if (!field) return;
      const value = typeof cell.value === 'object' && cell.value !== null && cell.value.text
        ? String(cell.value.text) : cell.value;
      if (field === '_prescription') { rx = value; return; }
      body[field] = field === 'visit_date' ? parseDateCell(value) : (value === null || value === undefined ? null : String(value).trim());
    });
    if (!body.patient_name || !body.visit_date) {
      results.failed.push({ row: r, reason: '缺少必填字段（患者姓名/就诊日期）' });
      continue;
    }
    // 处方列解析："黄芪10g、当归15g" 形式
    if (rx) {
      body.items = String(rx).split(/[、，,;；\n]/).map((s) => s.trim()).filter(Boolean).map((s) => {
        const m = s.match(/^(.+?)\s*(\d+(?:\.\d+)?)\s*(g|克|钱)?(.*)$/);
        return m ? { herb_name: m[1], dosage: m[2] ? `${m[2]}${m[3] === '克' ? 'g' : (m[3] || 'g')}` : null, note: m[4] || null } : { herb_name: s };
      });
    }
    try {
      caseService.createCase(body, ctx.state.user.id);
      results.success++;
    } catch (err) {
      results.failed.push({ row: r, reason: err.message });
    }
  }
  writeLog(ctx.state.user.id, 'import', 'medical_case', null, results);
  ok(ctx, results, `导入完成：成功 ${results.success} 条，失败 ${results.failed.length} 条`);
});

module.exports = router;
