const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

module.exports = {
  port: Number(process.env.PORT || 3000),
  dbFile: process.env.DB_FILE || path.join(ROOT, 'db', 'tcm-case.db'),
  uploadDir: process.env.UPLOAD_DIR || path.join(ROOT, 'uploads'),
  backupDir: process.env.BACKUP_DIR || path.join(ROOT, 'backups'),
  // 密钥必须来自环境变量，禁止在代码中硬编码真实密钥
  jwtSecret: process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '12h',
  backup: {
    cron: process.env.BACKUP_CRON || '0 2 * * *', // 每日 02:00
    keep: Number(process.env.BACKUP_KEEP || 30),
  },
  ocr: {
    // mock（内置演示，无需密钥）| http（对接外部 OCR HTTP API）
    provider: process.env.OCR_PROVIDER || 'mock',
    endpoint: process.env.OCR_ENDPOINT || '',
    apiKey: process.env.OCR_API_KEY || '',
  },
  upload: {
    maxSize: 10 * 1024 * 1024,
    allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
  },
};
