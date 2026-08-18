/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  // 与 antd 共存：关闭 preflight 避免样式冲突
  corePlugins: { preflight: false },
  theme: { extend: {} },
  plugins: [],
};
