# 中医医案管理系统 - 可执行 Todos 清单

> 配套文档：[design.md](./design.md)
> 使用方式：每个任务均可独立执行与验收，按阶段顺序推进；任务 ID 供进度跟踪引用。

---

## M1 基础骨架

### 1. 工程初始化

- [ ] T1.1 初始化 monorepo：根 package.json 配置 npm workspaces（server / web / cli 三个包）
- [ ] T1.2 初始化 server：安装 koa、koa-router、koa-bodyparser、koa-cors、koa-multer、jsonwebtoken、bcryptjs、better-sqlite3、node-cron、exceljs、zod
- [ ] T1.3 初始化 web：Vite + React 脚手架，安装 antd、@ant-design/icons、@ant-design/charts、axios、tailwindcss，配置 Tailwind 与 antd 主题共存
- [ ] T1.4 初始化 cli：commander 脚手架，预留 bin 入口 tcm-case
- [ ] T1.5 编写根目录 README：启动方式、目录说明、环境变量说明

### 2. 数据库

- [ ] T2.1 按 design.md 第 2.2 节编写 server/db/schema.sql 建表脚本（7 张表 + 索引）
- [ ] T2.2 编写 server/db/migrate.js：执行 schema、版本记录
- [ ] T2.3 编写 server/db/seed.js：初始 admin 账号 + 数据字典初始数据（常见疾病 50 条以上、常用中药 200 条以上、常见证型 30 条以上）
- [ ] T2.4 封装数据访问层 server/src/models/：db 连接单例 + 基础 CRUD 助手

### 3. 鉴权与用户

- [ ] T3.1 实现 POST /api/auth/login：bcrypt 校验 + 签发 JWT
- [ ] T3.2 实现 auth 中间件：JWT 校验、角色鉴权（admin / doctor / readonly）
- [ ] T3.3 实现用户管理接口 /api/users（admin 专属）：增删改查、重置密码
- [ ] T3.4 实现错误处理中间件：统一响应格式 { code, message, data }
- [ ] T3.5 实现参数校验中间件（zod）：登录、用户、医案等入参 schema

### 4. 医案 CRUD（后端）

- [ ] T4.1 实现 POST /api/cases：新建医案（含处方明细、图片关联，事务写入）
- [ ] T4.2 实现 GET /api/cases/:id：详情（主表 + 处方 + 图片 + 随访）
- [ ] T4.3 实现 PUT /api/cases/:id：更新（权限：本人或 admin）
- [ ] T4.4 实现 DELETE /api/cases/:id：软删除（归档）；admin 物理删除
- [ ] T4.5 实现 GET /api/cases：基础分页列表（先支持 dateFrom/dateTo/page/pageSize，组合筛选在 M3 补齐）
- [ ] T4.6 实现操作日志写入：增删改自动记录 operation_logs

### 5. 医案 CRUD（前端）

- [ ] T5.1 前端框架搭建：登录页 + 主布局（侧边菜单、Header、路由守卫）
- [ ] T5.2 封装 axios 实例：Token 注入、401 跳转登录、统一错误提示
- [ ] T5.3 医案列表页：表格 + 分页 + 基础日期筛选
- [ ] T5.4 医案编辑页：分步表单（Steps 六步），处方动态行编辑器（药名联想输入）
- [ ] T5.5 医案详情页：Descriptions 展示 + 处方表格 + 删除二次确认

**M1 验收标准**：可登录、可手工录入/编辑/删除/查询医案，前后端联调通过。

---

## M2 核心闭环：拍照上传 + OCR 建案

### 6. 图片上传与 OCR（后端）

- [ ] T6.1 实现 POST /api/cases/upload-image：multer 接收图片（类型/大小白名单校验），存入 server/uploads/
- [ ] T6.2 封装 OcrService：Provider 接口定义（recognize(imagePath) → text），实现云端 OCR Provider，预留本地模型 Provider，配置化切换
- [ ] T6.3 实现结构化解析器：关键词模板切分段落（主诉/诊断/处方等），字典实体识别，正则提取药名+剂量
- [ ] T6.4 上传接口返回：ocrText + 解析后的医案字段草稿；图片记录写入 case_images
- [ ] T6.5 编写解析器单元测试：5 份以上样例医案文本的字段映射正确性

### 7. 拍照上传建案（前端）

- [ ] T7.1 拍照上传页：Upload.Dragger 多图上传 + 预览
- [ ] T7.2 OCR 进度状态展示：待识别/识别中/已识别/失败重试
- [ ] T7.3 校对页：左侧原图、右侧预填表单的对照布局，确认后调用 POST /api/cases 提交
- [ ] T7.4 识别失败降级：跳转空白表单手工录入，图片作为附件随案保存

**M2 验收标准**：上传一张医案照片 → 自动识别预填 → 人工校对提交，全流程可走通。

---

## M3 检索与统计分析

### 8. 组合检索

- [ ] T8.1 扩展 GET /api/cases：disease（中/西医诊断）、herb（关联处方明细）、patient、syndrome、outcome、doctor、keyword 全文，多条件组合 + 参数化查询
- [ ] T8.2 列表页筛选区升级：全部筛选条件 + 字典联想下拉 + 已选条件标签展示
- [ ] T8.3 检索性能检查：组合查询走索引，造数 1 万条验证响应时间

### 9. 统计分析（后端）

- [ ] T9.1 GET /api/stats/overview：总量、本月新增、待随访数、今日新增
- [ ] T9.2 GET /api/stats/diseases：中医诊断 Top N
- [ ] T9.3 GET /api/stats/herbs：高频药物 Top N + 药对共现分析
- [ ] T9.4 GET /api/stats/syndromes、GET /api/stats/outcomes：证型分布、分疾病疗效构成
- [ ] T9.5 GET /api/stats/trend：按月/年医案量趋势；以上接口均支持时间范围参数

### 10. 统计看板与导出（前端）

- [ ] T10.1 统计分析页：多图表看板（柱/饼/折线/堆叠柱），时间范围筛选联动全部图表
- [ ] T10.2 GET /api/cases/export：筛选结果导出 xlsx/csv（exceljs），患者信息默认脱敏
- [ ] T10.3 列表页"导出"按钮：带当前筛选条件触发下载
- [ ] T10.4 单条医案导出 JSON

**M3 验收标准**：可按 8 个维度组合检索；统计看板 6 类图表数据正确；筛选结果可导出 Excel。

---

## M4 运维增强：备份 / 字典 / CLI

### 11. 数据备份

- [ ] T11.1 实现 BackupService：数据库 + uploads/ 打包为 tar.gz，命名含时间戳
- [ ] T11.2 POST /api/backup（手动触发）、GET /api/backup/list、备份文件下载接口
- [ ] T11.3 POST /api/backup/restore：恢复前自动快照当前状态
- [ ] T11.4 定时备份：node-cron 每日 02:00，保留最近 30 份（可配置）
- [ ] T11.5 前端系统管理页：备份列表、一键备份、恢复（高危操作二次确认）

### 12. 数据字典与日志

- [ ] T12.1 数据字典 CRUD 接口 /api/dicts（admin 写、登录读）
- [ ] T12.2 字典管理前端页：按类型分 Tab 维护，支持别名
- [ ] T12.3 操作日志查询接口 + 前端日志页（admin）

### 13. CLI 工具

- [ ] T13.1 CLI 基础框架：登录（Token 本地缓存）、API 请求封装
- [ ] T13.2 case list/get/create/upload/delete 命令
- [ ] T13.3 stats overview/herbs 命令（表格化输出）
- [ ] T13.4 export 命令（下载文件到本地）
- [ ] T13.5 backup create/list/restore 命令
- [ ] T13.6 import cases.xlsx：Excel 批量导入历史医案（模板校验 + 逐行错误报告）

**M4 验收标准**：手动/定时备份与恢复可用；字典、日志后台可用；CLI 全部命令与 Web 功能等价。

---

## M5 体验优化（增值功能）

- [ ] T14.1 处方模板：保存/套用模板（接口 + 编辑页"存为模板/套用模板"按钮）
- [ ] T14.2 复诊关联：同患者医案自动归组，详情页展示诊疗时间轴
- [ ] T14.3 随访管理：随访记录增删、待随访待办列表、工作台提醒
- [ ] T14.4 敏感信息脱敏细化：列表/导出脱敏 + 查看明文权限与日志
- [ ] T14.5 工作台首页：指标卡片 + 待办 + 快捷入口
- [ ] T14.6 端到端验收测试：核心流程回归 + 性能与安全检查清单过一遍

**M5 验收标准**：系统达到可交付试用状态。

---

## 优先级速览

| 优先级 | 任务 |
| --- | --- |
| P0（必须先做） | T1–T5（M1 全部）、T6–T7（M2 全部） |
| P1（核心价值） | T8–T10（检索统计）、T11（备份） |
| P2（生产保障） | T12–T13（字典/日志/CLI） |
| P3（锦上添花） | T14（M5 全部） |
