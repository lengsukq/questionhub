import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAndValidate } from "../src/lib/import-question-bank";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(root, "data/question-bank.json");
const targetDir = resolve(root, "public/data");
const targetPath = resolve(targetDir, "question-bank.json");

const rawJson = readFileSync(sourcePath, "utf-8");
const report = parseAndValidate(rawJson);

if (!report.ok || !report.data) {
  console.error("[题库准备失败] 默认题库未通过校验：");
  for (const error of report.errors) console.error(`  - ${error}`);
  process.exit(1);
}

mkdirSync(targetDir, { recursive: true });
writeFileSync(targetPath, rawJson, "utf-8");

const data = report.data;
console.log("默认题库校验与复制完成");
console.log(`  文件：data/question-bank.json → public/data/question-bank.json`);
console.log(`  题目总数：${report.questionCount}`);
console.log(`  科目：${data.subjects.map((subject) => `${subject.name}(${subject.id})`).join("、")}`);
console.log(`  题型：`);
for (const [type, count] of Object.entries(report.typeCounts)) {
  console.log(`    ${type}: ${count}`);
}
console.log(`  提示（软性问题）：${report.warnings.length} 条`);
if (report.warnings.length > 0) {
  for (const warning of report.warnings.slice(0, 10)) console.log(`    - ${warning}`);
  if (report.warnings.length > 10) console.log(`    ... 共 ${report.warnings.length} 条`);
}
