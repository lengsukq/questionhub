"use client";

import { useSyncExternalStore } from "react";
import { CheckCircle2, AlertCircle, Info, XCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

// 轻量级全局 Toast 状态总线
class ToastStore {
  private toasts: ToastItem[] = [];
  private listeners = new Set<() => void>();

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.toasts;

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  show(message: string, type: ToastType = "info", duration = 3000) {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const item: ToastItem = { id, message, type, duration };
    this.toasts = [...this.toasts, item];
    this.notify();

    if (duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, duration);
    }
    return id;
  }

  dismiss = (id: string) => {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.notify();
  };

  success(message: string, duration?: number) {
    return this.show(message, "success", duration);
  }

  error(message: string, duration?: number) {
    return this.show(message, "error", duration);
  }

  info(message: string, duration?: number) {
    return this.show(message, "info", duration);
  }

  warning(message: string, duration?: number) {
    return this.show(message, "warning", duration);
  }
}

export const toast = new ToastStore();

export function ToastContainer() {
  const toasts = useSyncExternalStore(toast.subscribe, toast.getSnapshot, () => []);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed top-4 inset-x-0 z-50 flex flex-col items-center gap-2.5 px-4 sm:top-6"
    >
      {toasts.map((item) => (
        <ToastCard key={item.id} item={item} onDismiss={() => toast.dismiss(item.id)} />
      ))}
    </div>
  );
}

function ToastCard({
  item,
  onDismiss,
}: {
  item: ToastItem;
  onDismiss: () => void;
}) {
  const iconMap = {
    success: <CheckCircle2 className="h-4 w-4 text-ios-green shrink-0" />,
    error: <XCircle className="h-4 w-4 text-ios-red shrink-0" />,
    warning: <AlertCircle className="h-4 w-4 text-ios-orange shrink-0" />,
    info: <Info className="h-4 w-4 text-ios-blue shrink-0" />,
  };

  const borderMap = {
    success: "border-ios-green/30 bg-ios-surface/95 text-ios-label",
    error: "border-ios-red/30 bg-ios-surface/95 text-ios-label",
    warning: "border-ios-orange/30 bg-ios-surface/95 text-ios-label",
    info: "border-ios-blue/30 bg-ios-surface/95 text-ios-label",
  };

  return (
    <div
      className={cn(
        "pointer-events-auto flex items-center gap-2.5 rounded-2xl border px-4 py-3 shadow-xl shadow-black/10 backdrop-blur-xl transition-all duration-300 animate-in fade-in slide-in-from-top-3 max-w-md w-full sm:w-auto",
        borderMap[item.type],
      )}
    >
      {iconMap[item.type]}
      <p className="text-[13px] font-semibold tracking-tight text-ios-label flex-1 select-none">
        {item.message}
      </p>
      <button
        onClick={onDismiss}
        className="ml-1 -mr-1 p-1 rounded-lg text-ios-label-tertiary hover:text-ios-label transition-colors cursor-pointer"
        aria-label="关闭提示"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
