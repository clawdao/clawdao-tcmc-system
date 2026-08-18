const db = require('../models/db');

let insertStmt = null;
db.onReopen(() => { insertStmt = null; });
function stmt() {
  if (!insertStmt) {
    insertStmt = db.prepare(
      'INSERT INTO operation_logs (user_id, action, target_type, target_id, detail) VALUES (?, ?, ?, ?, ?)'
    );
  }
  return insertStmt;
}

// 操作日志：action 如 create/update/delete/export/backup/login/import
function writeLog(userId, action, targetType, targetId, detail) {
  try {
    stmt().run(userId || null, action, targetType || null, targetId || null,
      detail ? JSON.stringify(detail).slice(0, 2000) : null);
  } catch (err) {
    console.error('[日志写入失败]', err.message);
  }
}

module.exports = { writeLog };
