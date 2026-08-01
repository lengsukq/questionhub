"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
}

/** iOS 风格毛玻璃导航栏 */
export function PageHeader({ title, onBack, right }: PageHeaderProps) {
  const router = useRouter();
  const handleBack = onBack ?? (() => router.back());

  return (
    <header className="glass sticky top-0 z-30 border-b border-ios-separator/60 safe-top">
      <div className="flex h-12 items-center justify-between px-2">
        <div className="flex w-16 items-center">
          <button
            onClick={handleBack}
            aria-label="返回"
            className="flex h-9 w-9 -translate-x-1 items-center justify-center rounded-full text-ios-blue active:bg-ios-blue/10"
          >
            <ChevronLeft className="h-6 w-6" strokeWidth={2.5} />
          </button>
        </div>
        <h1 className="text-[17px] font-semibold text-ios-label">{title}</h1>
        <div className="flex w-16 justify-end pr-1">{right}</div>
      </div>
    </header>
  );
}
