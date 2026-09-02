import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseAndValidate } from "../src/lib/import-question-bank";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = resolve(root, "data/banks");
const targetDir = resolve(root, "public/data/banks");

let files: string[] = [];
try {
  files = readdirSync(sourceDir).filter((f) => f.endsWith(".json")).sort();
} catch {
  console.log("[banks] data/banks 不存在，跳过");
  process.exit(0);
}

if (files.length === 0) {
  console.log("[banks] 无题库，跳过");
  process.exit(0);
}

mkdirSync(targetDir, { recursive: true });

let ok = 0;
for (const file of files) {
  const src = resolve(sourceDir, file);
  const raw = readFileSync(src, "utf-8");
  const report = parseAndValidate(raw);
  if (!report.ok || !report.data) {
    console.error(`[banks] 校验失败 ${file}: ${report.errors.join("；")}`);
    process.exit(1);
  }
  writeFileSync(resolve(targetDir, file), raw, "utf-8");
  ok++;
  console.log(`  [ok] ${file} -> public/data/banks/${file} (${report.questionCount}题)`);
}

// 索引清单
const manifest = files.map((file) => {
  const raw = readFileSync(resolve(sourceDir, file), "utf-8");
  const report = parseAndValidate(raw);
  const data = report.data!;
  const name = file.replace(/\.json$/i, "");
  return {
    file,
    name,
    questionCount: report.questionCount,
    subjects: data.subjects,
    typeCounts: report.typeCounts,
  };
});
writeFileSync(resolve(targetDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf-8");
console.log(`[banks] 已发布 ${ok} 个题库到 public/data/banks/ + manifest.json`);
