"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Check, ListOrdered, Shuffle } from "lucide-react";
import { useBankStore } from "@/stores/bank-store";
import { listQuestionsByBankIds, type QuestionRecord } from "@/lib/db";
import { createPracticeSession } from "@/lib/session-utils";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/utils";
import {
  ALL_QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
  type QuestionType,
  type QuestionUnit,
} from "@/types/question-bank";

export default function SetupPage() {
  return (
    <Suspense fallback={null}>
      <SetupPageInner />
    </Suspense>
  );
}

function SetupPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { banks, activeBankId } = useBankStore();

  const queryBankId = searchParams.get("bankId");
  const queryBankIds = searchParams.get("bankIds");
  const unit = (searchParams.get("unit") as QuestionUnit | null) ?? undefined;
  const chapter = searchParams.get("chapter") ?? undefined;
  const subjectId = searchParams.get("subjectId") ?? undefined;

  const initialBankIds = useMemo(() => {
    if (queryBankIds) {
      const ids = queryBankIds
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((id) => banks.some((b) => b.id === id));
      if (ids.length > 0) return ids;
    }
    if (queryBankId && banks.some((b) => b.id === queryBankId)) return [queryBankId];
    if (activeBankId && banks.some((b) => b.id === activeBankId)) return [activeBankId];
    if (banks.length > 0) return [banks[0].id];
    return [] as string[];
  }, [queryBankIds, queryBankId, activeBankId, banks]);

  const [selectedBankIds, setSelectedBankIds] = useState<string[]>([]);
  const [questions, setQuestions] = useState<QuestionRecord[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<QuestionType[]>([]);
  const [countMode, setCountMode] = useState<"all" | "10" | "20" | "50">("all");
  const [order, setOrder] = useState<"source" | "random">("source");
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (selectedBankIds.length === 0 && initialBankIds.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedBankIds(initialBankIds);
    }
  }, [initialBankIds, selectedBankIds.length]);

  useEffect(() => {
    if (selectedBankIds.length === 0) return;
    const valid = selectedBankIds.filter((id) => banks.some((b) => b.id === id));
    if (valid.length !== selectedBankIds.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedBankIds(valid.length > 0 ? valid : initialBankIds);
    }
  }, [banks, selectedBankIds, initialBankIds]);

  useEffect(() => {
    if (selectedBankIds.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuestions([]);
      return;
    }
    let cancelled = false;
    void listQuestionsByBankIds(selectedBankIds).then((items) => {
      if (!cancelled) setQuestions(items);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedBankIds]);

  const matchedCount = useMemo(() => {
    let candidates = questions;
    if (subjectId) candidates = candidates.filter((question) => question.subjectId === subjectId);
    if (unit) candidates = candidates.filter((question) => question.unit === unit);
    if (chapter) candidates = candidates.filter((question) => question.chapter === chapter);
    if (selectedTypes.length > 0) {
      candidates = candidates.filter((question) => selectedTypes.includes(question.type));
    }
    return candidates.length;
  }, [questions, subjectId, unit, chapter, selectedTypes]);

  const toggleType = (type: QuestionType) => {
    setSelectedTypes((current) =>
      current.includes(type)
        ? current.filter((item) => item !== type)
        : [...current, type],
    );
  };

  const toggleBank = (bankId: string) => {
    setSelectedBankIds((current) => {
      if (current.includes(bankId)) {
        if (current.length === 1) return current;
        return current.filter((id) => id !== bankId);
      }
      return [...current, bankId];
    });
  };

  const startPractice = async () => {
    if (selectedBankIds.length === 0 || matchedCount === 0 || starting) return;
    setStarting(true);
    setError("");
    try {
      const count = countMode === "all" ? matchedCount : Number(countMode);
      const mode =
        unit === "mock_exam" ? "mock" : unit === "advanced_subjective" ? "advanced" : chapter ? "chapter" : subjectId ? "subject" : "random";
      const titleBase = chapter ?? (unit ? unitLabel(unit) : subjectId ? "科目练习" : "全部题目");
      const title =
        selectedBankIds.length > 1 ? `${titleBase} · ${selectedBankIds.length} 题库混合` : titleBase;
      const primaryBankId = selectedBankIds[0];
      const session = await createPracticeSession({
        bankId: primaryBankId,
        bankIds: selectedBankIds,
        mode,
        title,
        subjectId,
        unit,
        chapters: chapter ? [chapter] : undefined,
        types: selectedTypes.length > 0 ? selectedTypes : undefined,
        count,
        order,
      });
      router.push(`/practice/${session.id}`);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
      setStarting(false);
    }
  };

  const typeChipClass = (active: boolean) =>
    cn(
      "rounded-full border px-3.5 py-2 text-[14px] font-medium transition-all",
      active
        ? "border-ios-blue bg-ios-blue text-white"
        : "border-ios-separator bg-ios-surface text-ios-label active:scale-95",
    );

  const selectedBanks = banks.filter((b) => selectedBankIds.includes(b.id));
  const totalInSelected = selectedBanks.reduce((sum, b) => sum + b.questionCount, 0);

  return (
    <div className="safe-top">
      <PageHeader title="练习设置" onBack={() => router.back()} />

      <div className="space-y-4 px-4 pt-4">
        {/* 题库多选 */}
        <Card>
          <div className="flex items-center justify-between px-4 pt-4">
            <p className="text-[13px] font-semibold text-ios-label-secondary">题库选择（可多选）</p>
            <span className="text-[12px] text-ios-label-tertiary">
              已选 {selectedBankIds.length} / {banks.length} · 共 {totalInSelected} 题
            </span>
          </div>
          <div className="space-y-2 p-4">
            {banks.length === 0 ? (
              <p className="py-2 text-center text-[13px] text-ios-label-tertiary">暂无可用题库</p>
            ) : (
              banks.map((bank) => {
                const checked = selectedBankIds.includes(bank.id);
                return (
                  <button
                    key={bank.id}
                    onClick={() => toggleBank(bank.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border-2 px-3.5 py-3 text-left transition-all active:scale-[0.99]",
                      checked ? "border-ios-blue bg-ios-blue/5" : "border-ios-separator bg-ios-surface",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2",
                        checked
                          ? "border-ios-blue bg-ios-blue text-white"
                          : "border-ios-separator bg-transparent",
                      )}
                    >
                      {checked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate text-[14px] font-medium", checked && "text-ios-blue")}>
                        {bank.name}
                      </span>
                      <span className="text-[12px] text-ios-label-tertiary">
                        {bank.questionCount} 题 · {bank.subjects.map((s) => s.name).join(" · ")}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
            {banks.length > 1 && (
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setSelectedBankIds(banks.map((b) => b.id))}
                  className="flex-1 rounded-xl bg-ios-surface-tertiary py-2 text-[13px] font-medium text-ios-label-secondary"
                >
                  全选
                </button>
                <button
                  onClick={() => setSelectedBankIds(initialBankIds.length > 0 ? [initialBankIds[0]] : banks.slice(0, 1).map((b) => b.id))}
                  className="flex-1 rounded-xl bg-ios-surface-tertiary py-2 text-[13px] font-medium text-ios-label-secondary"
                >
                  仅当前题库
                </button>
              </div>
            )}
          </div>
        </Card>

        {/* 练习范围 */}
        <Card>
          <p className="px-4 pt-4 text-[13px] font-semibold text-ios-label-secondary">练习范围</p>
          <div className="space-y-3 p-4">
            <div className="flex items-center justify-between">
              <span className="text-[15px]">已选题库</span>
              <span className="max-w-[60%] truncate text-right text-[13px] font-medium text-ios-label-secondary">
                {selectedBanks.length === 0
                  ? "未选择"
                  : selectedBanks.length === 1
                    ? selectedBanks[0].name
                    : `${selectedBanks[0].name} 等 ${selectedBanks.length} 个`}
              </span>
            </div>
            {subjectId && (
              <div className="flex items-center justify-between">
                <span className="text-[15px]">科目</span>
                <span className="text-[14px] text-ios-label-secondary">
                  {banks
                    .flatMap((b) => b.subjects)
                    .find((subject) => subject.id === subjectId)?.name ?? subjectId}
                </span>
              </div>
            )}
            {unit && (
              <div className="flex items-center justify-between">
                <span className="text-[15px]">单元</span>
                <span className="text-[14px] text-ios-label-secondary">{unitLabel(unit)}</span>
              </div>
            )}
            {chapter && (
              <div className="flex items-center justify-between">
                <span className="text-[15px]">章节</span>
                <span className="max-w-[65%] truncate text-right text-[14px] text-ios-label-secondary">
                  {chapter}
                </span>
              </div>
            )}
            {questions.length > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-ios-label-tertiary">已加载题目</span>
                <span className="text-[13px] tabular-nums text-ios-label-secondary">
                  {questions.length} 题
                </span>
              </div>
            )}
          </div>
        </Card>

        {/* 题型 */}
        <Card>
          <p className="px-4 pt-4 text-[13px] font-semibold text-ios-label-secondary">题型</p>
          <div className="flex flex-wrap gap-2 p-4">
            <button className={typeChipClass(selectedTypes.length === 0)} onClick={() => setSelectedTypes([])}>
              全部
            </button>
            {ALL_QUESTION_TYPES.map((type) => (
              <button
                key={type}
                className={typeChipClass(selectedTypes.includes(type))}
                onClick={() => toggleType(type)}
              >
                {QUESTION_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </Card>

        {/* 题数 */}
        <Card>
          <p className="px-4 pt-4 text-[13px] font-semibold text-ios-label-secondary">题数</p>
          <div className="p-4">
            <Segmented<"all" | "10" | "20" | "50">
              value={countMode}
              onChange={setCountMode}
              options={[
                { value: "all", label: `全部` },
                { value: "10", label: "10" },
                { value: "20", label: "20" },
                { value: "50", label: "50" },
              ]}
            />
          </div>
        </Card>

        {/* 顺序 */}
        <Card>
          <p className="px-4 pt-4 text-[13px] font-semibold text-ios-label-secondary">出题顺序</p>
          <div className="grid grid-cols-2 gap-3 p-4">
            <OrderOption
              active={order === "source"}
              onClick={() => setOrder("source")}
              icon={ListOrdered}
              title="顺序"
              subtitle="按题库顺序"
            />
            <OrderOption
              active={order === "random"}
              onClick={() => setOrder("random")}
              icon={Shuffle}
              title="随机"
              subtitle="打乱顺序"
            />
          </div>
        </Card>

        {error && (
          <div className="rounded-2xl bg-ios-red/8 px-4 py-3 text-[14px] text-ios-red">{error}</div>
        )}

        <div className="pb-6 pt-2">
          <Button className="w-full" onClick={startPractice} disabled={matchedCount === 0 || starting || selectedBankIds.length === 0}>
            {starting ? "准备中…" : `开始练习（${matchedCount} 题）`}
            {!starting && <ArrowRight className="h-5 w-5" />}
          </Button>
          {matchedCount === 0 && (
            <p className="mt-2 text-center text-[12px] text-ios-label-tertiary">当前筛选条件下没有题目</p>
          )}
          {selectedBankIds.length > 1 && matchedCount > 0 && (
            <p className="mt-2 text-center text-[12px] text-ios-label-tertiary">
              将从 {selectedBankIds.length} 个题库中共 {matchedCount} 题中按规则抽题
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function unitLabel(unit: QuestionUnit): string {
  return unit === "mock_exam" ? "模拟套卷" : unit === "advanced_subjective" ? "主观题专项" : "章节练习";
}

function OrderOption({
  active,
  onClick,
  icon: Icon,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof ListOrdered;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-1.5 rounded-2xl border-2 p-3.5 text-left transition-all",
        active ? "border-ios-blue bg-ios-blue/5" : "border-ios-separator bg-transparent",
      )}
    >
      <Icon className={cn("h-5 w-5", active ? "text-ios-blue" : "text-ios-label-secondary")} />
      <span className={cn("text-[15px] font-semibold", active ? "text-ios-blue" : "text-ios-label")}>{title}</span>
      <span className="text-[12px] text-ios-label-secondary">{subtitle}</span>
    </button>
  );
}
