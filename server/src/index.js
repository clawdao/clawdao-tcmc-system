const cron = require('node-cron');
const createApp = require('./app');
const config = require('./config');
const migrate = require('../db/migrate');
const backupService = require('./services/backupService');

// 启动时确保数据库结构就绪
migrate();

const app = createApp();
const server = app.listen(config.port, () => {
  console.log(`中医医案管理系统后端已启动：http://localhost:${config.port}`);
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`[启动失败] 端口 ${config.port} 已被占用。`);
    console.error(`  → 排查：lsof -i :${config.port}`);
    console.error(`  → 或修改 PORT 环境变量 / .clawdao/project.json 的 ports.dev`);
    process.exit(1);
  }
  console.error('[启动失败] Server error:', err);
  process.exit(1);
});

// 定时备份任务
if (config.backup.cron) {
  cron.schedule(config.backup.cron, () => {
    backupService.createBackup(null)
      .then((result) => console.log(`[定时备份] 完成：${result.name}`))
      .catch((err) => console.error('[定时备份] 失败：', err.message));
  });
  console.log(`[定时备份] 已启用：${config.backup.cron}（保留最近 ${config.backup.keep} 份）`);
}
