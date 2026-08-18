/**
 * 医案字段元数据（前端表单与展示的唯一来源）
 * 【重构标记 REFACTOR-CASE-FIELDS】
 * 医案字段若有增删改，请优先修改本文件，并同步：
 *   1. server/src/config/caseFields.js（服务端字段定义）
 *   2. server/db/schema.sql 的 medical_cases 表结构
 * 全局搜索 "REFACTOR-CASE-FIELDS" 可找到所有关联位置。
 */

// 分步表单的步骤定义
export const FORM_STEPS = [
  { key: 'basic', title: '基本信息' },
  { key: 'patient', title: '患者信息' },
  { key: 'diagnosis4', title: '四诊信息' },
  { key: 'diagnosis', title: '诊断辨证' },
  { key: 'prescription', title: '处方信息' },
  { key: 'outcome', title: '疗效随访' },
];

// type: input | textarea | number | date | select | dictSelect
// dictType 用于 dictSelect（联动数据字典联想）
export const FIELD_GROUPS = {
  basic: [
    { name: 'visit_date', label: '就诊日期', type: 'date', required: true },
    { name: 'case_type', label: '医案类型', type: 'select', options: ['初诊', '复诊'], initial: '初诊' },
    { name: 'doctor_name', label: '接诊医师', type: 'input' },
    { name: 'source', label: '医案来源', type: 'select', options: ['手工录入', '拍照上传', '批量导入'], initial: '手工录入' },
  ],
  patient: [
    { name: 'patient_name', label: '患者姓名', type: 'input', required: true },
    { name: 'gender', label: '性别', type: 'select', options: ['男', '女'] },
    { name: 'age', label: '年龄', type: 'number', min: 0, max: 150 },
    { name: 'phone', label: '联系电话', type: 'input' },
    { name: 'past_history', label: '既往史', type: 'textarea', span: 2 },
  ],
  diagnosis4: [
    { name: 'chief_complaint', label: '主诉', type: 'textarea', span: 2 },
    { name: 'present_illness', label: '现病史', type: 'textarea', span: 2 },
    { name: 'inspection', label: '望诊（神色/舌象）', type: 'textarea', span: 2 },
    { name: 'auscultation', label: '闻诊', type: 'textarea', span: 2 },
    { name: 'inquiry', label: '问诊', type: 'textarea', span: 2 },
    { name: 'palpation', label: '切诊（脉象）', type: 'textarea', span: 2 },
  ],
  diagnosis: [
    { name: 'tcm_diagnosis', label: '中医诊断', type: 'dictSelect', dictType: 'disease' },
    { name: 'western_diagnosis', label: '西医诊断', type: 'input' },
    { name: 'syndrome', label: '证型', type: 'dictSelect', dictType: 'syndrome' },
    { name: 'treatment_principle', label: '治法', type: 'input' },
  ],
  prescription: [
    { name: 'formula_name', label: '方剂名称', type: 'dictSelect', dictType: 'formula' },
    { name: 'doses', label: '剂数', type: 'number', min: 1, max: 90 },
    { name: 'usage_text', label: '用法用量', type: 'input', span: 2 },
    { name: 'advice', label: '医嘱', type: 'textarea', span: 2 },
  ],
  outcome: [
    { name: 'outcome', label: '疗效', type: 'select', options: ['未随访', '痊愈', '显效', '有效', '无效'], initial: '未随访' },
    { name: 'commentary', label: '按语', type: 'textarea', span: 2 },
    { name: 'remark', label: '备注', type: 'textarea', span: 2 },
  ],
};

// 详情页展示分组（label 与字段映射）
export const DETAIL_GROUPS = [
  { title: '基本信息', fields: [['case_no', '医案编号'], ['visit_date', '就诊日期'], ['case_type', '医案类型'], ['doctor_name', '接诊医师'], ['source', '医案来源']] },
  { title: '患者信息', fields: [['patient_name', '患者姓名'], ['gender', '性别'], ['age', '年龄'], ['phone', '联系电话'], ['past_history', '既往史']] },
  { title: '四诊信息', fields: [['chief_complaint', '主诉'], ['present_illness', '现病史'], ['inspection', '望诊'], ['auscultation', '闻诊'], ['inquiry', '问诊'], ['palpation', '切诊']] },
  { title: '诊断辨证', fields: [['tcm_diagnosis', '中医诊断'], ['western_diagnosis', '西医诊断'], ['syndrome', '证型'], ['treatment_principle', '治法']] },
  { title: '处方信息', fields: [['formula_name', '方剂名称'], ['doses', '剂数'], ['usage_text', '用法用量'], ['advice', '医嘱']] },
  { title: '疗效随访', fields: [['outcome', '疗效'], ['commentary', '按语'], ['remark', '备注']] },
];
