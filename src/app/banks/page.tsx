"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  ChevronRight,
  FileUp,
  HardDriveDownload,
  Info,
  Trash2,
  Upload,
} from "lucide-react";
import { useBankStore } from "@/stores/bank-store";
import { parseAndValidate, type ValidationReport } from "@/lib/import-question-bank";
import type { QuestionBankInput } from "@/lib/question-bank-schema";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ImportPhase = "idle" | "parsing" | "parsed" | "importing" | "done" | "error";

export default function BanksPage() {
  const router = useRouter();
  const { banks, activeBankId, setActiveBank, importBank, removeBank } = useBankStore();

  const [importOpen, setImportOpen] = useState(false);
  const [phase, setPhase] = useState<ImportPhase>("idle");
  const [fileName, setFileName] = useState("");
  const [report, setReport] = useState<(ValidationReport & { data?: QuestionBankInput }) | null>(null);
  const [importError, setImportError] = useState("");
  const [importedName, setImportedName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setPhase("parsing");
    setImportError("");
    setReport(null);

    try {
      const rawJson = await file.text();
      const result = parseAndValidate(rawJson);
      if (!result.ok || !result.data) {
        setPhase("error");
        setImportError(result.errors.join("；") || "题库结构不符合规范");
        return;
      }
      setReport(result);
      setPhase("parsed");
    } catch (error) {
      setPhase("error");
      setImportError(error instanceof Error ? error.message : String(error));
    }
  };

  const handleImport = async () => {
    if (!fileInputRef.current?.files?.[0] || !report?.data) return;
    setPhase("importing");
    try {
      const rawJson = await fileInputRef.current.files[0].text();
      const result = await importBank(rawJson, fileName.replace(/\.json$/i, "") || "导入题库");
      if (result.ok) {
        setImportedName(result.bank?.name ?? fileName);
        setPhase("done");
      } else {
        setPhase("error");
        setImportError(result.errors.join("；") || "导入失败");
      }
    } catch (error) {
      setPhase("error");
      setImportError(error instanceof Error ? error.message : String(error));
    }
  };

  const handleRemove = async (bankId: string) => {
    if (!window.confirm("确定删除该题库吗？该题库下的学习记录将一并删除。")) return;
    try {
      await removeBank(bankId);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : String(error));
    }
  };

  const resetImport = () => {
    setPhase("idle");
    setReport(null);
    setImportError("");
    setFileName("");
    setImportedName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="safe-top">
      <PageHeader title="题库" onBack={() => router.push("/")} />

      <div className="space-y-3 px-4 pt-4">
        {banks.map((bank) => {
          const isActive = bank.id === activeBankId;
          return (
            <Card key={bank.id} className={cn(isActive && "ring-1 ring-ios-blue/40")}>
              <div className="flex items-center justify-between px-4 pt-4">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-xl",
                    isActive ? "bg-ios-blue/10 text-ios-blue" : "bg-ios-surface-tertiary text-ios-label-secondary",
                  )}>
                    <HardDriveDownload className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-[16px] font-semibold">{bank.name}</p>
                    <p className="text-[12px] text-ios-label-secondary">
                      {bank.questionCount} 题 · 导入于 {new Date(bank.importedAt).toLocaleDateString("zh-CN")}
                    </p>
                  </div>
                </div>
                {isActive && <Badge color="blue">使用中</Badge>}
                {bank.isDefault && !isActive && <Badge color="gray">内置</Badge>}
              </div>

              <div className="flex flex-wrap gap-1.5 px-4 pt-3">
                {bank.subjects.map((subject) => (
                  <span
                    key={subject.id}
                    className="rounded-lg bg-ios-surface-secondary px-2 py-1 text-[12px] text-ios-label-secondary dark:bg-ios-surface-tertiary"
                  >
                    {subject.name}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between px-4 pb-4 pt-3">
                {isActive ? (
                  <Link
                    href={`/banks/${bank.id}`}
                    className="flex items-center text-[14px] font-medium text-ios-blue"
                  >
                    进入题库 <ChevronRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setActiveBank(bank.id)}
                      className="text-[14px] font-medium text-ios-blue"
                    >
                      切换到此题库
                    </button>
                    {!bank.isDefault && (
                      <button
                        onClick={() => handleRemove(bank.id)}
                        className="flex items-center gap-1 text-[13px] text-ios-red"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> 删除
                      </button>
                    )}
                  </div>
                )}
              </div>
            </Card>
          );
        })}

        <button
          onClick={() => {
            resetImport();
            setImportOpen(true);
          }}
          className="row-active flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-ios-blue/30 py-5 text-[15px] font-medium text-ios-blue"
        >
          <FileUp className="h-5 w-5" />
          导入新题库
        </button>

        <p className="px-2 pb-2 text-[12px] leading-relaxed text-ios-label-tertiary">
          支持导入符合 QuestionBank Schema 的 JSON 题库文件（需包含顶层 questions 数组）。导入后数据保存在当前设备浏览器中。
        </p>
      </div>

      {/* 导入弹层 */}
      <Sheet
        open={importOpen}
        onClose={() => {
          setImportOpen(false);
          resetImport();
        }}
        title="导入题库"
      >
        {phase === "idle" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-ios-blue/10">
              <Upload className="h-8 w-8 text-ios-blue" />
            </div>
            <p className="text-center text-[15px] text-ios-label-secondary">
              选择 JSON 格式的题库文件
              <br />
              将校验结构并生成导入报告
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button onClick={() => fileInputRef.current?.click()}>选择文件</Button>
          </div>
        )}

        {(phase === "parsing" || phase === "importing") && (
          <div className="flex flex-col items-center gap-3 py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-ios-surface-tertiary border-t-ios-blue" />
            <p className="text-[14px] text-ios-label-secondary">
              {phase === "parsing" ? "正在解析并校验题库…" : "正在导入题库…"}
            </p>
          </div>
        )}

        {phase === "parsed" && report && (
          <div className="space-y-4 py-2">
            <div className="flex items-start gap-3 rounded-2xl bg-ios-green/8 p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-ios-green" />
              <div>
                <p className="text-[15px] font-semibold">校验通过</p>
                <p className="mt-1 text-[13px] leading-relaxed text-ios-label-secondary">
                  {report.questionCount} 道题 · {Object.keys(report.typeCounts).length} 种题型
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {Object.entries(report.typeCounts).map(([type, count]) => (
                <span key={type} className="rounded-lg bg-ios-surface-secondary px-2 py-1 text-[12px] dark:bg-ios-surface-tertiary">
                  {typeLabel(type)} {count} 题
                </span>
              ))}
            </div>

            {report.warnings.length > 0 && (
              <div className="rounded-2xl bg-ios-orange/8 p-4">
                <div className="flex items-center gap-2 text-[14px] font-medium text-ios-orange">
                  <Info className="h-4 w-4" />
                  {report.warnings.length} 条提示（可忽略）
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-[13px] text-ios-orange">查看详情</summary>
                  <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                    {report.warnings.slice(0, 30).map((warning, index) => (
                      <li key={index} className="text-[12px] leading-relaxed text-ios-label-secondary">
                        {warning}
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            )}

            <Button className="w-full" onClick={handleImport}>
              确认导入
            </Button>
          </div>
        )}

        {phase === "error" && (
          <div className="space-y-4 py-2">
            <div className="rounded-2xl bg-ios-red/8 p-4 text-[14px] leading-relaxed text-ios-red">
              {importError}
            </div>
            <Button variant="secondary" className="w-full" onClick={resetImport}>
              重新选择文件
            </Button>
          </div>
        )}

        {phase === "done" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-ios-green/10">
              <CheckCircle2 className="h-9 w-9 text-ios-green" />
            </div>
            <p className="text-center text-[16px] font-semibold">
              「{importedName}」导入成功
            </p>
            <div className="flex w-full gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setImportOpen(false)}
              >
                完成
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  const bank = useBankStore.getState().banks.find((item) => item.name === importedName);
                  setImportOpen(false);
                  if (bank) router.push(`/banks/${bank.id}`);
                }}
              >
                进入题库
              </Button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}

function typeLabel(type: string): string {
  const labels: Record<string, string> = {
    single_choice: "单选",
    multiple_choice: "多选",
    true_false: "判断",
    short_answer: "简答",
    comprehensive: "综合",
    calculation_analysis: "计算",
  };
  return labels[type] ?? type;
}
