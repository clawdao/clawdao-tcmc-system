const db = require('../models/db');
const { WRITABLE_FIELDS, TEXT_FIELDS, NUMBER_FIELDS } = require('../config/caseFields');
const { maskCase } = require('../utils/mask');
const { writeLog } = require('../utils/log');

// 生成医案编号：YA + 日期 + 三位序号
function genCaseNo() {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `YA${day}`;
  const row = db.prepare('SELECT case_no FROM medical_cases WHERE case_no LIKE ? ORDER BY case_no DESC LIMIT 1')
    .get(`${prefix}%`);
  const seq = row ? Number(row.case_no.slice(-3)) + 1 : 1;
  return prefix + String(seq).padStart(3, '0');
}

// 从请求体中提取可写字段并做类型规整
function pickFields(body) {
  const data = {};
  for (const f of WRITABLE_FIELDS) {
    if (body[f] === undefined) continue;
    if (NUMBER_FIELDS.includes(f)) {
      data[f] = body[f] === null || body[f] === '' ? null : Number(body[f]);
    } else if (TEXT_FIELDS.includes(f)) {
      data[f] = body[f] === null ? null : String(body[f]);
    } else {
      data[f] = body[f];
    }
  }
  return data;
}

function insertItems(caseId, items) {
  if (!Array.isArray(items)) return;
  const stmt = db.prepare(
    'INSERT INTO prescription_items (case_id, herb_name, dosage, note, sort_order) VALUES (?, ?, ?, ?, ?)'
  );
  items.forEach((it, i) => {
    if (!it || !it.herb_name) return;
    stmt.run(caseId, String(it.herb_name).trim(), it.dosage || null, it.note || null, i);
  });
}

function insertFollowUps(caseId, followUps) {
  if (!Array.isArray(followUps)) return;
  const stmt = db.prepare('INSERT INTO follow_ups (case_id, follow_date, content, outcome) VALUES (?, ?, ?, ?)');
  for (const f of followUps) {
    if (!f || !f.follow_date) continue;
    stmt.run(caseId, f.follow_date, f.content || null, f.outcome || null);
  }
}

// 事务函数惰性创建：备份恢复会重开连接，缓存的事务需随之重建
let _createTx = null;
let _updateTx = null;
db.onReopen(() => { _createTx = null; _updateTx = null; });

function createCase(body, userId) {
  if (!_createTx) _createTx = db.transaction(createCaseTx);
  return _createTx(body, userId);
}

function updateCase(id, body, userId) {
  if (!_updateTx) _updateTx = db.transaction(updateCaseTx);
  return _updateTx(id, body, userId);
}

function createCaseTx(body, userId) {
  const data = pickFields(body);
  const caseNo = genCaseNo();
  const cols = ['case_no', ...Object.keys(data), 'status', 'created_by'];
  const placeholders = cols.map(() => '?').join(', ');
  const values = [caseNo, ...Object.values(data), body.status || '正常', userId];
  const info = db.prepare(`INSERT INTO medical_cases (${cols.join(', ')}) VALUES (${placeholders})`).run(...values);
  const caseId = info.lastInsertRowid;
  insertItems(caseId, body.items);
  insertFollowUps(caseId, body.follow_ups);
  if (Array.isArray(body.image_ids) && body.image_ids.length) {
    const link = db.prepare('UPDATE case_images SET case_id = ?, ocr_status = ? WHERE id = ?');
    for (const imgId of body.image_ids) link.run(caseId, '已校对', imgId);
  }
  writeLog(userId, 'create', 'medical_case', caseId, { caseNo, patient: data.patient_name });
  return caseId;
}

function updateCaseTx(id, body, userId) {
  const data = pickFields(body);
  const keys = Object.keys(data);
  if (keys.length) {
    const sets = keys.map((k) => `${k} = ?`).join(', ');
    db.prepare(`UPDATE medical_cases SET ${sets}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .run(...keys.map((k) => data[k]), id);
  } else {
    db.prepare('UPDATE medical_cases SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(id);
  }
  if (body.status) db.prepare('UPDATE medical_cases SET status = ? WHERE id = ?').run(body.status, id);
  if (Array.isArray(body.items)) {
    db.prepare('DELETE FROM prescription_items WHERE case_id = ?').run(id);
    insertItems(id, body.items);
  }
  if (Array.isArray(body.follow_ups)) {
    db.prepare('DELETE FROM follow_ups WHERE case_id = ?').run(id);
    insertFollowUps(id, body.follow_ups);
  }
  if (Array.isArray(body.image_ids) && body.image_ids.length) {
    const link = db.prepare('UPDATE case_images SET case_id = ?, ocr_status = ? WHERE id = ?');
    for (const imgId of body.image_ids) link.run(id, '已校对', imgId);
  }
  writeLog(userId, 'update', 'medical_case', id, { fields: keys });
}

function getCase(id) {
  const row = db.prepare('SELECT * FROM medical_cases WHERE id = ?').get(id);
  if (!row) return null;
  row.items = db.prepare('SELECT id, herb_name, dosage, note, sort_order FROM prescription_items WHERE case_id = ? ORDER BY sort_order').all(id);
  row.images = db.prepare('SELECT id, image_path, ocr_text, ocr_status, uploaded_at FROM case_images WHERE case_id = ? ORDER BY id').all(id);
  row.follow_ups = db.prepare('SELECT id, follow_date, content, outcome FROM follow_ups WHERE case_id = ? ORDER BY follow_date DESC').all(id);
  return row;
}

// 组合检索：疾病/药物/时间/患者/证型/疗效/医师/关键字
function listCases(query) {
  const where = [query.status ? 'status = ?' : "status != '已归档'"];
  const params = [];
  if (query.status) params.push(query.status);
  if (query.disease) {
    where.push('(tcm_diagnosis LIKE ? OR western_diagnosis LIKE ?)');
    params.push(`%${query.disease}%`, `%${query.disease}%`);
  }
  if (query.herb) {
    where.push('id IN (SELECT case_id FROM prescription_items WHERE herb_name LIKE ?)');
    params.push(`%${query.herb}%`);
  }
  if (query.dateFrom) { where.push('visit_date >= ?'); params.push(query.dateFrom); }
  if (query.dateTo) { where.push('visit_date <= ?'); params.push(query.dateTo); }
  if (query.patient) { where.push('patient_name LIKE ?'); params.push(`%${query.patient}%`); }
  if (query.syndrome) { where.push('syndrome LIKE ?'); params.push(`%${query.syndrome}%`); }
  if (query.outcome) { where.push('outcome = ?'); params.push(query.outcome); }
  if (query.doctor) { where.push('doctor_name LIKE ?'); params.push(`%${query.doctor}%`); }
  if (query.caseType) { where.push('case_type = ?'); params.push(query.caseType); }
  if (query.keyword) {
    where.push('(chief_complaint LIKE ? OR commentary LIKE ? OR tcm_diagnosis LIKE ? OR formula_name LIKE ?)');
    params.push(...Array(4).fill(`%${query.keyword}%`));
  }
  const whereSql = where.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) AS c FROM medical_cases WHERE ${whereSql}`).get(...params).c;
  const page = Math.max(Number(query.page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(query.pageSize) || 10, 1), 200);
  const rows = db.prepare(
    `SELECT * FROM medical_cases WHERE ${whereSql} ORDER BY visit_date DESC, id DESC LIMIT ? OFFSET ?`
  ).all(...params, pageSize, (page - 1) * pageSize);
  return { total, page, pageSize, rows };
}

function softDeleteCase(id, userId) {
  db.prepare("UPDATE medical_cases SET status = '已归档', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
  writeLog(userId, 'delete', 'medical_case', id, { soft: true });
}

function hardDeleteCase(id, userId) {
  const row = db.prepare('SELECT case_no FROM medical_cases WHERE id = ?').get(id);
  db.prepare('DELETE FROM medical_cases WHERE id = ?').run(id);
  writeLog(userId, 'delete', 'medical_case', id, { soft: false, caseNo: row && row.case_no });
}

module.exports = {
  genCaseNo, createCase, updateCase, getCase, listCases,
  softDeleteCase, hardDeleteCase, maskCase, pickFields,
};
