const path = require('path');
const fs = require('fs');
const Koa = require('koa');
const bodyParser = require('koa-bodyparser');
const cors = require('@koa/cors');
const errorHandler = require('./middlewares/error');
const { auth } = require('./middlewares/auth');
const config = require('./config');

const authRoutes = require('./routes/auth');
const caseRoutes = require('./routes/cases');
const statsRoutes = require('./routes/stats');
const dictRoutes = require('./routes/dicts');
const backupRoutes = require('./routes/backup');
const userRoutes = require('./routes/users');
const logRoutes = require('./routes/logs');
const templateRoutes = require('./routes/templates');
const followupRoutes = require('./routes/followups');
const importRoutes = require('./routes/import');

function createApp() {
  const app = new Koa();

  app.use(errorHandler());
  app.use(cors({ credentials: true }));
  app.use(bodyParser({ jsonLimit: '10mb' }));

  // 上传图片访问（文件名随机化不可猜测）：/uploads/<filename>
  const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
  app.use(async (ctx, next) => {
    if (ctx.path.startsWith('/uploads/')) {
      const file = path.join(config.uploadDir, path.basename(ctx.path));
      if (fs.existsSync(file)) {
        ctx.set('Content-Type', MIME[path.extname(file).toLowerCase()] || 'application/octet-stream');
        ctx.body = fs.createReadStream(file);
        return;
      }
      ctx.status = 404;
      return;
    }
    await next();
  });

  // 健康检查
  app.use(async (ctx, next) => {
    if (ctx.path === '/api/health') {
      ctx.body = { code: 0, message: 'ok', data: { status: 'up' } };
      return;
    }
    await next();
  });

  // 公开路由
  app.use(authRoutes.routes()).use(authRoutes.allowedMethods());

  // 以下路由统一需要登录
  app.use(auth());
  for (const r of [caseRoutes, statsRoutes, dictRoutes, backupRoutes, userRoutes, logRoutes, templateRoutes, followupRoutes, importRoutes]) {
    app.use(r.routes()).use(r.allowedMethods());
  }

  return app;
}

module.exports = createApp;
