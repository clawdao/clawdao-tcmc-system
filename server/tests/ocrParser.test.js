const test = require('node:test');
const assert = require('node:assert');
const { parseOcrText, parsePrescription, parseDate } = require('../src/services/ocr/ocrParser');

const DICT = {
  herbs: ['柴胡', '白芍', '枳壳', '香附', '陈皮', '川芎', '甘草', '黄芪', '当归', '桑叶', '菊花', '杏仁', '石膏'],
  diseases: ['胃脘痛', '咳嗽', '感冒', '眩晕'],
  syndromes: ['肝郁脾虚证', '风热犯肺证'],
  formulas: ['柴胡疏肝散', '桑菊饮'],
};

test('样例1：标准格式完整解析', () => {
  const text = [
    '姓名：张三  性别：男  年龄：45岁',
    '日期：2026年8月10日',
    '主诉：胃脘胀痛反复发作3月余，加重1周。',
    '望诊：舌质淡红，苔薄白。',
    '切诊：脉弦细。',
    '中医诊断：胃脘痛',
    '证型：肝郁脾虚证',
    '治法：疏肝健脾，和胃止痛',
    '方剂：柴胡疏肝散加减',
    '柴胡10g 白芍15g 枳壳10g 香附10g',
    '陈皮6g 川芎10g 炙甘草6g',
    '剂数：7剂',
    '用法：每日一剂，水煎分早晚温服',
    '医嘱：忌食生冷辛辣',
    '医师：李医师',
  ].join('\n');
  const r = parseOcrText(text, DICT);
  assert.equal(r.patient_name, '张三');
  assert.equal(r.gender, '男');
  assert.equal(r.age, 45);
  assert.equal(r.visit_date, '2026-08-10');
  assert.equal(r.tcm_diagnosis, '胃脘痛');
  assert.equal(r.syndrome, '肝郁脾虚证');
  assert.equal(r.treatment_principle, '疏肝健脾，和胃止痛');
  assert.equal(r.formula_name, '柴胡疏肝散加减');
  assert.equal(r.doses, 7);
  assert.equal(r.usage_text, '每日一剂，水煎分早晚温服');
  assert.equal(r.doctor_name, '李医师');
  const names = r.items.map((i) => i.herb_name);
  assert.deepEqual(names, ['柴胡', '白芍', '枳壳', '香附', '陈皮', '川芎', '甘草']);
  assert.equal(r.items[1].dosage, '15g');
});

test('样例2：一行多标签连排解析', () => {
  const text = '姓名：李四 性别：女 年龄：32岁\n主诉：咳嗽3天 诊断：咳嗽';
  const r = parseOcrText(text, DICT);
  assert.equal(r.patient_name, '李四');
  assert.equal(r.gender, '女');
  assert.equal(r.age, 32);
  assert.equal(r.chief_complaint, '咳嗽3天');
  assert.equal(r.tcm_diagnosis, '咳嗽');
});

test('样例3：无标签时字典兜底识别诊断/证型/方剂', () => {
  const text = '患者近日眩晕加重，辨证属肝郁脾虚证，拟柴胡疏肝散加减。黄芪20g 当归10g';
  const r = parseOcrText(text, DICT);
  assert.equal(r.tcm_diagnosis, '眩晕');
  assert.equal(r.syndrome, '肝郁脾虚证');
  assert.equal(r.formula_name, '柴胡疏肝散');
  assert.deepEqual(r.items.map((i) => i.herb_name), ['黄芪', '当归']);
});

test('样例4：脚注识别（先煎/后下）', () => {
  const items = parsePrescription('石膏30g先煎 薄荷6g后下', new Set(DICT.herbs));
  assert.equal(items[0].note, '先煎');
  assert.equal(items[1].note, '后下');
});

test('样例5：剂量单位与中文数字', () => {
  const items = parsePrescription('黄芪20克 当归三钱', new Set(DICT.herbs));
  assert.equal(items[0].dosage, '20g');
  const r = parseOcrText('剂数：七剂\n用法：水煎服', DICT);
  assert.equal(r.doses, 7);
});

test('parseDate 兼容多种日期写法', () => {
  assert.equal(parseDate('2026年8月10日'), '2026-08-10');
  assert.equal(parseDate('2026-08-10'), '2026-08-10');
  assert.equal(parseDate('2026/8/1'), '2026-08-01');
  assert.equal(parseDate('无日期'), null);
});
