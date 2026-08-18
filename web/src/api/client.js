import axios from 'axios';
import { message } from 'antd';

const client = axios.create({ baseURL: '/api', timeout: 30000 });

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('tcm_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const status = err.response && err.response.status;
    const msg = (err.response && err.response.data && err.response.data.message) || '网络请求失败';
    if (status === 401) {
      localStorage.removeItem('tcm_token');
      localStorage.removeItem('tcm_user');
      if (!location.pathname.startsWith('/login')) {
        message.warning('登录已过期，请重新登录');
        location.href = '/login';
      }
    }
    return Promise.reject(new Error(msg));
  }
);

// 带鉴权下载文件（导出/备份）
export async function downloadFile(url, filename) {
  const token = localStorage.getItem('tcm_token');
  const res = await axios.get('/api' + url, {
    responseType: 'blob',
    headers: { Authorization: `Bearer ${token}` },
  });
  const blobUrl = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(blobUrl);
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem('tcm_user') || 'null');
  } catch {
    return null;
  }
}

export default client;
