import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / MS_PER_SECOND));
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  if (minutes === 0) return `${seconds} 秒`;
  return `${minutes} 分 ${String(seconds).padStart(2, "0")} 秒`;
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("zh-CN", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });
}

export function formatPercent(correct: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((correct / total) * 100);
}
