const Router = require('@koa/router');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const db = require('../models/db');
const config = require('../config');
const { ok, fail } = require('../middlewares/error');
const { auth } = require('../middlewares/auth');
const { writeLog } = require('../utils/log');

const router = new Router({ prefix: '/api/auth' });

const loginSchema = z.object({
  username: z.string().min(1, '用户名不能为空'),
  password: z.string().min(1, '密码不能为空'),
});

router.post('/login', async (ctx) => {
  const parsed = loginSchema.safeParse(ctx.request.body);
  if (!parsed.success) return fail(ctx, 400, parsed.error.issues[0].message);
  const { username, password } = parsed.data;
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return fail(ctx, 401, '用户名或密码错误');
  }
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, realName: user.real_name },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
  writeLog(user.id, 'login', 'user', user.id, null);
  ok(ctx, { token, user: { id: user.id, username: user.username, realName: user.real_name, role: user.role } });
});

// 修改自己的密码
router.post('/change-password', auth(), async (ctx) => {
  const schema = z.object({ oldPassword: z.string().min(1), newPassword: z.string().min(6, '新密码至少 6 位') });
  const parsed = schema.safeParse(ctx.request.body);
  if (!parsed.success) return fail(ctx, 400, parsed.error.issues[0].message);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(ctx.state.user.id);
  if (!bcrypt.compareSync(parsed.data.oldPassword, user.password_hash)) {
    return fail(ctx, 400, '原密码错误');
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .run(bcrypt.hashSync(parsed.data.newPassword, 10), user.id);
  ok(ctx, null, '密码修改成功');
});

module.exports = router;
