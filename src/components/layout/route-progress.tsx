"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

// 全局路由过渡进度条
export function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const [progress, setProgress] = useState(0);

  const prevRouteRef = useRef({ pathname, search: searchParams?.toString() ?? "" });
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearAllTimers = () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  };

  // 当 pathname 或 searchParams 变化（新路由到达），完成进度条并淡出
  useEffect(() => {
    const currentSearch = searchParams?.toString() ?? "";
    const routeChanged =
      prevRouteRef.current.pathname !== pathname || prevRouteRef.current.search !== currentSearch;

    if (routeChanged) {
      prevRouteRef.current = { pathname, search: currentSearch };
      clearAllTimers();
      const t1 = setTimeout(() => {
        setProgress(100);
      }, 0);
      const t2 = setTimeout(() => {
        setActive(false);
        setProgress(0);
      }, 300);
      timersRef.current.push(t1, t2);
    }
  }, [pathname, searchParams]);

  // 全局拦截 link 点击，触发进度条
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest("a");
      if (!target) return;
      const href = target.getAttribute("href");
      if (
        href &&
        href.startsWith("/") &&
        !href.startsWith("#") &&
        target.target !== "_blank" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.shiftKey &&
        !e.altKey
      ) {
        if (href !== window.location.pathname + window.location.search) {
          clearAllTimers();
          setActive(true);
          setProgress(25);
          const t1 = setTimeout(() => setProgress((p) => (p > 0 && p < 80 ? 65 : p)), 120);
          const t2 = setTimeout(() => setProgress((p) => (p > 0 && p < 90 ? 85 : p)), 350);
          timersRef.current.push(t1, t2);
        }
      }
    };

    window.addEventListener("click", handleDocumentClick, { capture: true });
    return () => {
      window.removeEventListener("click", handleDocumentClick, { capture: true });
      clearAllTimers();
    };
  }, []);

  if (!active && progress === 0) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] h-[2.5px] pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      <div
        className={cn(
          "h-full bg-gradient-to-r from-ios-blue via-ios-indigo to-ios-purple shadow-[0_0_8px_rgba(0,122,255,0.7)] transition-all duration-300 ease-out",
          progress === 100 ? "opacity-0 duration-200" : "opacity-100",
        )}
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
