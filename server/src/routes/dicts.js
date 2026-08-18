const Router = require('@koa/router');
const { z } = require('zod');
const db = require('../models/db');
const { ok, fail } = require('../middlewares/error');
const { requireRole } = require('../middlewares/auth');

const router = new Router({ prefix: '/api/dicts' });

// 查询：?type=herb&keyword=黄
router.get('/', (ctx) => {
  const where = [];
  const params = [];
  if (ctx.query.type) { where.push('dict_type = ?'); params.push(ctx.query.type); }
  if (ctx.query.keyword) {
    where.push('(name LIKE ? OR alias LIKE ?)');
    params.push(`%${ctx.query.keyword}%`, `%${ctx.query.keyword}%`);
  }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const rows = db.prepare(`SELECT * FROM dictionaries ${whereSql} ORDER BY dict_type, name LIMIT 500`).all(...params);
  ok(ctx, rows);
});

const dictSchema = z.object({
  dict_type: z.enum(['disease', 'herb', 'syndrome', 'formula']),
  name: z.string().min(1, '名称不能为空'),
  alias: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
});

router.post('/', requireRole('admin'), (ctx) => {
  const parsed = dictSchema.safeParse(ctx.request.body);
  if (!parsed.success) return fail(ctx, 400, parsed.error.issues[0].message);
  const d = parsed.data;
  try {
    const info = db.prepare('INSERT INTO dictionaries (dict_type, name, alias, category) VALUES (?, ?, ?, ?)')
      .run(d.dict_type, d.name, d.alias || null, d.category || null);
    ok(ctx, { id: info.lastInsertRowid }, '字典项已添加');
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return fail(ctx, 409, '该字典项已存在');
    throw e;
  }
});

router.put('/:id(\\d+)', requireRole('admin'), (ctx) => {
  const parsed = dictSchema.partial().safeParse(ctx.request.body);
  if (!parsed.success) return fail(ctx, 400, parsed.error.issues[0].message);
  const d = parsed.data;
  const row = db.prepare('SELECT id FROM dictionaries WHERE id = ?').get(Number(ctx.params.id));
  if (!row) return fail(ctx, 404, '字典项不存在');
  db.prepare('UPDATE dictionaries SET name = COALESCE(?, name), alias = COALESCE(?, alias), category = COALESCE(?, category) WHERE id = ?')
    .run(d.name || null, d.alias ?? null, d.category ?? null, row.id);
  ok(ctx, null, '字典项已更新');
});

router.delete('/:id(\\d+)', requireRole('admin'), (ctx) => {
  const info = db.prepare('DELETE FROM dictionaries WHERE id = ?').run(Number(ctx.params.id));
  if (!info.changes) return fail(ctx, 404, '字典项不存在');
  ok(ctx, null, '字典项已删除');
});

module.exports = router;
