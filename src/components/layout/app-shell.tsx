"use client";

import { useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { useBankStore } from "@/stores/bank-store";
import { TabBar } from "@/components/layout/tab-bar";
import { Sidebar } from "@/components/layout/sidebar";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { loading, error, activeBankId, initialize } = useBankStore();

  useEffect(() => {
    void initialize();
  }, [initialize]);

  // 做题沉浸流程隐藏移动端底部 TabBar
  const isPracticeFlow = useMemo(
    () => pathname.startsWith("/practice/"),
    [pathname],
  );

  if (loading) {
    return <SplashScreen />;
  }

  if (error) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
        <div className="ambient-bg" />
        <div className="glass-card flex max-w-md flex-col items-center p-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-ios-red/10 text-ios-red shadow-inner">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h1 className="mt-4 text-[18px] font-bold text-ios-label">加载异常</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-ios-label-secondary">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="squircle-press mt-6 flex items-center gap-2 rounded-2xl bg-ios-blue px-6 py-3 text-[15px] font-semibold text-white shadow-lg shadow-ios-blue/25 hover:bg-ios-blue-hover"
          >
            <RefreshCw className="h-4 w-4" />
            重新加载
          </button>
        </div>
      </div>
    );
  }

  if (!activeBankId) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-6">
        <div className="ambient-bg" />
        <div className="glass-card max-w-md p-8 text-center">
          <p className="text-[15px] text-ios-label-secondary">尚未初始化题库，请稍候…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-dvh w-full bg-ios-background">
      <div className="ambient-bg" />

      {/* PC 桌面端侧边栏 */}
      {!isPracticeFlow && <Sidebar />}

      {/* 主工作区 */}
      <div className="flex flex-1 flex-col min-w-0">
        <main
          className={cn(
            "flex-1 w-full mx-auto",
            isPracticeFlow ? "max-w-6xl" : "max-w-7xl",
            !isPracticeFlow && "tab-bar-offset lg:pb-12",
          )}
        >
          {children}
        </main>
      </div>

      {/* 移动端底部悬浮胶囊导航 */}
      {!isPracticeFlow && <TabBar />}
      <ServiceWorkerRegister />
    </div>
  );
}

function SplashScreen() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5">
      <div className="ambient-bg" />
      <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-tr from-ios-blue via-ios-indigo to-ios-purple shadow-2xl shadow-ios-blue/35 ring-4 ring-white/70 dark:ring-white/10 animate-pulse-subtle">
        <span className="text-[34px] font-extrabold text-white tracking-tight">题</span>
      </div>
      <div className="flex items-center gap-2.5 rounded-full border border-white/60 bg-ios-surface/80 px-4 py-2 text-[14px] font-medium text-ios-label-secondary shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-ios-surface/40">
        <Loader2 className="h-4 w-4 animate-spin text-ios-blue" />
        正在开启题库空间…
      </div>
    </div>
  );
}
