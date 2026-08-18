const Router = require('@koa/router');
const db = require('../models/db');
const { ok } = require('../middlewares/error');

const router = new Router({ prefix: '/api/followups' });

// 待随访医案列表（疗效为"未随访"）
router.get('/pending', (ctx) => {
  const rows = db.prepare(
    `SELECT id, case_no, visit_date, patient_name, tcm_diagnosis, doctor_name
     FROM medical_cases WHERE status != '已归档' AND outcome = '未随访'
     ORDER BY visit_date DESC LIMIT 100`
  ).all();
  ok(ctx, rows);
});

module.exports = router;
