/**
 * OCR 文本结构化解析器
 * 将识别出的医案纯文本映射为医案字段草稿。
 * 纯函数设计，便于单元测试；词典（中药/疾病/证型/方剂）由调用方注入。
 * 【重构标记 REFACTOR-CASE-FIELDS】新增字段后在此补充关键词映射。
 */

// 字段关键词映射：field -> [可能的书写标签]
const SECTION_LABELS = [
  ['patient_name', ['姓名', '患者姓名', '病人姓名']],
  ['gender', ['性别']],
  ['age', ['年龄']],
  ['phone', ['电话', '联系电话', '手机']],
  ['past_history', ['既往史', '既往病史']],
  ['chief_complaint', ['主诉']],
  ['present_illness', ['现病史', '病史']],
  ['inspection', ['望诊', '舌象', '舌诊']],
  ['auscultation', ['闻诊']],
  ['inquiry', ['问诊']],
  ['palpation', ['切诊', '脉象', '脉诊']],
  ['tcm_diagnosis', ['中医诊断', '诊断']],
  ['western_diagnosis', ['西医诊断']],
  ['syndrome', ['证型', '辨证', '辨证分型']],
  ['treatment_principle', ['治法', '治则']],
  ['formula_name', ['方剂', '方名', '处方名']],
  ['doses', ['剂数', '付数', '帖数']],
  ['usage_text', ['用法', '用法用量', '煎服法', '服法']],
  ['advice', ['医嘱', '注意事项', '调护']],
  ['doctor_name', ['医师', '医生', '医案医师', '签名']],
  ['visit_date', ['日期', '就诊日期', '时间']],
  ['commentary', ['按语', '按', '体会']],
];

const LABEL_TO_FIELD = new Map();
for (const [field, labels] of SECTION_LABELS) {
  for (const label of labels) LABEL_TO_FIELD.set(label, field);
}
// 按标签长度降序，保证"中医诊断"优先于"诊断"匹配
const ALL_LABELS = [...LABEL_TO_FIELD.keys()].sort((a, b) => b.length - a.length);

const CHINESE_NUM = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };

function parseDate(text) {
  const m = text.match(/(\d{4})[年\-\/\.](\d{1,2})[月\-\/\.](\d{1,2})/);
  if (!m) return null;
  return `${m[1]}-${String(m[2]).padStart(2, '0')}-${String(m[3]).padStart(2, '0')}`;
}

function parseAge(text) {
  const m = text.match(/(\d{1,3})\s*岁?/) || text.match(/([一二三四五六七八九十]{1,3})岁/);
  if (!m) return null;
  if (/^\d+$/.test(m[1])) return Number(m[1]);
  return CHINESE_NUM[m[1]] || null;
}

function parseDoses(text) {
  const m = text.match(/(\d+)\s*[剂付帖]/) || text.match(/([一二三四五六七八九十两])\s*[剂付帖]/);
  if (!m) return null;
  if (/^\d+$/.test(m[1])) return Number(m[1]);
  return CHINESE_NUM[m[1]] || null;
}

// 药名 + 剂量正则：如 "黄芪15g" "当归 10g" "生石膏30g先煎"
// 注意：脚注另算，否则尾部分组会把下一个药名吞掉
const HERB_LINE_RE = /([一-龥]{1,8}?)\s*(\d+(?:\.\d+)?)\s*(g|克|钱|两)/g;
const FOOTNOTES = ['先煎', '后下', '烊化', '包煎', '冲服', '另煎', '久煎'];

function parsePrescription(text, herbDict) {
  const items = [];
  const seen = new Set();
  let m;
  HERB_LINE_RE.lastIndex = 0;
  while ((m = HERB_LINE_RE.exec(text)) !== null) {
    let [, name, num, unit] = m;
    name = name.replace(/^[处方药用和与及加减，、。\s]+/, '');
    if (!name) continue;
    // 优先匹配词典药名；不命中时尝试后缀（处理"生黄芪"类前缀修饰）
    let herb = herbDict.has(name) ? name : null;
    if (!herb) {
      for (let cut = 1; cut < name.length; cut++) {
        const sub = name.slice(cut);
        if (herbDict.has(sub)) { herb = sub; break; }
      }
    }
    if (!herb) herb = name; // 词典未命中也保留，交给人工校对
    const dosage = `${num}${unit === '克' ? 'g' : unit}`;
    const after = text.slice(HERB_LINE_RE.lastIndex);
    const note = FOOTNOTES.find((f) => after.startsWith(f)) || null;
    const key = herb + dosage;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ herb_name: herb, dosage, note });
  }
  return items;
}

/**
 * 解析 OCR 文本为医案字段草稿
 * @param {string} text OCR 原文
 * @param {{herbs?: string[], diseases?: string[], syndromes?: string[], formulas?: string[]}} dict
 */
function parseOcrText(text, dict = {}) {
  const herbDict = new Set(dict.herbs || []);
  const diseaseDict = dict.diseases || [];
  const syndromeDict = dict.syndromes || [];
  const formulaDict = dict.formulas || [];

  const result = {};
  const lines = String(text).split(/\r?\n/);

  let currentField = null;
  const looseLabelRe = new RegExp(`(${ALL_LABELS.join('|')})\\s*[:：]\\s*`);
  const APPENDABLE = ['chief_complaint', 'present_illness', 'inspection', 'inquiry', 'advice', 'commentary'];
  const append = (field, content) => {
    result[field] = result[field] ? result[field] + '\n' + content : content;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    // 统一按"标签：内容"切分，兼容一行多个标签（如"姓名：张三 性别：男"）
    const parts = line.split(looseLabelRe).filter((s) => s !== '');
    let i = 0;
    if (!LABEL_TO_FIELD.has(parts[0])) {
      // 行首无标签：作为上一段落的续行
      if (currentField && APPENDABLE.includes(currentField) && parts.length === 1) {
        append(currentField, parts[0]);
        continue;
      }
      if (!LABEL_TO_FIELD.has(parts[0])) i = 1;
    }
    for (; i < parts.length; i += 2) {
      const field = LABEL_TO_FIELD.get(parts[i]);
      const content = (parts[i + 1] || '').trim();
      if (field) currentField = field;
      if (field && content) {
        append(field, content);
      }
    }
  }

  // 类型规整
  if (result.visit_date) result.visit_date = parseDate(result.visit_date) || result.visit_date;
  if (result.age) result.age = parseAge(result.age);
  if (result.doses) result.doses = parseDoses(result.doses);
  if (result.gender) result.gender = result.gender.includes('女') ? '女' : '男';
  if (result.phone) result.phone = (result.phone.match(/\d[\d\-]{5,}/) || [null])[0];
  if (result.patient_name) result.patient_name = result.patient_name.split(/[\s，,]/)[0];
  if (!result.visit_date) result.visit_date = parseDate(text) || undefined;

  // 字典实体识别兜底
  if (!result.tcm_diagnosis) result.tcm_diagnosis = diseaseDict.find((d) => text.includes(d)) || undefined;
  if (!result.syndrome) result.syndrome = syndromeDict.find((s) => text.includes(s)) || undefined;
  if (!result.formula_name) result.formula_name = formulaDict.find((f) => text.includes(f)) || undefined;

  result.items = parsePrescription(text, herbDict);

  // 清理空值
  for (const k of Object.keys(result)) {
    if (result[k] === undefined || result[k] === '' || result[k] === null) delete result[k];
  }
  return result;
}

module.exports = { parseOcrText, parsePrescription, parseDate, SECTION_LABELS };
