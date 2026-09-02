"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
  className?: string;
}

/** 现代毛玻璃导航栏（多端自适应） */
export function PageHeader({
  title,
  subtitle,
  onBack,
  right,
  className,
}: PageHeaderProps) {
  const router = useRouter();
  const handleBack = onBack ?? (() => router.back());

  return (
    <header
      className={cn(
        "glass-header sticky top-0 z-30 px-4 py-3 safe-top transition-all duration-200",
        className,
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            aria-label="返回"
            className="squircle-press flex h-9 w-9 items-center justify-center rounded-xl border border-white/60 bg-ios-surface/80 text-ios-label-secondary shadow-sm hover:border-ios-blue/30 hover:bg-ios-surface hover:text-ios-blue active:scale-95 dark:border-white/10 dark:bg-ios-surface/60"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2.4} />
          </button>
          <div>
            <h1 className="text-[17px] font-bold tracking-tight text-ios-label lg:text-[19px]">
              {title}
            </h1>
            {subtitle && (
              <p className="text-[11px] text-ios-label-tertiary">{subtitle}</p>
            )}
          </div>
        </div>

        {right && <div className="flex items-center gap-2">{right}</div>}
      </div>
    </header>
  );
}
