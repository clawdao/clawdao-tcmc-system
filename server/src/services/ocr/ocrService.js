/**
 * OCR 服务：可插拔 Provider 架构
 * - mock：内置演示 Provider。优先读取同名 .txt 旁车文件作为"识别结果"
 *         （例如上传 case1.jpg 时存在 case1.txt 则读取其内容），否则返回内置样例文本。
 * - http：对接外部 OCR HTTP API（OCR_ENDPOINT / OCR_API_KEY 环境变量配置）。
 */
const fs = require('fs');
const path = require('path');
const config = require('../../config');
const db = require('../../models/db');
const { parseOcrText } = require('./ocrParser');

const SAMPLE_TEXT = [
  '姓名：张三  性别：男  年龄：45岁',
  '日期：2026年8月10日',
  '主诉：胃脘胀痛反复发作3月余，加重1周。',
  '现病史：患者3月前因情志不舒出现胃脘胀痛，嗳气频作，每因情绪波动加重。',
  '望诊：面色如常，舌质淡红，苔薄白。',
  '切诊：脉弦细。',
  '中医诊断：胃脘痛',
  '证型：肝郁脾虚证',
  '治法：疏肝健脾，和胃止痛',
  '方剂：柴胡疏肝散加减',
  '柴胡10g 白芍15g 枳壳10g 香附10g',
  '陈皮6g 川芎10g 炙甘草6g',
  '剂数：7剂',
  '用法：每日一剂，水煎分早晚温服',
  '医嘱：忌食生冷辛辣，调畅情志',
  '医师：李医师',
].join('\n');

const mockProvider = {
  name: 'mock',
  async recognize(imagePath) {
    const sidecar = imagePath.replace(/\.[^.]+$/, '.txt');
    if (fs.existsSync(sidecar)) {
      return fs.readFileSync(sidecar, 'utf8');
    }
    return SAMPLE_TEXT;
  },
};

const httpProvider = {
  name: 'http',
  async recognize(imagePath) {
    if (!config.ocr.endpoint) throw new Error('OCR_ENDPOINT 未配置');
    const form = new FormData();
    form.append('image', new Blob([fs.readFileSync(imagePath)]), path.basename(imagePath));
    const headers = {};
    if (config.ocr.apiKey) headers['Authorization'] = `Bearer ${config.ocr.apiKey}`;
    const res = await fetch(config.ocr.endpoint, { method: 'POST', headers, body: form });
    if (!res.ok) throw new Error(`OCR 服务响应异常：HTTP ${res.status}`);
    const data = await res.json();
    const text = data.text || data.ocr_text || (data.data && data.data.text);
    if (!text) throw new Error('OCR 服务未返回识别文本');
    return text;
  },
};

const providers = { mock: mockProvider, http: httpProvider };

function getProvider() {
  const p = providers[config.ocr.provider];
  if (!p) throw new Error(`未知的 OCR Provider：${config.ocr.provider}`);
  return p;
}

function loadDict() {
  const rows = db.prepare('SELECT dict_type, name FROM dictionaries').all();
  return {
    herbs: rows.filter((r) => r.dict_type === 'herb').map((r) => r.name),
    diseases: rows.filter((r) => r.dict_type === 'disease').map((r) => r.name),
    syndromes: rows.filter((r) => r.dict_type === 'syndrome').map((r) => r.name),
    formulas: rows.filter((r) => r.dict_type === 'formula').map((r) => r.name),
  };
}

// 识别 + 结构化解析，返回 { ocrText, draft }
async function recognizeAndParse(imagePath) {
  const provider = getProvider();
  const ocrText = await provider.recognize(imagePath);
  const draft = parseOcrText(ocrText, loadDict());
  return { ocrText, draft };
}

module.exports = { recognizeAndParse, getProvider, SAMPLE_TEXT };
