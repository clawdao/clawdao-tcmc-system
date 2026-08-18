import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { client, loadConfig, saveConfig, getServer } from './api.js';

function printTable(rows, columns) {
  if (!rows.length) {
    console.log('（无数据）');
    return;
  }
  const widths = columns.map((c) => Math.max(c.title.length, ...rows.map((r) => String(r[c.key] ?? '—').length)));
  const line = (vals) => vals.map((v, i) => String(v ?? '—').padEnd(widths[i])).join('  ');
  console.log(line(columns.map((c) => c.title)));
  console.log(widths.map((w) => '─'.repeat(w)).join('  '));
  for (const r of rows) console.log(line(columns.map((c) => r[c.key])));
  console.log(`共 ${rows.length} 条`);
}

async function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); });
  });
}

export async function login(opts) {
  const username = opts.username || await ask('用户名: ');
  const password = opts.password || await ask('密码: ');
  if (!username || !password) throw new Error('用户名和密码不能为空');
  const server = opts.server || getServer();
  const cfg = { ...loadConfig(), server };
  saveConfig(cfg);
  const res = await client().post('/auth/login', { username, password });
  saveConfig({ ...cfg, token: res.data.token });
  console.log(`登录成功：${res.data.user.realName || res.data.user.username}（${res.data.user.role}）@ ${server}`);
}

export async function caseList(opts) {
  const params = {};
  if (opts.disease) params.disease = opts.disease;
  if (opts.herb) params.herb = opts.herb;
  if (opts.patient) params.patient = opts.patient;
  if (opts.from) params.dateFrom = opts.from;
  if (opts.to) params.dateTo = opts.to;
  if (opts.syndrome) params.syndrome = opts.syndrome;
  if (opts.outcome) params.outcome = opts.outcome;
  if (opts.doctor) params.doctor = opts.doctor;
  if (opts.keyword) params.keyword = opts.keyword;
  params.page = opts.page || 1;
  params.pageSize = opts.pageSize || 20;
  const res = await client().get('/cases', { params });
  console.log(`符合条件医案总数：${res.data.total}`);
  printTable(res.data.list, [
    { key: 'case_no', title: '编号' }, { key: 'visit_date', title: '日期' },
    { key: 'patient_name', title: '患者' }, { key: 'tcm_diagnosis', title: '诊断' },
    { key: 'syndrome', title: '证型' }, { key: 'outcome', title: '疗效' },
    { key: 'doctor_name', title: '医师' },
  ]);
}

async function resolveId(caseNoOrId) {
  if (/^\d+$/.test(String(caseNoOrId))) return Number(caseNoOrId);
  const res = await client().get('/cases', { params: { keyword: caseNoOrId } });
  const found = res.data.list.find((c) => c.case_no === caseNoOrId);
  if (!found) throw new Error(`未找到医案：${caseNoOrId}`);
  return found.id;
}

export async function caseGet(caseNoOrId) {
  const id = await resolveId(caseNoOrId);
  const res = await client().get(`/cases/${id}`);
  console.log(JSON.stringify(res.data, null, 2));
}

export async function caseCreate(opts) {
  const body = JSON.parse(fs.readFileSync(opts.file, 'utf8'));
  const res = await client().post('/cases', body);
  console.log(`创建成功：${res.data.case_no}（id=${res.data.id}）`);
}

export async function caseUpload(imagePath) {
  if (!fs.existsSync(imagePath)) throw new Error(`文件不存在：${imagePath}`);
  const form = new FormData();
  const buf = fs.readFileSync(imagePath);
  const type = { '.png': 'image/png', '.webp': 'image/webp' }[path.extname(imagePath).toLowerCase()] || 'image/jpeg';
  form.append('image', new Blob([buf], { type }), path.basename(imagePath));
  const res = await client().post('/cases/upload-image', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  console.log(`识别状态：${res.data.ocrStatus}`);
  console.log('--- OCR 原文 ---');
  console.log(res.data.ocrText || '（无）');
  console.log('--- 解析草稿 ---');
  console.log(JSON.stringify(res.data.draft, null, 2));
  console.log(`图片已保存（imageId=${res.data.imageId}），请通过 Web 端校对后提交建案`);
}

export async function caseDelete(caseNoOrId, opts) {
  const id = await resolveId(caseNoOrId);
  await client().delete(`/cases/${id}${opts.hard ? '?hard=true' : ''}`);
  console.log(`已删除医案 id=${id}${opts.hard ? '（物理删除）' : '（归档）'}`);
}

export async function statsOverview() {
  const res = await client().get('/stats/overview');
  const d = res.data;
  console.log(`医案总数：${d.total}  本月新增：${d.monthNew}  今日新增：${d.todayNew}  待随访：${d.pendingFollow}  患者人数：${d.patients}`);
}

export async function statsHerbs(opts) {
  const res = await client().get('/stats/herbs', { params: { top: opts.top || 20 } });
  console.log('--- 高频药物 ---');
  printTable(res.data.topHerbs, [{ key: 'name', title: '药名' }, { key: 'value', title: '医案数' }]);
  console.log('--- 常用药对 ---');
  printTable(res.data.pairs, [{ key: 'name', title: '药对' }, { key: 'value', title: '共现次数' }]);
}

export async function exportCases(opts) {
  const params = new URLSearchParams();
  for (const k of ['disease', 'herb', 'patient', 'syndrome', 'outcome', 'doctor', 'keyword']) {
    if (opts[k]) params.set(k, opts[k]);
  }
  if (opts.from) params.set('dateFrom', opts.from);
  if (opts.to) params.set('dateTo', opts.to);
  if (opts.format) params.set('format', opts.format);
  const res = await client().get(`/cases/export?${params}`, { responseType: 'arraybuffer' });
  const out = opts.output || `cases-${Date.now()}.${opts.format === 'csv' ? 'csv' : 'xlsx'}`;
  fs.writeFileSync(out, Buffer.from(res));
  console.log(`已导出：${out}（${(fs.statSync(out).size / 1024).toFixed(1)} KB）`);
}

export async function backupCreate() {
  const res = await client().post('/backup');
  console.log(`备份完成：${res.data.name}（${(res.data.size / 1024).toFixed(1)} KB）`);
}

export async function backupList() {
  const res = await client().get('/backup/list');
  printTable(res.data.map((b) => ({ ...b, size: `${(b.size / 1024).toFixed(1)}KB` })), [
    { key: 'name', title: '备份文件' }, { key: 'size', title: '大小' }, { key: 'createdAt', title: '创建时间' },
  ]);
}

export async function backupRestore(name) {
  const res = await client().post('/backup/restore', { name });
  console.log(`恢复完成：${res.data.restored}（恢复前快照：${res.data.snapshot}）`);
}

export async function importCases(file) {
  if (!fs.existsSync(file)) throw new Error(`文件不存在：${file}`);
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync(file)]), path.basename(file));
  const res = await client().post('/import', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  console.log(res.message);
  if (res.data.failed.length) {
    console.log('失败明细：');
    for (const f of res.data.failed) console.log(`  第 ${f.row} 行：${f.reason}`);
  }
}
