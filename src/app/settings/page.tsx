"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  BarChart3,
  ChevronRight,
  Database,
  Download,
  Library,
  Moon,
  Palette,
  Sun,
  Trash2,
} from "lucide-react";
import { useBankStore } from "@/stores/bank-store";
import { clearUserData, resetAllData, db } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { cn } from "@/lib/utils";

type ThemeMode = "system" | "light" | "dark";

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { banks, activeBankId, resetForReload } = useBankStore();
  const activeBank = banks.find((bank) => bank.id === activeBankId);

  const [statsText, setStatsText] = useState("");

  const themeMode: ThemeMode = theme === "system" ? "system" : (theme as ThemeMode);

  const loadStats = async () => {
    const [attemptCount, statCount] = await Promise.all([
      db.attempts.count(),
      db.questionStats.count(),
    ]);
    setStatsText(`本地已累计 ${attemptCount} 次答题记录，${statCount} 道题目有练习轨迹`);
  };

  useEffect(() => {
    // 从 IndexedDB 统计本地数据量
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadStats();
  }, [activeBankId]);

  const exportData = async () => {
    const [banksData, attempts, stats] = await Promise.all([
      db.banks.toArray(),
      db.attempts.toArray(),
      db.questionStats.toArray(),
    ]);
    const blob = new Blob(
      [
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            banks: banksData,
            attempts,
            questionStats: stats,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `题集学习数据_${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleClearUserData = async () => {
    if (
      !window.confirm(
        "确定清空所有学习记录（答题历史、错题本、收藏夹、笔记）吗？题库文件将保留。此操作不可恢复。",
      )
    )
      return;
    await clearUserData();
    await loadStats();
    window.alert("学习记录已清空");
  };

  const handleResetAll = async () => {
    if (
      !window.confirm(
        "确定重置整个应用吗？将删除所有题库及做题记录，恢复至出厂初始状态。此操作不可恢复。",
      )
    )
      return;
    await resetAllData();
    resetForReload();
    window.location.href = "/";
  };

  return (
    <div className="min-h-dvh safe-top">
      <PageHeader title="系统与偏好设置" subtitle="个性化外观、数据备份与本地存储管理" />

      <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">
        {/* 外观设置 */}
        <Card className="p-6">
          <h3 className="mb-4 flex items-center gap-2 text-[16px] font-bold text-ios-label">
            <Palette className="h-5 w-5 text-ios-purple" />
            界面外观主题
          </h3>
          <div className="space-y-3">
            <Segmented<ThemeMode>
              value={themeMode}
              onChange={(mode) => setTheme(mode === "system" ? "system" : mode)}
              options={[
                { value: "system", label: "跟随系统" },
                { value: "light", label: "极简浅白" },
                { value: "dark", label: "深空黑曜" },
              ]}
            />
            <p className="flex items-center gap-1.5 text-[12px] text-ios-label-secondary">
              {resolvedTheme === "dark" ? (
                <Moon className="h-3.5 w-3.5 text-ios-indigo" />
              ) : (
                <Sun className="h-3.5 w-3.5 text-ios-yellow" />
              )}
              当前生效：{resolvedTheme === "dark" ? "深色黑曜石模式" : "极简浅白模式"}
            </p>
          </div>
        </Card>

        {/* 学习数据管理 */}
        <Card className="p-6">
          <h3 className="mb-2 flex items-center gap-2 text-[16px] font-bold text-ios-label">
            <Database className="h-5 w-5 text-ios-blue" />
            本地数据安全与备份
          </h3>
          <p className="mb-4 text-[12px] text-ios-label-secondary">{statsText || "统计中…"}</p>

          <div className="space-y-1 divide-y divide-ios-separator/40">
            <SettingRow
              icon={<Download className="h-4 w-4 text-ios-blue" />}
              label="导出全部学习数据 (JSON 备份)"
              onClick={exportData}
            />
            <SettingRow
              icon={<Trash2 className="h-4 w-4 text-ios-orange" />}
              label="清空学习进度（保留题库）"
              onClick={handleClearUserData}
            />
            <SettingRow
              icon={<Trash2 className="h-4 w-4 text-ios-red" />}
              label="重置应用至初始状态（含题库）"
              onClick={handleResetAll}
              danger
            />
          </div>
        </Card>

        {/* 题库与统计快速跳转 */}
        <Card className="overflow-hidden p-2">
          <SettingRow
            icon={<Library className="h-4 w-4 text-ios-blue" />}
            label="题库管理中心"
            value={activeBank?.name}
            onClick={() => router.push("/banks")}
            chevron
          />
          <SettingRow
            icon={<BarChart3 className="h-4 w-4 text-ios-green" />}
            label="学习数据与分析看板"
            onClick={() => router.push("/analytics")}
            chevron
          />
        </Card>

        {/* 关于 */}
        <Card className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-ios-blue to-ios-indigo text-white shadow-md shadow-ios-blue/20">
              <span className="text-[22px] font-extrabold">题</span>
            </div>
            <div>
              <h4 className="text-[16px] font-bold text-ios-label">QuestionHub 题集</h4>
              <p className="text-[12px] text-ios-label-secondary">v1.2.0 · 全端自适应架构</p>
            </div>
          </div>
          <p className="mt-4 text-[13px] leading-relaxed text-ios-label-secondary">
            面向未来的现代化高颜值刷题工具。纯前端离线架构，所有数据加密保存在当前浏览器 IndexedDB
            中，支持 JSON 题库自由导入、智能艾宾浩斯复习算法与全键盘快捷键极速刷题。
          </p>
        </Card>
      </div>
    </div>
  );
}

function SettingRow({
  icon,
  label,
  value,
  onClick,
  chevron,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onClick?: () => void;
  chevron?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "squircle-press flex w-full items-center gap-3.5 rounded-2xl p-3.5 text-left transition-all hover:bg-ios-surface-secondary/70 active:scale-[0.99] cursor-pointer",
      )}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-ios-surface-tertiary/60">
        {icon}
      </span>
      <span className={cn("flex-1 text-[14px] font-semibold", danger ? "text-ios-red" : "text-ios-label")}>
        {label}
      </span>
      {value && (
        <span className="max-w-[40%] truncate text-[12px] font-medium text-ios-label-secondary">
          {value}
        </span>
      )}
      {chevron && <ChevronRight className="h-4 w-4 shrink-0 text-ios-label-tertiary" />}
    </button>
  );
}
