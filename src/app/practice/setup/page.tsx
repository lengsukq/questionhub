"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Check, Layers, ListOrdered, Shuffle, Sparkles } from "lucide-react";
import { useBankStore } from "@/stores/bank-store";
import { listQuestionsByBankIds, type QuestionRecord } from "@/lib/db";
import { createPracticeSession } from "@/lib/session-utils";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  ALL_QUESTION_TYPES,
  QUESTION_TYPE_LABELS,
  type QuestionType,
  type QuestionUnit,
} from "@/types/question-bank";

export default function SetupPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-ios-surface-tertiary border-t-ios-blue" />
        </div>
      }
    >
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
    if (subjectId) candidates = candidates.filter((q) => q.subjectId === subjectId);
    if (unit) candidates = candidates.filter((q) => q.unit === unit);
    if (chapter) candidates = candidates.filter((q) => q.chapter === chapter);
    if (selectedTypes.length > 0) {
      candidates = candidates.filter((q) => selectedTypes.includes(q.type));
    }
    return candidates.length;
  }, [questions, subjectId, unit, chapter, selectedTypes]);

  const toggleType = (type: QuestionType) => {
    setSelectedTypes((cur) =>
      cur.includes(type) ? cur.filter((t) => t !== type) : [...cur, type],
    );
  };

  const toggleBank = (bankId: string) => {
    setSelectedBankIds((cur) => {
      if (cur.includes(bankId)) {
        if (cur.length === 1) return cur;
        return cur.filter((id) => id !== bankId);
      }
      return [...cur, bankId];
    });
  };

  const startPractice = async () => {
    if (selectedBankIds.length === 0 || matchedCount === 0 || starting) return;
    setStarting(true);
    setError("");
    try {
      const count = countMode === "all" ? matchedCount : Number(countMode);
      const mode =
        unit === "mock_exam"
          ? "mock"
          : unit === "advanced_subjective"
            ? "advanced"
            : chapter
              ? "chapter"
              : subjectId
                ? "subject"
                : "random";
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
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStarting(false);
    }
  };

  const selectedBanks = banks.filter((b) => selectedBankIds.includes(b.id));
  const totalInSelected = selectedBanks.reduce((sum, b) => sum + b.questionCount, 0);

  return (
    <div className="min-h-dvh safe-top">
      <PageHeader title="练习参数配置" subtitle="自定义题目范围、题型与练习模式" />

      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* 左栏：题库选择与范围 */}
          <div className="space-y-5 lg:col-span-7">
            {/* 题库多选 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-ios-blue" />
                  题库选择（可多选）
                </CardTitle>
                <span className="text-[12px] font-medium text-ios-label-tertiary">
                  已选 {selectedBankIds.length}/{banks.length} · 共 {totalInSelected} 题
                </span>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {banks.length === 0 ? (
                  <p className="py-4 text-center text-[13px] text-ios-label-tertiary">
                    暂无可用题库，请先导入题库
                  </p>
                ) : (
                  banks.map((bank) => {
                    const checked = selectedBankIds.includes(bank.id);
                    return (
                      <button
                        key={bank.id}
                        type="button"
                        onClick={() => toggleBank(bank.id)}
                        className={cn(
                          "squircle-press flex w-full items-center gap-3.5 rounded-2xl border-2 p-3.5 text-left transition-all cursor-pointer",
                          checked
                            ? "border-ios-blue bg-ios-blue/8 shadow-sm"
                            : "border-white/60 bg-ios-surface/60 hover:border-ios-blue/30 dark:border-white/10 dark:bg-ios-surface/40",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition-all",
                            checked
                              ? "border-ios-blue bg-ios-blue text-white"
                              : "border-ios-separator bg-transparent",
                          )}
                        >
                          {checked && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className={cn("truncate text-[14px] font-semibold", checked ? "text-ios-blue" : "text-ios-label")}>
                            {bank.name}
                          </p>
                          <p className="mt-0.5 text-[12px] text-ios-label-tertiary">
                            {bank.questionCount} 题 · {bank.subjects.map((s) => s.name).join(" · ")}
                          </p>
                        </div>
                      </button>
                    );
                  })
                )}

                {banks.length > 1 && (
                  <div className="flex gap-2.5 pt-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1"
                      onClick={() => setSelectedBankIds(banks.map((b) => b.id))}
                    >
                      全选题库
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1"
                      onClick={() =>
                        setSelectedBankIds(
                          initialBankIds.length > 0 ? [initialBankIds[0]] : [banks[0].id],
                        )
                      }
                    >
                      仅当前题库
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 练习范围预览 */}
            <Card>
              <CardHeader>
                <CardTitle>范围定位</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between py-1 border-b border-ios-separator/40">
                  <span className="text-[14px] text-ios-label-secondary">所属科目</span>
                  <span className="text-[14px] font-medium text-ios-label">
                    {subjectId
                      ? banks.flatMap((b) => b.subjects).find((s) => s.id === subjectId)?.name ??
                        subjectId
                      : "全部科目"}
                  </span>
                </div>
                {unit && (
                  <div className="flex items-center justify-between py-1 border-b border-ios-separator/40">
                    <span className="text-[14px] text-ios-label-secondary">练习单元</span>
                    <Badge color="blue">{unitLabel(unit)}</Badge>
                  </div>
                )}
                {chapter && (
                  <div className="flex items-center justify-between py-1 border-b border-ios-separator/40">
                    <span className="text-[14px] text-ios-label-secondary">章节</span>
                    <span className="max-w-[60%] truncate text-[14px] font-medium text-ios-label">
                      {chapter}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[14px] text-ios-label-secondary">候选题目总数</span>
                  <span className="text-[14px] font-bold tabular-nums text-ios-blue">
                    {questions.length} 题
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 右栏：题型、题数、顺序与开始按钮 */}
          <div className="space-y-5 lg:col-span-5">
            {/* 题型筛选 */}
            <Card>
              <CardHeader>
                <CardTitle>题型筛选</CardTitle>
                <span className="text-[12px] text-ios-label-tertiary">默认全部</span>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedTypes([])}
                    className={cn(
                      "squircle-press rounded-full px-3.5 py-1.5 text-[13px] font-bold transition-all cursor-pointer",
                      selectedTypes.length === 0
                        ? "bg-ios-blue text-white shadow-sm shadow-ios-blue/30"
                        : "border border-white/70 bg-ios-surface text-ios-label-secondary hover:text-ios-label dark:border-white/10",
                    )}
                  >
                    全部题型
                  </button>
                  {ALL_QUESTION_TYPES.map((t) => {
                    const active = selectedTypes.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => toggleType(t)}
                        className={cn(
                          "squircle-press rounded-full px-3.5 py-1.5 text-[13px] font-bold transition-all cursor-pointer",
                          active
                            ? "bg-ios-blue text-white shadow-sm shadow-ios-blue/30"
                            : "border border-white/70 bg-ios-surface text-ios-label-secondary hover:text-ios-label dark:border-white/10",
                        )}
                      >
                        {QUESTION_TYPE_LABELS[t]}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* 题数与顺序 */}
            <Card>
              <CardHeader>
                <CardTitle>练习题数</CardTitle>
              </CardHeader>
              <CardContent>
                <Segmented<"all" | "10" | "20" | "50">
                  value={countMode}
                  onChange={setCountMode}
                  options={[
                    { value: "all", label: "全部" },
                    { value: "10", label: "10 题" },
                    { value: "20", label: "20 题" },
                    { value: "50", label: "50 题" },
                  ]}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>出题顺序</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setOrder("source")}
                    className={cn(
                      "squircle-press flex items-center gap-3 rounded-2xl border-2 p-3.5 text-left transition-all cursor-pointer",
                      order === "source"
                        ? "border-ios-blue bg-ios-blue/8 text-ios-blue shadow-sm"
                        : "border-white/60 bg-ios-surface/60 hover:border-ios-blue/30 dark:border-white/10",
                    )}
                  >
                    <ListOrdered className="h-5 w-5" />
                    <div>
                      <p className="text-[14px] font-bold">顺序练习</p>
                      <p className="text-[11px] text-ios-label-tertiary">原题库先后排序</p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOrder("random")}
                    className={cn(
                      "squircle-press flex items-center gap-3 rounded-2xl border-2 p-3.5 text-left transition-all cursor-pointer",
                      order === "random"
                        ? "border-ios-blue bg-ios-blue/8 text-ios-blue shadow-sm"
                        : "border-white/60 bg-ios-surface/60 hover:border-ios-blue/30 dark:border-white/10",
                    )}
                  >
                    <Shuffle className="h-5 w-5" />
                    <div>
                      <p className="text-[14px] font-bold">随机乱序</p>
                      <p className="text-[11px] text-ios-label-tertiary">打乱题目顺序</p>
                    </div>
                  </button>
                </div>
              </CardContent>
            </Card>

            {error && (
              <div className="rounded-2xl border border-ios-red/30 bg-ios-red/10 p-4 text-[13px] text-ios-red">
                {error}
              </div>
            )}

            {/* 启动主按钮 */}
            <div className="pt-2">
              <Button
                size="lg"
                className="w-full justify-center shadow-xl"
                disabled={matchedCount === 0 || selectedBankIds.length === 0}
                loading={starting}
                loadingText="正在生成练习并进入…"
                onClick={startPractice}
              >
                <Sparkles className="h-5 w-5" />
                立即开始（{matchedCount} 题）
                <ArrowRight className="h-5 w-5" />
              </Button>

              {matchedCount === 0 && (
                <p className="mt-2 text-center text-[12px] text-ios-label-tertiary">
                  当前条件未筛选到题目，请调整题库或题型
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function unitLabel(unit: QuestionUnit): string {
  return unit === "mock_exam" ? "模拟套卷" : unit === "advanced_subjective" ? "主观题专项" : "章节练习";
}
