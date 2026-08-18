/**
 * 医案字段元数据（服务端唯一权威定义）
 * 【重构标记 REFACTOR-CASE-FIELDS】
 * 医案字段若有增删改，请优先修改本文件，并同步：
 *   1. server/db/schema.sql 的 medical_cases 表结构
 *   2. web/src/config/caseFields.js（前端表单与展示）
 * 全局搜索 "REFACTOR-CASE-FIELDS" 可找到所有关联位置。
 */

// 文本类字段（medical_cases 主表列名）
const TEXT_FIELDS = [
  'case_type', 'doctor_name', 'source', 'patient_name', 'gender',
  'phone', 'past_history', 'chief_complaint', 'present_illness',
  'inspection', 'auscultation', 'inquiry', 'palpation',
  'tcm_diagnosis', 'western_diagnosis', 'syndrome', 'treatment_principle',
  'formula_name', 'usage_text', 'advice', 'outcome', 'commentary', 'remark',
];

const NUMBER_FIELDS = ['age', 'doses'];

const DATE_FIELDS = ['visit_date'];

// 全部可写字段（不含系统字段 id/case_no/status/created_by/created_at/updated_at）
const WRITABLE_FIELDS = [...TEXT_FIELDS, ...NUMBER_FIELDS, ...DATE_FIELDS];

const ENUMS = {
  caseType: ['初诊', '复诊'],
  gender: ['男', '女'],
  outcome: ['痊愈', '显效', '有效', '无效', '未随访'],
  source: ['拍照上传', '手工录入', '批量导入'],
  status: ['正常', '草稿', '已归档'],
};

// 列表/导出中需要脱敏的字段
const SENSITIVE_FIELDS = ['patient_name', 'phone'];

module.exports = { TEXT_FIELDS, NUMBER_FIELDS, DATE_FIELDS, WRITABLE_FIELDS, ENUMS, SENSITIVE_FIELDS };
