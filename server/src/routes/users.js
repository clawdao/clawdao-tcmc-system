const Router = require('@koa/router');
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const db = require('../models/db');
const { ok, fail } = require('../middlewares/error');
const { requireRole } = require('../middlewares/auth');

const router = new Router({ prefix: '/api/users' });
router.use(requireRole('admin'));

router.get('/', (ctx) => {
  const rows = db.prepare('SELECT id, username, real_name, role, created_at FROM users ORDER BY id').all();
  ok(ctx, rows);
});

const userSchema = z.object({
  username: z.string().min(2, '用户名至少 2 个字符'),
  password: z.string().min(6, '密码至少 6 位'),
  real_name: z.string().optional().nullable(),
  role: z.enum(['admin', 'doctor', 'readonly']).default('doctor'),
});

router.post('/', (ctx) => {
  const parsed = userSchema.safeParse(ctx.request.body);
  if (!parsed.success) return fail(ctx, 400, parsed.error.issues[0].message);
  const d = parsed.data;
  const exists = db.prepare('SELECT id FROM users WHERE username = ?').get(d.username);
  if (exists) return fail(ctx, 409, '用户名已存在');
  const info = db.prepare('INSERT INTO users (username, password_hash, real_name, role) VALUES (?, ?, ?, ?)')
    .run(d.username, bcrypt.hashSync(d.password, 10), d.real_name || null, d.role);
  ok(ctx, { id: info.lastInsertRowid }, '用户已创建');
});

router.put('/:id(\\d+)', (ctx) => {
  const schema = userSchema.partial({ password: true });
  const parsed = schema.omit({ username: true }).safeParse(ctx.request.body);
  if (!parsed.success) return fail(ctx, 400, parsed.error.issues[0].message);
  const id = Number(ctx.params.id);
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) return fail(ctx, 404, '用户不存在');
  const d = parsed.data;
  if (d.role) db.prepare('UPDATE users SET role = ? WHERE id = ?').run(d.role, id);
  if (d.real_name !== undefined) db.prepare('UPDATE users SET real_name = ? WHERE id = ?').run(d.real_name, id);
  if (d.password) db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(d.password, 10), id);
  ok(ctx, null, '用户已更新');
});

router.delete('/:id(\\d+)', (ctx) => {
  const id = Number(ctx.params.id);
  if (id === ctx.state.user.id) return fail(ctx, 400, '不能删除当前登录账号');
  const info = db.prepare('DELETE FROM users WHERE id = ?').run(id);
  if (!info.changes) return fail(ctx, 404, '用户不存在');
  ok(ctx, null, '用户已删除');
});

module.exports = router;
