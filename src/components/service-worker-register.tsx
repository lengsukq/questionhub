"use client";

import { useEffect } from "react";

/** 生产环境注册 Service Worker，支持 PWA 安装与离线 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // 注册失败不影响应用功能
    });
  }, []);
  return null;
}
