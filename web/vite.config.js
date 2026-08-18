import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

// ── 端口自动适配：后端端口从 .clawdao/project.json ports.dev 读取（env VF_PORT 优先）──
// start-all.ts 每次启动会把实际端口回写到 manifest，前端代理自动跟随。
function resolveApiPort() {
  if (process.env.VF_PORT) return Number(process.env.VF_PORT) || 3000;
  try {
    const manifestPath = resolve(process.cwd(), '../.clawdao/project.json');
    if (existsSync(manifestPath)) {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      if (manifest?.ports?.dev) return Number(manifest.ports.dev);
    }
  } catch { /* ignore */ }
  return 3000;
}

const apiPort = resolveApiPort();
const apiTarget = `http://localhost:${apiPort}`;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': apiTarget,
      '/uploads': apiTarget,
    },
  },
});
