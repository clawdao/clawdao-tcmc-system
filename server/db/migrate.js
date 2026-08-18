const fs = require('fs');
const path = require('path');
const db = require('../src/models/db');

const SCHEMA_VERSION = 1;

function migrate() {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  const row = db.prepare('SELECT MAX(version) AS v FROM schema_migrations').get();
  const current = row && row.v ? row.v : 0;
  if (current >= SCHEMA_VERSION) {
    console.log(`数据库已是最新版本 (v${current})，无需迁移`);
    return;
  }
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(sql);
  db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(SCHEMA_VERSION);
  console.log(`数据库迁移完成：v${current} -> v${SCHEMA_VERSION}`);
}

if (require.main === module) migrate();
module.exports = migrate;
