# clawdao-tcm-cases · 中医医案管理系统

> 中医诊所 / 科室的医案电子化与统计分析平台：**拍照上传 + OCR 识别 → 校对入库 → 多维检索 → 统计分析 → 数据备份**，一站式闭环。

![license](https://img.shields.io/badge/license-MIT-green) ![node](https://img.shields.io/badge/node-%3E%3D18-blue) ![sqlite](https://img.shields.io/badge/database-SQLite-orange)

## ✨ 功能特性

| 模块 | 能力 |
| --- | --- |
| 📸 **拍照建案** | 多图上传 → OCR 识别 → 字段预填 → 校对提交；失败可降级手工录入 |
| 📝 **医案 CRUD** | 基本信息 / 患者 / 四诊 / 诊断辨证 / 处方 / 疗效随访 六步表单，处方明细动态行编辑 |
| 🔍 **组合检索** | 疾病 / 药物 / 患者 / 证型 / 疗效 / 医师 / 时间 / 关键字 8 维并联检索 |
| 📊 **统计分析** | 总览看板、Top 疾病、Top 药物 / 药对、证型分布、疗效构成、月度趋势 |
| 📤 **数据导出** | 筛选结果 xlsx / csv、单条 JSON；默认脱敏患者信息 |
| 💾 **数据备份** | 手动 + 定时（默认每日 02:00）打包 db + uploads；恢复前自动快照 |
| 🗂️ **数据字典** | 疾病 / 中药 / 证型 / 方剂维护，支持别名 |
| 🔐 **用户权限** | admin / doctor / readonly 三级，操作日志全程留痕 |
| 💎 **增值能力** | 处方模板、复诊时间轴、随访待办、工作台首页 |
| ⌨️ **CLI 工具** | `tcm-case` 命令行等价覆盖 Web 功能，支持 Excel 批量导入 |

## 🏗️ 技术栈

- **后端**：Node.js (Koa) + better-sqlite3 + JWT
- **前端**：React + Ant Design + Tailwind CSS + Vite
- **数据库**：SQLite（本地文件，零运维）
- **CLI**：Commander.js，与 Web 双通道

## 🚀 快速开始

```bash
# 安装全部工作区依赖（server / web / cli）
npm install

# 初始化数据库（建表 + 初始 admin + 数据字典）
npm run db:init

# 终端 1：后端（默认 http://localhost:3000）
npm run dev:server

# 终端 2：前端（默认 http://localhost:5173）
npm run dev:web
```

浏览器访问 `http://localhost:5173`，初始管理员：`admin / admin123`（**首次登录后请立即修改**）。

> 🔧 平台启动：项目内置 `scripts/start-all.ts`（ClawDao 标准启动器），自动处理前后端启动与端口分配。

## ⚙️ 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3000` | 后端端口 |
| `JWT_SECRET` | `dev-only-insecure-secret-change-me` | **生产务必替换** |
| `DB_FILE` | `server/db/tcm-case.db` | SQLite 路径 |
| `UPLOAD_DIR` / `BACKUP_DIR` | `server/uploads` / `server/backups` | 上传 / 备份目录 |
| `BACKUP_CRON` / `BACKUP_KEEP` | `0 2 * * *` / `30` | 定时备份 cron / 保留份数 |
| `OCR_PROVIDER` | `mock` | `mock` 内置演示 / `http` 外部 OCR |
| `SEED_ADMIN_PASSWORD` | `admin123` | 初始化 admin 密码覆盖值 |

## 🧰 CLI 工具

```bash
tcm-case login -u admin -p admin123      # 登录
tcm-case case list --disease 感冒         # 医案检索
tcm-case case upload ./paper-case.jpg    # 拍照 OCR 建案
tcm-case stats herbs --top 30            # 用药统计
tcm-case export --format xlsx -o out.xlsx # 导出
tcm-case backup create                   # 备份
tcm-case import ./cases.xlsx             # Excel 批量导入
```

## 📁 目录结构

```
.
├── server/    # 后端：Koa + better-sqlite3（config/middlewares/models/routes/services/utils）
├── web/       # 前端：Vite + React + Ant Design + Tailwind
├── cli/       # CLI：tcm-case 命令行工具
├── docs/      # design.md（架构设计）/ todos.md（执行清单）
└── scripts/   # start-all.ts（ClawDao 标准启动器，端口自动分配）
```

## 📚 相关文档

- 详细架构与接口设计：[`docs/design.md`](docs/design.md)
- 执行清单：[`docs/todos.md`](docs/todos.md)

## ⚖️ 许可

MIT — 本项目仅作为中医医案管理系统设计参考，临床落地请遵循所在地区医疗数据合规要求。
