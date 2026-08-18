// API 集成测试：使用独立临时数据库与上传目录，不影响正式数据
process.env.DB_FILE = require('path').join(__dirname, '.tmp', 'test.db');
process.env.UPLOAD_DIR = require('path').join(__dirname, '.tmp', 'uploads');
process.env.BACKUP_DIR = require('path').join(__dirname, '.tmp', 'backups');
process.env.BACKUP_CRON = '';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

fs.rmSync(path.join(__dirname, '.tmp'), { recursive: true, force: true });

const migrate = require('../db/migrate');
const seed = require('../db/seed');
const createApp = require('../src/app');

let server;
let base;
let token;

async function api(method, url, body, isForm) {
  const headers = { Authorization: `Bearer ${token}` };
  let payload;
  if (isForm) {
    payload = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(base + url, { method, headers, body: payload });
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('json') ? await res.json() : await res.arrayBuffer();
  return { status: res.status, body: data };
}

test.before(async () => {
  migrate();
  seed();
  const app = createApp();
  await new Promise((resolve) => {
    server = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${server.address().port}`;
  const res = await api('POST', '/api/auth/login', { username: 'admin', password: 'admin123' });
  token = res.body.data.token;
});

test.after(() => {
  server.close();
  fs.rmSync(path.join(__dirname, '.tmp'), { recursive: true, force: true });
});

test('登录签发 Token，错误密码被拒绝', async () => {
  const bad = await api('POST', '/api/auth/login', { username: 'admin', password: 'wrong' });
  assert.equal(bad.status, 401);
  assert.ok(token.length > 50);
});

test('未登录访问业务接口返回 401', async () => {
  const res = await fetch(base + '/api/cases');
  assert.equal(res.status, 401);
});

let caseId;
test('医案 CRUD 全流程', async () => {
  const create = await api('POST', '/api/cases', {
    patient_name: '测试患者', gender: '男', age: 50, visit_date: '2026-08-01',
    tcm_diagnosis: '胃脘痛', syndrome: '肝郁脾虚证', outcome: '有效', doctor_name: '测试医师',
    items: [{ herb_name: '柴胡', dosage: '10g' }, { herb_name: '白芍', dosage: '15g' }],
  });
  assert.equal(create.body.code, 0);
  caseId = create.body.data.id;
  assert.match(create.body.data.case_no, /^YA\d{11}$/);
  assert.equal(create.body.data.items.length, 2);

  const detail = await api('GET', `/api/cases/${caseId}`);
  assert.equal(detail.body.data.tcm_diagnosis, '胃脘痛');

  const update = await api('PUT', `/api/cases/${caseId}`, { outcome: '显效', commentary: '药后症减' });
  assert.equal(update.body.data.outcome, '显效');
  assert.equal(update.body.data.commentary, '药后症减');
});

test('组合检索：疾病/药物/患者/时间', async () => {
  const byDisease = await api('GET', '/api/cases?disease=胃脘痛');
  assert.equal(byDisease.body.data.total, 1);
  const byHerb = await api('GET', '/api/cases?herb=白芍');
  assert.equal(byHerb.body.data.total, 1);
  const byPatient = await api('GET', '/api/cases?patient=测试');
  assert.equal(byPatient.body.data.total, 1);
  const byDate = await api('GET', '/api/cases?dateFrom=2026-08-01&dateTo=2026-08-02');
  assert.equal(byDate.body.data.total, 1);
  const miss = await api('GET', '/api/cases?herb=不存在的药');
  assert.equal(miss.body.data.total, 0);
});

test('统计接口', async () => {
  const overview = await api('GET', '/api/stats/overview');
  assert.equal(overview.body.data.total, 1);
  const diseases = await api('GET', '/api/stats/diseases');
  assert.equal(diseases.body.data[0].name, '胃脘痛');
  const herbs = await api('GET', '/api/stats/herbs');
  assert.equal(herbs.body.data.topHerbs.length, 2);
  assert.equal(herbs.body.data.pairs.length, 1);
});

test('OCR 上传识别返回结构化草稿', async () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const form = new FormData();
  form.append('image', new Blob([png], { type: 'image/png' }), 'case.png');
  const res = await api('POST', '/api/cases/upload-image', form, true);
  assert.equal(res.body.code, 0);
  assert.ok(res.body.data.ocrText.includes('主诉'));
  assert.ok(res.body.data.draft.tcm_diagnosis);
  assert.ok(Array.isArray(res.body.data.draft.items));
});

test('导出 Excel/CSV', async () => {
  const xlsx = await api('GET', '/api/cases/export');
  assert.ok(xlsx.body.byteLength > 2000);
  const csv = await api('GET', '/api/cases/export?format=csv');
  assert.ok(Buffer.from(csv.body).toString('utf8').includes('医案编号'));
});

test('备份与恢复', async () => {
  const backup = await api('POST', '/api/backup');
  assert.equal(backup.body.code, 0);
  const list = await api('GET', '/api/backup/list');
  assert.equal(list.body.data.length, 1);
  // 删除医案后从备份恢复
  await api('DELETE', `/api/cases/${caseId}?hard=true`);
  const gone = await api('GET', '/api/cases');
  assert.equal(gone.body.data.total, 0);
  const restore = await api('POST', '/api/backup/restore', { name: backup.body.data.name });
  assert.equal(restore.body.code, 0);
  // 恢复后需重新建立连接验证（better-sqlite3 缓存文件句柄，这里直接查库验证）
  const db = require('../src/models/db');
  const count = db.prepare("SELECT COUNT(*) AS c FROM medical_cases WHERE status != '已归档'").get().c;
  assert.equal(count, 1);
});

test('数据字典与操作日志', async () => {
  const dicts = await api('GET', '/api/dicts?type=herb&keyword=黄芪');
  assert.ok(dicts.body.data.length >= 1);
  const add = await api('POST', '/api/dicts', { dict_type: 'herb', name: '测试药材甲' });
  assert.equal(add.body.code, 0);
  const logs = await api('GET', '/api/logs');
  assert.ok(logs.body.data.total >= 3);
});

test('处方模板保存与删除', async () => {
  const save = await api('POST', '/api/templates', {
    name: '测试模板', formula_name: '四君子汤',
    items: [{ herb_name: '党参', dosage: '15g' }],
  });
  assert.equal(save.body.code, 0);
  const list = await api('GET', '/api/templates');
  assert.equal(list.body.data[0].items[0].herb_name, '党参');
  const del = await api('DELETE', `/api/templates/${save.body.data.id}`);
  assert.equal(del.body.code, 0);
});
