const Router = require('@koa/router');
const db = require('../models/db');
const { ok } = require('../middlewares/error');
const { requireRole } = require('../middlewares/auth');

const router = new Router({ prefix: '/api/logs' });
router.use(requireRole('admin'));

router.get('/', (ctx) => {
  const page = Math.max(Number(ctx.query.page) || 1, 1);
  const pageSize = Math.min(Number(ctx.query.pageSize) || 20, 100);
  const where = [];
  const params = [];
  if (ctx.query.action) { where.push('l.action = ?'); params.push(ctx.query.action); }
  if (ctx.query.dateFrom) { where.push('l.created_at >= ?'); params.push(ctx.query.dateFrom + ' 00:00:00'); }
  if (ctx.query.dateTo) { where.push('l.created_at <= ?'); params.push(ctx.query.dateTo + ' 23:59:59'); }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const total = db.prepare(`SELECT COUNT(*) AS c FROM operation_logs l ${whereSql}`).get(...params).c;
  const rows = db.prepare(
    `SELECT l.*, u.username FROM operation_logs l LEFT JOIN users u ON u.id = l.user_id
     ${whereSql} ORDER BY l.id DESC LIMIT ? OFFSET ?`
  ).all(...params, pageSize, (page - 1) * pageSize);
  ok(ctx, { total, page, pageSize, list: rows });
});

module.exports = router;
