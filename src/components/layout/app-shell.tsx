"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, AlertCircle, RefreshCw, FileUp, Sparkles } from "lucide-react";
import { useBankStore } from "@/stores/bank-store";
import { TabBar } from "@/components/layout/tab-bar";
import { Sidebar } from "@/components/layout/sidebar";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { ready, loading, error, activeBankId, banks, initialize } = useBankStore();

  useEffect(() => {
    void initialize();
  }, [initialize]);

  // 做题沉浸流程隐藏移动端底部 TabBar
  const isPracticeFlow = useMemo(
    () => pathname.startsWith("/practice/"),
    [pathname],
  );

  // 1. 初始化或加载中：展示高颜值呼吸光晕 SplashScreen
  if (!ready || loading) {
    return <SplashScreen />;
  }

  // 2. 加载失败错误态
  if (error) {
    return (
      <div className="relative flex min-h-dvh items-center justify-center p-6 bg-ios-background">
        <div className="ambient-bg" />
        <Card className="flex w-full max-w-md flex-col items-center p-8 text-center shadow-2xl">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-ios-red/30 bg-ios-red/10 text-ios-red shadow-inner">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h1 className="mt-5 text-[20px] font-extrabold text-ios-label">题库加载遇到问题</h1>
          <p className="mt-2 text-[14px] leading-relaxed text-ios-label-secondary">{error}</p>
          <Button
            size="lg"
            className="mt-6 w-full justify-center shadow-lg"
            onClick={() => window.location.reload()}
          >
            <RefreshCw className="h-4 w-4" />
            重新加载
          </Button>
        </Card>
      </div>
    );
  }

  // 3. 库中完全无题库（极端空库引导态）
  if (banks.length === 0 || !activeBankId) {
    return (
      <div className="relative flex min-h-dvh items-center justify-center p-6 bg-ios-background">
        <div className="ambient-bg" />
        <Card className="flex w-full max-w-md flex-col items-center p-8 text-center shadow-2xl">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-tr from-ios-blue to-ios-indigo text-white shadow-lg shadow-ios-blue/25">
            <Sparkles className="h-8 w-8" />
          </div>
          <h1 className="mt-5 text-[20px] font-extrabold text-ios-label">欢迎使用 QuestionHub</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-ios-label-secondary">
            本地尚未检测到可用题库，请点击下方前往题库中心导入或初始化内置题库。
          </p>
          <Button
            size="lg"
            className="mt-6 w-full justify-center shadow-lg"
            onClick={() => router.push("/banks")}
          >
            <FileUp className="h-4 w-4" />
            前往题库中心
          </Button>
        </Card>
      </div>
    );
  }

  // 4. 正常主工作台
  return (
    <div className="relative flex min-h-dvh w-full bg-ios-background overflow-x-hidden">
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
    <div className="relative flex min-h-dvh flex-col items-center justify-center p-6 bg-ios-background select-none">
      <div className="ambient-bg" />

      {/* 呼吸光晕 Logo */}
      <div className="relative flex flex-col items-center">
        <div className="relative flex h-22 w-22 items-center justify-center rounded-[28px] bg-gradient-to-tr from-ios-blue via-ios-indigo to-ios-purple shadow-2xl shadow-ios-blue/40 ring-4 ring-white/80 dark:ring-white/10 animate-pulse-subtle">
          <span className="text-[38px] font-black text-white tracking-tight drop-shadow-sm">题</span>
        </div>

        {/* 品牌名称 */}
        <h2 className="mt-5 text-[20px] font-extrabold tracking-tight text-ios-label">
          QuestionHub
        </h2>
        <p className="mt-1 text-[13px] font-medium text-ios-label-tertiary">
          极简现代刷题空间
        </p>

        {/* 毛玻璃加载中指示器 */}
        <div className="mt-8 flex items-center gap-2.5 rounded-full border border-white/70 bg-ios-surface/85 px-4 py-2 text-[13px] font-semibold text-ios-label-secondary shadow-md backdrop-blur-xl dark:border-white/10 dark:bg-ios-surface/50">
          <Loader2 className="h-4 w-4 animate-spin text-ios-blue" />
          <span>正在开启题库空间…</span>
        </div>
      </div>
    </div>
  );
}
