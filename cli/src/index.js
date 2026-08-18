#!/usr/bin/env node
import { Command } from 'commander';
import * as cmd from './commands.js';

const program = new Command();

program
  .name('tcm-case')
  .description('中医医案管理系统命令行工具')
  .version('1.0.0');

const run = (fn) => async (...args) => {
  try {
    await fn(...args);
  } catch (err) {
    console.error(`错误：${err.message}`);
    process.exit(1);
  }
};

program
  .command('login')
  .description('登录并保存凭证')
  .option('-u, --username <username>', '用户名')
  .option('-p, --password <password>', '密码')
  .option('-s, --server <url>', '服务端地址，默认 http://localhost:3000')
  .action(run(cmd.login));

const caseCmd = program.command('case').description('医案操作');

caseCmd
  .command('list')
  .description('组合检索医案')
  .option('--disease <name>', '疾病名称')
  .option('--herb <name>', '药物名称')
  .option('--patient <name>', '病人姓名')
  .option('--from <date>', '开始日期 YYYY-MM-DD')
  .option('--to <date>', '结束日期 YYYY-MM-DD')
  .option('--syndrome <name>', '证型')
  .option('--outcome <name>', '疗效')
  .option('--doctor <name>', '医师')
  .option('--keyword <text>', '关键字')
  .option('--page <n>', '页码', '1')
  .option('--page-size <n>', '每页条数', '20')
  .action(run(cmd.caseList));

caseCmd.command('get <idOrCaseNo>').description('查看医案详情').action(run(cmd.caseGet));

caseCmd
  .command('create')
  .description('从 JSON 文件创建医案')
  .requiredOption('-f, --file <path>', '医案 JSON 文件')
  .action(run(cmd.caseCreate));

caseCmd.command('upload <image>').description('上传医案照片并 OCR 识别').action(run(cmd.caseUpload));

caseCmd
  .command('delete <idOrCaseNo>')
  .description('删除医案（默认归档）')
  .option('--hard', '物理删除（需管理员）')
  .action(run(cmd.caseDelete));

const statsCmd = program.command('stats').description('统计分析');
statsCmd.command('overview').description('总览统计').action(run(cmd.statsOverview));
statsCmd.command('herbs').description('高频药物与药对').option('--top <n>', 'Top N', '20').action(run(cmd.statsHerbs));

program
  .command('export')
  .description('导出筛选结果为 Excel/CSV')
  .option('--disease <name>', '疾病名称')
  .option('--herb <name>', '药物名称')
  .option('--patient <name>', '病人姓名')
  .option('--from <date>', '开始日期')
  .option('--to <date>', '结束日期')
  .option('--format <fmt>', '格式：xlsx / csv')
  .option('-o, --output <path>', '输出文件路径')
  .action(run(cmd.exportCases));

const backupCmd = program.command('backup').description('数据备份');
backupCmd.command('create').description('立即备份').action(run(cmd.backupCreate));
backupCmd.command('list').description('备份列表').action(run(cmd.backupList));
backupCmd.command('restore <name>').description('从备份恢复').action(run(cmd.backupRestore));

program
  .command('import <file>')
  .description('从 Excel 批量导入历史医案')
  .action(run(cmd.importCases));

program.parse();
