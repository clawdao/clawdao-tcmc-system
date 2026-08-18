const db = require('../models/db');

// 统一的时间范围条件
function dateFilter(query, alias = 'c') {
  const cond = [`${alias}.status != '已归档'`];
  const params = [];
  if (query.dateFrom) { cond.push(`${alias}.visit_date >= ?`); params.push(query.dateFrom); }
  if (query.dateTo) { cond.push(`${alias}.visit_date <= ?`); params.push(query.dateTo); }
  return { where: cond.join(' AND '), params };
}

function overview(query) {
  const { where, params } = dateFilter(query);
  const total = db.prepare(`SELECT COUNT(*) AS c FROM medical_cases c WHERE ${where}`).get(...params).c;
  const monthStart = new Date().toISOString().slice(0, 7) + '-01';
  const today = new Date().toISOString().slice(0, 10);
  const monthNew = db.prepare("SELECT COUNT(*) AS c FROM medical_cases WHERE status != '已归档' AND visit_date >= ?").get(monthStart).c;
  const todayNew = db.prepare("SELECT COUNT(*) AS c FROM medical_cases WHERE status != '已归档' AND visit_date = ?").get(today).c;
  const pendingFollow = db.prepare("SELECT COUNT(*) AS c FROM medical_cases WHERE status != '已归档' AND outcome = '未随访'").get().c;
  const patients = db.prepare("SELECT COUNT(DISTINCT patient_name) AS c FROM medical_cases WHERE status != '已归档'").get().c;
  return { total, monthNew, todayNew, pendingFollow, patients };
}

function diseases(query) {
  const { where, params } = dateFilter(query);
  const top = Math.min(Number(query.top) || 20, 100);
  return db.prepare(
    `SELECT tcm_diagnosis AS name, COUNT(*) AS value FROM medical_cases c
     WHERE ${where} AND tcm_diagnosis IS NOT NULL AND tcm_diagnosis != ''
     GROUP BY tcm_diagnosis ORDER BY value DESC LIMIT ?`
  ).all(...params, top);
}

function herbs(query) {
  const { where, params } = dateFilter(query);
  const top = Math.min(Number(query.top) || 20, 100);
  const topHerbs = db.prepare(
    `SELECT p.herb_name AS name, COUNT(DISTINCT p.case_id) AS value
     FROM prescription_items p JOIN medical_cases c ON c.id = p.case_id
     WHERE ${where}
     GROUP BY p.herb_name ORDER BY value DESC LIMIT ?`
  ).all(...params, top);

  // 药对共现：同一医案内两药组合出现次数
  const pairRows = db.prepare(
    `SELECT a.herb_name AS h1, b.herb_name AS h2, COUNT(DISTINCT a.case_id) AS cnt
     FROM prescription_items a
     JOIN prescription_items b ON a.case_id = b.case_id AND a.herb_name < b.herb_name
     JOIN medical_cases c ON c.id = a.case_id
     WHERE ${where}
     GROUP BY h1, h2 ORDER BY cnt DESC LIMIT ?`
  ).all(...params, Math.min(Number(query.top) || 20, 50));
  const pairs = pairRows.map((r) => ({ name: `${r.h1} + ${r.h2}`, value: r.cnt }));
  return { topHerbs, pairs };
}

function syndromes(query) {
  const { where, params } = dateFilter(query);
  return db.prepare(
    `SELECT syndrome AS name, COUNT(*) AS value FROM medical_cases c
     WHERE ${where} AND syndrome IS NOT NULL AND syndrome != ''
     GROUP BY syndrome ORDER BY value DESC`
  ).all(...params);
}

function outcomes(query) {
  const { where, params } = dateFilter(query);
  // 分疾病的疗效构成（堆叠图数据）
  return db.prepare(
    `SELECT tcm_diagnosis AS disease, outcome, COUNT(*) AS value
     FROM medical_cases c
     WHERE ${where} AND tcm_diagnosis IS NOT NULL AND tcm_diagnosis != ''
     GROUP BY tcm_diagnosis, outcome ORDER BY disease, outcome`
  ).all(...params);
}

function trend(query) {
  const { where, params } = dateFilter(query);
  const group = query.group === 'year' ? "strftime('%Y', visit_date)" : "strftime('%Y-%m', visit_date)";
  return db.prepare(
    `SELECT ${group} AS period, COUNT(*) AS value FROM medical_cases c
     WHERE ${where} GROUP BY period ORDER BY period`
  ).all(...params);
}

function doctors(query) {
  const { where, params } = dateFilter(query);
  return db.prepare(
    `SELECT doctor_name AS name, COUNT(*) AS value FROM medical_cases c
     WHERE ${where} AND doctor_name IS NOT NULL AND doctor_name != ''
     GROUP BY doctor_name ORDER BY value DESC`
  ).all(...params);
}

module.exports = { overview, diseases, herbs, syndromes, outcomes, trend, doctors };
