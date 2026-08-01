"use client";

import { useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import { useBankStore } from "@/stores/bank-store";
import { TabBar } from "@/components/layout/tab-bar";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { loading, error, activeBankId, initialize } = useBankStore();

  useEffect(() => {
    void initialize();
  }, [initialize]);

  // 做题流程为沉浸式页面，隐藏底部导航
  const showTabBar = useMemo(
    () => !pathname.startsWith("/practice/"),
    [pathname],
  );

  if (loading) {
    return <SplashScreen />;
  }

  if (error) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-ios-red/10">
          <AlertCircle className="h-8 w-8 text-ios-red" />
        </div>
        <h1 className="text-[17px] font-semibold">加载失败</h1>
        <p className="text-[15px] text-ios-label-secondary">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-full bg-ios-blue px-5 py-2.5 text-[15px] font-medium text-white"
        >
          重试
        </button>
      </div>
    );
  }

  if (!activeBankId) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-[15px] text-ios-label-secondary">尚未找到题库</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col bg-ios-background">
      <main className={cn("flex-1", showTabBar && "tab-bar-offset")}>{children}</main>
      {showTabBar && <TabBar />}
      <ServiceWorkerRegister />
    </div>
  );
}

function SplashScreen() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-ios-blue shadow-lg shadow-ios-blue/30">
        <span className="text-[28px] font-bold text-white">题</span>
      </div>
      <div className="flex items-center gap-2 text-[15px] text-ios-label-secondary">
        <Loader2 className="h-4 w-4 animate-spin" />
        正在加载题库…
      </div>
    </div>
  );
}
