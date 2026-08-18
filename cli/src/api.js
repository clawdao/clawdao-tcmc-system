import axios from 'axios';
import fs from 'fs';
import os from 'os';
import path from 'path';

const CONFIG_FILE = path.join(os.homedir(), '.tcm-case.json');

export function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return { server: process.env.TCM_SERVER || 'http://localhost:3000', token: null };
  }
}

export function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), { mode: 0o600 });
}

export function getServer() {
  return process.env.TCM_SERVER || loadConfig().server || 'http://localhost:3000';
}

export function client() {
  const cfg = loadConfig();
  const instance = axios.create({ baseURL: `${getServer()}/api`, timeout: 60000 });
  if (cfg.token) instance.defaults.headers.common.Authorization = `Bearer ${cfg.token}`;
  instance.interceptors.response.use(
    (res) => res.data,
    (err) => {
      const msg = err.response?.data?.message || err.message;
      if (err.response?.status === 401) {
        console.error('登录已过期，请先执行：tcm-case login');
      }
      throw new Error(msg);
    }
  );
  return instance;
}
