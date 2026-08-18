const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('../config');

fs.mkdirSync(path.dirname(config.dbFile), { recursive: true });
fs.mkdirSync(config.uploadDir, { recursive: true });
fs.mkdirSync(config.backupDir, { recursive: true });

let db = null;
const reopenListeners = [];

function open() {
  db = new Database(config.dbFile);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
}

open();

// 关闭当前连接并重新打开（备份恢复后使用）。
// 注意：模块级缓存的预编译语句会在旧连接上失效，
// 持有方需通过 onReopen 注册回调做惰性重建。
function reopen() {
  try { db.close(); } catch { /* 忽略已关闭的情况 */ }
  open();
  for (const fn of reopenListeners) {
    try { fn(); } catch (err) { console.error('[db reopen 回调失败]', err.message); }
  }
}

function onReopen(fn) {
  reopenListeners.push(fn);
}

// 通过包装转发，保证调用方始终落到当前活动连接
module.exports = {
  get raw() { return db; },
  reopen,
  onReopen,
  prepare: (...args) => db.prepare(...args),
  exec: (...args) => db.exec(...args),
  pragma: (...args) => db.pragma(...args),
  transaction: (...args) => db.transaction(...args),
  backup: (...args) => db.backup(...args),
  close: () => db.close(),
};
