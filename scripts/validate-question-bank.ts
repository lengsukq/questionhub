import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAndValidate } from "../src/lib/import-question-bank";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourcePath = resolve(root, "data/question-bank.json");

const rawJson = readFileSync(sourcePath, "utf-8");
const report = parseAndValidate(rawJson);

console.log("========== 题库数据质量报告 ==========");

if (!report.ok || !report.data) {
  console.error("结构校验失败：");
  for (const error of report.errors) console.error(`  - ${error}`);
  process.exit(1);
}

const data = report.data;
console.log(`题库版本：${data.schemaVersion}`);
console.log(`生成时间：${data.generatedAt}`);
console.log(`题目总数：${report.questionCount}`);
console.log(`科目：`);
for (const subject of data.subjects) {
  const count = data.questions.filter((question) => question.subjectId === subject.id).length;
  console.log(`  - ${subject.name}（${subject.id}）：${count} 题`);
}

const typeCounts = new Map<string, number>();
const unitCounts = new Map<string, number>();
const chapterCounts = new Map<string, number>();
let provided = 0;
let sourceNotProvided = 0;
let needsReview = 0;
let hasSource = 0;

for (const question of data.questions) {
  typeCounts.set(question.type, (typeCounts.get(question.type) ?? 0) + 1);
  unitCounts.set(question.unit, (unitCounts.get(question.unit) ?? 0) + 1);
  const chapterKey = `${question.subjectId} / ${question.unit} / ${question.chapter}`;
  chapterCounts.set(chapterKey, (chapterCounts.get(chapterKey) ?? 0) + 1);
  if (question.explanationStatus === "provided") provided += 1;
  if (question.explanationStatus === "source_not_provided") sourceNotProvided += 1;
  if (question.quality?.needsReview) needsReview += 1;
  if (question.source) hasSource += 1;
}

console.log(`题型分布：`);
for (const [type, count] of typeCounts) console.log(`  - ${type}: ${count}`);
console.log(`单元分布：`);
for (const [unit, count] of unitCounts) console.log(`  - ${unit}: ${count}`);
console.log(`解析状态：原书解析 ${provided} · 未提供独立解析 ${sourceNotProvided}`);
console.log(`质量标记：needsReview ${needsReview} · 含来源信息 ${hasSource}`);
console.log(`章节/套卷数量：${chapterCounts.size}`);
console.log(`软性提示：${report.warnings.length} 条`);
for (const warning of report.warnings) console.log(`  - ${warning}`);

console.log("========== 报告结束 ==========");
process.exitCode = 0;
