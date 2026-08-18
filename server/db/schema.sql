-- 中医医案管理系统数据库结构
-- 【重构标记 REFACTOR-CASE-FIELDS】医案字段如有调整，请同步修改：
--   1. 本文件 medical_cases 表
--   2. server/src/config/caseFields.js（字段元数据唯一来源）
--   3. web/src/config/caseFields.js（前端表单/展示配置）

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  real_name TEXT,
  role TEXT DEFAULT 'doctor' CHECK(role IN ('admin','doctor','readonly')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS medical_cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_no TEXT UNIQUE NOT NULL,
  visit_date DATE NOT NULL,
  case_type TEXT DEFAULT '初诊',
  doctor_name TEXT,
  source TEXT DEFAULT '手工录入',
  patient_name TEXT NOT NULL,
  gender TEXT,
  age INTEGER,
  phone TEXT,
  past_history TEXT,
  chief_complaint TEXT,
  present_illness TEXT,
  inspection TEXT,
  auscultation TEXT,
  inquiry TEXT,
  palpation TEXT,
  tcm_diagnosis TEXT,
  western_diagnosis TEXT,
  syndrome TEXT,
  treatment_principle TEXT,
  formula_name TEXT,
  doses INTEGER,
  usage_text TEXT,
  advice TEXT,
  outcome TEXT DEFAULT '未随访',
  commentary TEXT,
  remark TEXT,
  status TEXT DEFAULT '正常' CHECK(status IN ('正常','草稿','已归档')),
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS prescription_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER NOT NULL REFERENCES medical_cases(id) ON DELETE CASCADE,
  herb_name TEXT NOT NULL,
  dosage TEXT,
  note TEXT,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS case_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER REFERENCES medical_cases(id) ON DELETE SET NULL,
  image_path TEXT NOT NULL,
  ocr_text TEXT,
  ocr_status TEXT DEFAULT '待识别' CHECK(ocr_status IN ('待识别','已识别','识别失败','已校对')),
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS follow_ups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id INTEGER NOT NULL REFERENCES medical_cases(id) ON DELETE CASCADE,
  follow_date DATE NOT NULL,
  content TEXT,
  outcome TEXT
);

CREATE TABLE IF NOT EXISTS dictionaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dict_type TEXT NOT NULL CHECK(dict_type IN ('disease','herb','syndrome','formula')),
  name TEXT NOT NULL,
  alias TEXT,
  category TEXT,
  UNIQUE(dict_type, name)
);

CREATE TABLE IF NOT EXISTS operation_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id INTEGER,
  detail TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS prescription_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  formula_name TEXT,
  usage_text TEXT,
  advice TEXT,
  items TEXT,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cases_tcm_diagnosis ON medical_cases(tcm_diagnosis);
CREATE INDEX IF NOT EXISTS idx_cases_patient_name ON medical_cases(patient_name);
CREATE INDEX IF NOT EXISTS idx_cases_visit_date ON medical_cases(visit_date);
CREATE INDEX IF NOT EXISTS idx_cases_status ON medical_cases(status);
CREATE INDEX IF NOT EXISTS idx_prescription_herb ON prescription_items(herb_name);
CREATE INDEX IF NOT EXISTS idx_prescription_case ON prescription_items(case_id);
CREATE INDEX IF NOT EXISTS idx_logs_created ON operation_logs(created_at);
