const Router = require('@koa/router');
const { z } = require('zod');
const db = require('../models/db');
const { ok, fail } = require('../middlewares/error');
const { requireRole } = require('../middlewares/auth');

const router = new Router({ prefix: '/api/templates' });
router.use(requireRole('admin', 'doctor'));

router.get('/', (ctx) => {
  const rows = db.prepare('SELECT * FROM prescription_templates ORDER BY id DESC').all();
  ok(ctx, rows.map((r) => ({ ...r, items: JSON.parse(r.items || '[]') })));
});

const templateSchema = z.object({
  name: z.string().min(1, '模板名称不能为空'),
  formula_name: z.string().optional().nullable(),
  usage_text: z.string().optional().nullable(),
  advice: z.string().optional().nullable(),
  items: z.array(z.object({
    herb_name: z.string().min(1),
    dosage: z.string().optional().nullable(),
    note: z.string().optional().nullable(),
  })).default([]),
});

router.post('/', (ctx) => {
  const parsed = templateSchema.safeParse(ctx.request.body);
  if (!parsed.success) return fail(ctx, 400, parsed.error.issues[0].message);
  const d = parsed.data;
  const info = db.prepare(
    'INSERT INTO prescription_templates (name, formula_name, usage_text, advice, items, created_by) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(d.name, d.formula_name || null, d.usage_text || null, d.advice || null, JSON.stringify(d.items), ctx.state.user.id);
  ok(ctx, { id: info.lastInsertRowid }, '模板已保存');
});

router.delete('/:id(\\d+)', (ctx) => {
  const info = db.prepare('DELETE FROM prescription_templates WHERE id = ?').run(Number(ctx.params.id));
  if (!info.changes) return fail(ctx, 404, '模板不存在');
  ok(ctx, null, '模板已删除');
});

module.exports = router;
