const cron = require('node-cron');
const createApp = require('./app');
const config = require('./config');
const migrate = require('../db/migrate');
const backupService = require('./services/backupService');

// 启动时确保数据库结构就绪
migrate();

const app = createApp();
app.listen(config.port, () => {
  console.log(`中医医案管理系统后端已启动：http://localhost:${config.port}`);
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
