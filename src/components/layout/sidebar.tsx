"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  ChevronRight,
  Flame,
  Home,
  Library,
  Moon,
  Repeat,
  Settings,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useBankStore } from "@/stores/bank-store";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "今日概览", icon: Home },
  { href: "/banks", label: "题库中心", icon: Library },
  { href: "/review", label: "错题复习", icon: Repeat },
  { href: "/analytics", label: "学习数据", icon: BarChart3 },
  { href: "/settings", label: "系统设置", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { banks, activeBankId } = useBankStore();
  const activeBank = banks.find((b) => b.id === activeBankId);

  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col justify-between border-r border-ios-separator/60 bg-ios-surface/75 backdrop-blur-2xl p-5 z-30 lg:flex">
      {/* 顶部品牌 */}
      <div className="space-y-6">
        <div className="flex items-center gap-3 px-2 pt-1">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-ios-blue to-ios-indigo shadow-lg shadow-ios-blue/25 ring-2 ring-white/60 dark:ring-white/10">
            <span className="text-[22px] font-bold text-white">题</span>
          </div>
          <div>
            <h1 className="text-[17px] font-bold tracking-tight text-ios-label">QuestionHub</h1>
            <p className="text-[12px] font-medium text-ios-label-tertiary">现代极简刷题平台</p>
          </div>
        </div>

        {/* 当前题库快速卡片 */}
        {activeBank && (
          <Link
            href="/banks"
            className="group flex items-center justify-between rounded-2xl border border-white/60 bg-ios-surface/60 p-3 shadow-sm backdrop-blur-md transition-all duration-200 hover:border-ios-blue/30 hover:bg-ios-surface hover:shadow-md active:scale-[0.98] dark:border-white/5 dark:bg-ios-surface/40"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-ios-blue/10 text-ios-blue">
                <BookOpen className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-medium text-ios-label-tertiary">当前题库</p>
                <p className="truncate text-[13px] font-semibold text-ios-label group-hover:text-ios-blue transition-colors">
                  {activeBank.name}
                </p>
              </div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-ios-label-tertiary transition-transform group-hover:translate-x-0.5" />
          </Link>
        )}

        {/* 导航菜单 */}
        <nav className="space-y-1.5" aria-label="桌面端侧边导航">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "group flex items-center gap-3.5 rounded-2xl px-3.5 py-3 text-[14px] font-medium transition-all duration-200 active:scale-[0.98]",
                  isActive
                    ? "bg-ios-blue text-white shadow-md shadow-ios-blue/25 font-semibold"
                    : "text-ios-label-secondary hover:bg-ios-surface hover:text-ios-label dark:hover:bg-ios-surface/60",
                )}
              >
                <Icon
                  className={cn(
                    "h-5 w-5 transition-transform duration-200 group-hover:scale-110",
                    isActive ? "text-white" : "text-ios-label-secondary group-hover:text-ios-label",
                  )}
                  strokeWidth={isActive ? 2.3 : 1.8}
                />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* 底部操作区与模式切换 */}
      <div className="space-y-3 pt-4">
        <div className="flex items-center justify-between rounded-2xl border border-white/60 bg-ios-surface/40 p-2.5 backdrop-blur-md dark:border-white/5">
          <div className="flex items-center gap-2 pl-1.5 text-[12px] font-medium text-ios-label-secondary">
            <Flame className="h-4 w-4 text-ios-orange" />
            <span>专注坚持</span>
          </div>
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-ios-surface-tertiary/70 text-ios-label transition-transform hover:scale-105 active:scale-95"
            title="切换深浅主题"
          >
            {theme === "dark" ? <Sun className="h-4 w-4 text-ios-yellow" /> : <Moon className="h-4 w-4 text-ios-indigo" />}
          </button>
        </div>
      </div>
    </aside>
  );
}
