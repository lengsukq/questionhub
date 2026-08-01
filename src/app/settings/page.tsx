"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  BarChart3,
  ChevronRight,
  Database,
  Download,
  Info,
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
  const { banks, activeBankId, refreshBanks } = useBankStore();
  const activeBank = banks.find((bank) => bank.id === activeBankId);

  const [statsText, setStatsText] = useState("");

  const themeMode: ThemeMode = theme === "system" ? "system" : (theme as ThemeMode);

  const loadStats = async () => {
    const [attemptCount, statCount] = await Promise.all([
      db.attempts.count(),
      db.questionStats.count(),
    ]);
    setStatsText(`共 ${attemptCount} 次答题记录，${statCount} 道题有学习数据`);
  };

  useEffect(() => {
    // 从 IndexedDB 统计本地数据量（外部数据源）
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
      [JSON.stringify({ exportedAt: new Date().toISOString(), banks: banksData, attempts, questionStats: stats }, null, 2)],
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
    if (!window.confirm("确定清空所有学习记录（答题记录、错题、收藏、笔记）吗？题库将保留。此操作不可恢复。")) return;
    await clearUserData();
    await loadStats();
    window.alert("学习记录已清空");
  };

  const handleResetAll = async () => {
    if (!window.confirm("确定重置应用吗？将删除所有题库和学习记录，恢复初始状态。此操作不可恢复。")) return;
    await resetAllData();
    localStorage.removeItem("questionhub.activeBankId");
    await refreshBanks();
    window.location.href = "/";
  };

  return (
    <div className="safe-top">
      <PageHeader title="我的" onBack={() => router.push("/")} />

      <div className="space-y-4 px-4 pt-4">
        {/* 外观 */}
        <Card>
          <p className="flex items-center gap-2 px-4 pt-4 text-[15px] font-semibold">
            <Palette className="h-4 w-4 text-ios-purple" />
            外观
          </p>
          <div className="p-4">
            <Segmented<ThemeMode>
              value={themeMode}
              onChange={(mode) => setTheme(mode === "system" ? "system" : mode)}
              options={[
                { value: "system", label: "跟随系统" },
                { value: "light", label: "浅色" },
                { value: "dark", label: "深色" },
              ]}
            />
            <p className="mt-2 flex items-center gap-1.5 text-[12px] text-ios-label-tertiary">
              {resolvedTheme === "dark" ? <Moon className="h-3 w-3" /> : <Sun className="h-3 w-3" />}
              当前为{resolvedTheme === "dark" ? "深色" : "浅色"}模式
            </p>
          </div>
        </Card>

        {/* 数据 */}
        <Card>
          <p className="flex items-center gap-2 px-4 pt-4 text-[15px] font-semibold">
            <Database className="h-4 w-4 text-ios-blue" />
            学习数据
          </p>
          <div className="p-4 pt-3">
            <p className="mb-3 text-[12px] text-ios-label-tertiary">{statsText || "正在统计…"}</p>
            <SettingRow
              icon={<Download className="h-4 w-4 text-ios-blue" />}
              label="导出学习数据"
              onClick={exportData}
            />
            <SettingRow
              icon={<Trash2 className="h-4 w-4 text-ios-orange" />}
              label="清空学习记录"
              onClick={handleClearUserData}
            />
            <SettingRow
              icon={<Trash2 className="h-4 w-4 text-ios-red" />}
              label="重置应用（含题库）"
              onClick={handleResetAll}
              danger
            />
          </div>
        </Card>

        {/* 题库与统计 */}
        <Card>
          <SettingRow
            icon={<Library className="h-4 w-4 text-ios-blue" />}
            label="题库管理"
            value={activeBank?.name}
            onClick={() => router.push("/banks")}
            chevron
          />
          <SettingRow
            icon={<BarChart3 className="h-4 w-4 text-ios-green" />}
            label="学习数据"
            onClick={() => router.push("/analytics")}
            chevron
          />
        </Card>

        {/* 关于 */}
        <Card>
          <p className="flex items-center gap-2 px-4 pt-4 text-[15px] font-semibold">
            <Info className="h-4 w-4 text-ios-teal" />
            关于
          </p>
          <div className="p-4 pt-2">
            <p className="text-[14px] font-medium">题集 QuestionHub</p>
            <p className="mt-1 text-[12px] leading-relaxed text-ios-label-secondary">
              移动端优先的本地刷题应用。所有数据保存在当前设备浏览器中，支持导入 QuestionBank JSON 题库与离线练习。
            </p>
            <p className="mt-2 text-[12px] text-ios-label-tertiary">v1.0.0</p>
          </div>
        </Card>

        <div className="h-6" />
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
        "row-active flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left",
      )}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center">{icon}</span>
      <span className={cn("flex-1 text-[15px]", danger ? "text-ios-red" : "text-ios-label")}>{label}</span>
      {value && <span className="max-w-[40%] truncate text-[13px] text-ios-label-secondary">{value}</span>}
      {chevron && <ChevronRight className="h-4 w-4 shrink-0 text-ios-label-tertiary" />}
    </button>
  );
}
