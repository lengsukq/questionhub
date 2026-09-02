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
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { useBankStore } from "@/stores/bank-store";
import { parseAndValidate, type ValidationReport } from "@/lib/import-question-bank";
import type { QuestionBankInput } from "@/lib/question-bank-schema";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
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
    <div className="min-h-dvh safe-top">
      <PageHeader
        title="题库中心"
        subtitle="管理与切换本地题库，支持一键导入 JSON 题库"
        right={
          <Button
            size="sm"
            onClick={() => {
              resetImport();
              setImportOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            导入题库
          </Button>
        }
      />

      <div className="mx-auto max-w-6xl px-4 py-6">
        {/* 题库卡片响应式网格 */}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {banks.map((bank) => {
            const isActive = bank.id === activeBankId;
            return (
              <Card
                key={bank.id}
                className={cn(
                  "relative overflow-hidden flex flex-col justify-between p-6 transition-all duration-300",
                  isActive
                    ? "border-ios-blue/40 bg-gradient-to-br from-ios-blue/8 via-ios-surface to-ios-surface ring-2 ring-ios-blue/30 shadow-lg shadow-ios-blue/5"
                    : "hover:border-ios-blue/30 hover:shadow-md",
                )}
              >
                {/* 绝对定位印章标志（完全不占据布局空间） */}
                {isActive && (
                  <div className="pointer-events-none absolute right-4 top-4 z-10 select-none">
                    <div className="rotate-6 rounded-xl border-2 border-dashed border-ios-blue/60 bg-ios-blue/10 px-2.5 py-1 text-[11px] font-black tracking-wider text-ios-blue shadow-xs backdrop-blur-xs">
                      ✓ 使用中
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  {/* 头部标题与图标：独占完整宽度 */}
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border transition-all mt-0.5",
                        isActive
                          ? "border-ios-blue/30 bg-ios-blue text-white shadow-md shadow-ios-blue/25"
                          : "border-ios-separator/60 bg-ios-surface-tertiary/60 text-ios-label-secondary",
                      )}
                    >
                      <HardDriveDownload className="h-5 w-5" />
                    </span>
                    <div className={cn("min-w-0 flex-1", isActive && "pr-14")}>
                      <h3 className="line-clamp-2 text-[15px] font-bold leading-snug text-ios-label break-words">
                        {bank.name}
                      </h3>
                      <p className="mt-1 text-[12px] text-ios-label-secondary">
                        {bank.questionCount} 道题目
                      </p>
                    </div>
                  </div>

                  {/* 科目标签 */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {bank.subjects.map((subject) => (
                      <span
                        key={subject.id}
                        className="rounded-lg bg-ios-surface-secondary px-2.5 py-1 text-[11px] font-medium text-ios-label-secondary dark:bg-ios-surface-tertiary/70"
                      >
                        {subject.name}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 底部操作区 */}
                <div className="mt-6 flex items-center justify-between border-t border-ios-separator/40 pt-4">
                  {isActive ? (
                    <>
                      <div className="flex items-center gap-2 text-[12px] font-bold text-ios-blue">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ios-blue opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-ios-blue" />
                        </span>
                        <span>当前使用中</span>
                      </div>

                      <Link
                        href={`/banks/${bank.id}`}
                        className="squircle-press flex items-center gap-1 rounded-xl bg-ios-blue px-3.5 py-1.5 text-[12px] font-bold text-white shadow-sm shadow-ios-blue/25 hover:bg-ios-blue-hover"
                      >
                        进入章节 <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => setActiveBank(bank.id)}
                        className="squircle-press flex items-center gap-1 rounded-xl border border-ios-blue/30 bg-ios-blue/5 px-3 py-1.5 text-[12px] font-bold text-ios-blue hover:bg-ios-blue/10 active:scale-95 cursor-pointer"
                      >
                        设为当前题库
                      </button>

                      {!bank.isDefault ? (
                        <button
                          onClick={() => handleRemove(bank.id)}
                          className="squircle-press flex items-center gap-1 rounded-xl p-1.5 text-[12px] text-ios-red/80 hover:bg-ios-red/10 hover:text-ios-red cursor-pointer"
                          title="删除题库"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : (
                        <span className="text-[11px] font-medium text-ios-label-tertiary">
                          内置题库
                        </span>
                      )}
                    </>
                  )}
                </div>
              </Card>
            );
          })}

          {/* 快捷导入卡片 */}
          <button
            onClick={() => {
              resetImport();
              setImportOpen(true);
            }}
            className="squircle-press flex min-h-[190px] flex-col items-center justify-center gap-3 rounded-[24px] border-2 border-dashed border-ios-blue/30 bg-ios-blue/5 p-6 text-center text-ios-blue transition-all hover:border-ios-blue/60 hover:bg-ios-blue/10 cursor-pointer"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ios-blue/10">
              <FileUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[15px] font-bold">导入新题库文件</p>
              <p className="mt-0.5 text-[12px] text-ios-label-tertiary">
                支持 JSON 结构题库 · 纯本地离线存储
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* 导入弹窗 */}
      <Sheet
        open={importOpen}
        onClose={() => {
          setImportOpen(false);
          resetImport();
        }}
        title="导入题库"
        description="选择符合 QuestionBank Schema 的 JSON 题库文件"
      >
        {phase === "idle" && (
          <div className="flex flex-col items-center gap-5 py-6">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-ios-blue/10 text-ios-blue shadow-inner">
              <Upload className="h-10 w-10" />
            </div>
            <div className="text-center">
              <p className="text-[15px] font-semibold text-ios-label">
                选择本地 JSON 格式题库
              </p>
              <p className="mt-1 text-[13px] text-ios-label-secondary">
                系统将自动校验题目结构、题型分类与选项格式
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              size="lg"
              className="w-full max-w-xs justify-center"
              onClick={() => fileInputRef.current?.click()}
            >
              浏览并选择文件
            </Button>
          </div>
        )}

        {(phase === "parsing" || phase === "importing") && (
          <div className="flex flex-col items-center gap-4 py-12">
            <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-ios-surface-tertiary border-t-ios-blue" />
            <p className="text-[14px] font-medium text-ios-label-secondary">
              {phase === "parsing" ? "正在解析并校验题库结构…" : "正在导入题库至本地数据库…"}
            </p>
          </div>
        )}

        {phase === "parsed" && report && (
          <div className="space-y-5 py-2">
            <div className="flex items-start gap-3 rounded-2xl border border-ios-green/30 bg-ios-green/10 p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-ios-green" />
              <div>
                <p className="text-[15px] font-bold text-ios-green">题库结构校验通过</p>
                <p className="mt-1 text-[13px] text-ios-label-secondary">
                  共计收录 {report.questionCount} 道题 · 包含 {Object.keys(report.typeCounts).length} 种题型
                </p>
              </div>
            </div>

            {/* 题型分布药丸 */}
            <div>
              <p className="mb-2 text-[12px] font-semibold text-ios-label-secondary">题型构成明细</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(report.typeCounts).map(([type, count]) => (
                  <span
                    key={type}
                    className="rounded-xl border border-white/60 bg-ios-surface/80 px-3 py-1.5 text-[12px] font-semibold text-ios-label dark:border-white/10"
                  >
                    {typeLabel(type)}: <span className="text-ios-blue font-bold">{count}</span> 题
                  </span>
                ))}
              </div>
            </div>

            {report.warnings.length > 0 && (
              <div className="rounded-2xl border border-ios-orange/30 bg-ios-orange/10 p-4">
                <div className="flex items-center gap-2 text-[13px] font-bold text-ios-orange">
                  <Info className="h-4 w-4" />
                  包含 {report.warnings.length} 条提示（不影响正常使用）
                </div>
                <details className="mt-2 text-[12px] text-ios-label-secondary">
                  <summary className="cursor-pointer font-medium text-ios-orange">展开查看详情</summary>
                  <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto pl-4 list-disc">
                    {report.warnings.slice(0, 20).map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </details>
              </div>
            )}

            <Button size="lg" className="w-full justify-center shadow-lg" onClick={handleImport}>
              确认导入至本地
            </Button>
          </div>
        )}

        {phase === "error" && (
          <div className="space-y-4 py-4">
            <div className="rounded-2xl border border-ios-red/30 bg-ios-red/10 p-4 text-[14px] leading-relaxed text-ios-red">
              {importError}
            </div>
            <Button variant="secondary" size="lg" className="w-full justify-center" onClick={resetImport}>
              重新选择文件
            </Button>
          </div>
        )}

        {phase === "done" && (
          <div className="flex flex-col items-center gap-5 py-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-ios-green/15 text-ios-green shadow-inner">
              <CheckCircle2 className="h-9 w-9" />
            </div>
            <div className="text-center">
              <p className="text-[17px] font-extrabold text-ios-label">
                「{importedName}」导入成功
              </p>
              <p className="mt-1 text-[13px] text-ios-label-secondary">
                题库已安全存储至本地，可立即开启练习
              </p>
            </div>
            <div className="flex w-full gap-3">
              <Button
                variant="secondary"
                size="lg"
                className="flex-1 justify-center"
                onClick={() => setImportOpen(false)}
              >
                完成
              </Button>
              <Button
                size="lg"
                className="flex-1 justify-center"
                onClick={() => {
                  const b = useBankStore.getState().banks.find((item) => item.name === importedName);
                  setImportOpen(false);
                  if (b) router.push(`/banks/${b.id}`);
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
    single_choice: "单选题",
    multiple_choice: "多选题",
    true_false: "判断题",
    short_answer: "简答题",
    comprehensive: "综合题",
    calculation_analysis: "计算分析题",
  };
  return labels[type] ?? type;
}
