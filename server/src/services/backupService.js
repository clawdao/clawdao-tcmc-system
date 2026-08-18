/**
 * 备份服务：将 SQLite 数据库 + uploads/ 目录打包为 tar.gz
 * 使用系统 tar 命令（macOS/Linux 均内置）。
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const config = require('../config');
const db = require('../models/db');
const { writeLog } = require('../utils/log');

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

async function createBackup(userId) {
  fs.mkdirSync(config.backupDir, { recursive: true });
  // 加随机后缀避免同一秒内连续备份（如恢复前自动快照）发生文件名碰撞
  const name = `backup-${timestamp()}-${Math.random().toString(36).slice(2, 6)}.tar.gz`;
  const target = path.join(config.backupDir, name);
  // 用 SQLite 在线备份 API 导出一致快照（比直接拷贝文件可靠）
  const tmpDb = path.join(config.backupDir, `snapshot-${Date.now()}.db`);
  await db.backup(tmpDb);
  const args = ['-czf', target, '-C', path.dirname(tmpDb), path.basename(tmpDb)];
  if (fs.existsSync(config.uploadDir)) {
    args.push('-C', path.dirname(config.uploadDir), path.basename(config.uploadDir));
  }
  execFileSync('tar', args);
  fs.unlinkSync(tmpDb);
  const stat = fs.statSync(target);
  writeLog(userId, 'backup', 'backup', null, { file: name, size: stat.size });
  pruneOldBackups();
  return { name, size: stat.size, path: target };
}

function listBackups() {
  if (!fs.existsSync(config.backupDir)) return [];
  return fs.readdirSync(config.backupDir)
    .filter((f) => f.startsWith('backup-') && f.endsWith('.tar.gz'))
    .map((f) => {
      const stat = fs.statSync(path.join(config.backupDir, f));
      return { name: f, size: stat.size, createdAt: stat.mtime.toISOString() };
    })
    .sort((a, b) => b.name.localeCompare(a.name));
}

function pruneOldBackups() {
  const list = listBackups();
  const excess = list.slice(config.backup.keep);
  for (const item of excess) {
    fs.unlinkSync(path.join(config.backupDir, item.name));
  }
  return excess.length;
}

async function restoreBackup(name, userId) {
  const file = path.join(config.backupDir, path.basename(name));
  if (!fs.existsSync(file)) {
    const err = new Error('备份文件不存在');
    err.status = 404;
    err.expose = true;
    throw err;
  }
  // 恢复前先给当前状态做快照
  const snapshot = await createBackup(userId);
  const tmpDir = path.join(config.backupDir, `.restore-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  try {
    execFileSync('tar', ['-xzf', file, '-C', tmpDir]);
    const extracted = fs.readdirSync(tmpDir)
      .filter((f) => f.startsWith('snapshot-') && f.endsWith('.db'))
      .map((f) => path.join(tmpDir, f))[0];
    if (!extracted) throw new Error('备份包中未找到数据库文件');
    // 关闭活动连接 → 整体替换数据库文件 → 重新打开连接
    const dbDir = path.dirname(config.dbFile);
    const dbName = path.basename(config.dbFile);
    db.close();
    fs.copyFileSync(extracted, config.dbFile);
    for (const extra of [`${dbName}-wal`, `${dbName}-shm`]) {
      const dst = path.join(dbDir, extra);
      if (fs.existsSync(dst)) fs.unlinkSync(dst);
    }
    db.reopen();
    const uploadsSrc = path.join(tmpDir, path.basename(config.uploadDir));
    if (fs.existsSync(uploadsSrc)) {
      fs.rmSync(config.uploadDir, { recursive: true, force: true });
      fs.cpSync(uploadsSrc, config.uploadDir, { recursive: true });
    }
    writeLog(userId, 'restore', 'backup', null, { file: name, snapshot: snapshot.name });
    return { restored: name, snapshot: snapshot.name };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

module.exports = { createBackup, listBackups, restoreBackup, pruneOldBackups };
