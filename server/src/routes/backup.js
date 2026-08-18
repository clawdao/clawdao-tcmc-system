const path = require('path');
const fs = require('fs');
const Router = require('@koa/router');
const config = require('../config');
const { ok, fail } = require('../middlewares/error');
const { requireRole } = require('../middlewares/auth');
const backupService = require('../services/backupService');

const router = new Router({ prefix: '/api/backup' });

router.use(requireRole('admin'));

router.post('/', async (ctx) => ok(ctx, await backupService.createBackup(ctx.state.user.id), '备份完成'));

router.get('/list', (ctx) => ok(ctx, backupService.listBackups()));

router.get('/download/:name', (ctx) => {
  const file = path.join(config.backupDir, path.basename(ctx.params.name));
  if (!fs.existsSync(file)) return fail(ctx, 404, '备份文件不存在');
  ctx.set('Content-Disposition', `attachment; filename="${path.basename(file)}"`);
  ctx.set('Content-Type', 'application/gzip');
  ctx.body = fs.createReadStream(file);
});

router.post('/restore', async (ctx) => {
  const name = ctx.request.body && ctx.request.body.name;
  if (!name) return fail(ctx, 400, '请指定备份文件名');
  const result = await backupService.restoreBackup(name, ctx.state.user.id);
  ok(ctx, result, '恢复完成，恢复前已自动快照当前状态');
});

module.exports = router;
