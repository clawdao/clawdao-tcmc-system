#!/usr/bin/env bun
/**
 * scripts/start-all.ts — 通用项目多进程启动管理器 (ClawDao 标准模板)
 *
 * 由 clawdao 的 runProject() 调用：bun run scripts/start-all.ts
 * 启动顺序：后端 → 前端；任一子进程退出 → 整体关闭；SIGTERM/SIGINT 优雅退出。
 *
 * 端口自动分配规则（PORT AUTO-ASSIGNMENT，见 docs/../PORT-AUTO-ASSIGNMENT.md）：
 *   1. 首选端口 = env VF_PORT/VF_WEB_PORT > .clawdao/project.json ports.dev/web > 默认值
 *   2. 启动前探测，被占用自动 +1 找空闲（最多 50 次）
 *   3. 实际端口回写 .clawdao/project.json，保证平台预检 / health-check / 前端代理一致
 *   4. 绝不无差别 kill 端口占用者，只清理本管理器 .running.pids 里的残留
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

// ── 工具链路径探测（ClawDao 平台 PATH 不含 node/npm/bun，需要手动找） ──

function resolveTool(tool: string, candidates: string[]): string | null {
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

function findNode(): string {
  const home = Bun.env.HOME ?? '';
  const nodePaths = [
    `${home}/.nvm/versions/node/v22.22.0/bin/node`,
    `${home}/.nvm/versions/node/v22.0.0/bin/node`,
    `${home}/.nvm/versions/node/v24.0.0/bin/node`,
    `${home}/.bun/bin/node`,
    '/opt/homebrew/bin/node',
    '/usr/local/bin/node',
  ];
  const found = resolveTool('node', nodePaths);
  if (found) return found;
  console.error('[start-all] \u274c 找不到 node，请确保已安装 Node.js 18+');
  process.exit(1);
}

function findNpm(): string {
  const home = Bun.env.HOME ?? '';
  const npmPaths = [
    `${home}/.nvm/versions/node/v22.22.0/bin/npm`,
    `${home}/.nvm/versions/node/v22.0.0/bin/npm`,
    `${home}/.nvm/versions/node/v24.0.0/bin/npm`,
    `${home}/.bun/bin/npm`,
    '/opt/homebrew/bin/npm',
    '/usr/local/bin/npm',
  ];
  const found = resolveTool('npm', npmPaths);
  if (found) return found;
  console.error('[start-all] \u274c 找不到 npm');
  process.exit(1);
}

const NODE_BIN = findNode();
const NPM_BIN = findNpm();
const NODE_DIR = resolve(NODE_BIN, '..');
const NPM_DIR = resolve(NPM_BIN, '..');

// 注入到 PATH，让子进程能找到 node/npm/npx
const basePath = Bun.env.PATH ?? '/usr/bin:/bin:/usr/sbin:/sbin';
Bun.env.PATH = `${NODE_DIR}:${NPM_DIR}:${basePath}`;

console.log(`[start-all] Node: ${NODE_BIN}`);
console.log(`[start-all] NPM:  ${NPM_BIN}`);



// ── 项目配置读取 ──

interface ProjectConfig {
  name?: string;
  ports?: Record<string, number>;
  protocol?: { lifecycle?: Record<string, unknown> };
}

const cwd = process.cwd();
const configPath = resolve(cwd, '.clawdao/project.json');
let config: ProjectConfig = {};
let configError: string | null = null;

if (!existsSync(configPath)) {
  configError = '.clawdao/project.json not found — using defaults';
  console.warn(`[start-all] ${configError}`);
} else {
  try {
    config = JSON.parse(readFileSync(configPath, 'utf-8'));
  } catch (e) {
    configError = `Invalid .clawdao/project.json: ${e}`;
    console.error(`[start-all] ${configError}`);
  }
}

const appName = config.name ?? 'ClawDao App';
const preferredApiPort = config.ports?.dev ?? 3000;
const preferredWebPort = config.ports?.web ?? 5173;

// ── 端口自动分配 ──

function isPortFree(port: number): boolean {
  try {
    const out = Bun.spawnSync(['lsof', `-ti:${port}`], { stdio: ['ignore', 'pipe', 'pipe'] });
    return !out.stdout.toString().trim();
  } catch {
    return true;
  }
}

function findAvailablePort(preferred: number): number {
  let port = preferred;
  for (let i = 0; i < 50; i++) {
    if (isPortFree(port)) return port;
    port += 1;
  }
  console.warn(`[start-all] ⚠ 找不到 ${preferred}+50 范围内的空闲端口，回退使用 ${preferred}`);
  return preferred;
}

const apiPort = Number(process.env.VF_PORT) || findAvailablePort(preferredApiPort);
const webPort = Number(process.env.VF_WEB_PORT) || findAvailablePort(preferredWebPort);

if ((apiPort !== preferredApiPort || webPort !== preferredWebPort) && !configError) {
  try {
    config.ports = { ...(config.ports || {}), dev: apiPort, web: webPort };
    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
    console.log(`[start-all] ↻ 端口自动调整并已回写 ${configPath}: dev=${apiPort} web=${webPort}`);
  } catch (e) {
    console.warn(`[start-all] ⚠ 端口回写失败（继续以 ${apiPort}/${webPort} 启动）: ${e}`);
  }
}

// ── 清理残留（只清自己记录的 PID，绝不误杀其他进程） ──

const PID_FILE = resolve(cwd, '.clawdao', '.running.pids');
const trackedPids: number[] = [];

function killStalePids(): void {
  try {
    if (!existsSync(PID_FILE)) return;
    const stale = readFileSync(PID_FILE, 'utf-8').trim().split(/\s+/).filter(Boolean);
    for (const pid of stale) {
      const n = Number(pid);
      if (!Number.isInteger(n) || n <= 0) continue;
      try {
        process.kill(n, 0);
        process.kill(n, 'SIGKILL');
        console.log(`[start-all] ↻ cleaned stale PID ${n}`);
      } catch { /* 已退出或无权 */ }
    }
  } catch { /* best-effort */ }
}

killStalePids();

// ── PID 文件 ──

function writePidFile() {
  try {
    writeFileSync(PID_FILE, trackedPids.join('\n'), 'utf-8');
  } catch { /* best-effort */ }
}

// ── 进程管理 ──

type Subprocess = import('bun').Subprocess;
const children: Subprocess[] = [];
const runningServices: { name: string; pid: number; url?: string }[] = [];

function cleanup(signal = 'SIGTERM') {
  console.log(`[start-all] Shutting down all services (${signal})...`);
  for (const proc of children) {
    if (proc.killed) continue;
    try { proc.kill(signal); } catch { /* ignore */ }
  }
  const timer = setTimeout(() => {
    console.log('[start-all] Force exit');
    process.exit(0);
  }, 3000);
  timer.unref();
}

process.on('SIGTERM', () => cleanup('SIGTERM'));
process.on('SIGINT', () => cleanup('SIGINT'));

async function startService(
  label: string,
  cmd: string[],
  opts: { url?: string; delay?: number; cwd?: string; env?: Record<string, string> } = {},
): Promise<Subprocess | null> {
  try {
    if (opts.delay) await new Promise((r) => setTimeout(r, opts.delay));
    const proc = Bun.spawn(cmd, {
      cwd: opts.cwd ?? cwd,
      stdio: ['ignore', 'inherit', 'inherit'],
      env: { ...process.env, ...(opts.env || {}) },
    });
    children.push(proc);
    trackedPids.push(proc.pid);
    writePidFile();
    runningServices.push({ name: label, pid: proc.pid, url: opts.url });
    console.log(`[start-all] ✓ ${label} (PID ${proc.pid})${opts.url ? ` → ${opts.url}` : ''}`);
    proc.exited.then((code: number | null) => {
      console.log(`[start-all] ✗ ${label} exited (code ${code})`);
      if (code !== 0 && code !== null) cleanup('SIGTERM');
    });
    return proc;
  } catch (e) {
    console.error(`[start-all] ✗ Failed to start ${label}:`, e);
    return null;
  }
}

// ── 1. 后端：node server/src/index.js ──

const serverEntry = ['server/src/index.js', 'src/index.js', 'index.js'].find((f) =>
  existsSync(resolve(cwd, f)),
);
if (serverEntry) {
  await startService('Backend', [NODE_BIN, serverEntry], {
    url: `http://127.0.0.1:${apiPort}`,
    env: { PORT: String(apiPort) }, // 显式注入后端端口，屏蔽外部 PORT 干扰
  });
} else {
  console.warn('[start-all] ⚠ 未找到后端入口文件（server/src/index.js），跳过后端');
}

// ── 2. 前端：web/ vite ──

const webDir = resolve(cwd, 'web');
if (existsSync(resolve(webDir, 'package.json'))) {
  await startService('Frontend', [NPM_BIN, 'exec', '--', 'vite', '--host', '--port', String(webPort)], {
    url: `http://localhost:${webPort}`,
    delay: 1200,
    cwd: webDir,
  });
} else {
  console.warn('[start-all] ⚠ 未找到 web/ 目录，跳过前端');
}

// ── 3. 打印入口地址 ──

console.log('');
console.log('═══════════════════════════════════════');
console.log(`  ${appName}`);
console.log(`  ${runningServices.length} service(s) running`);
for (const svc of runningServices) {
  console.log(`  ${svc.url ? `🔗 ${svc.url}` : `⚙️  ${svc.name} (PID ${svc.pid})`}`);
}
console.log('═══════════════════════════════════════');
console.log('');

// ── 等待子进程 ──

await Promise.race([...children.map((proc) => proc.exited)]);
cleanup('SIGTERM');
