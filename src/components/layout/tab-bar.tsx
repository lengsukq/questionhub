"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Home, Library, Repeat, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/", label: "首页", icon: Home },
  { href: "/banks", label: "题库", icon: Library },
  { href: "/review", label: "复习", icon: Repeat },
  { href: "/analytics", label: "数据", icon: BarChart3 },
  { href: "/settings", label: "我的", icon: Settings },
];

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="底部导航"
      className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-2rem)] max-w-[480px] -translate-x-1/2 lg:hidden"
    >
      <div className="glass-dock flex items-center justify-around rounded-full px-2 py-1.5 shadow-2xl">
        {tabs.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group relative flex flex-1 flex-col items-center justify-center rounded-full py-2 transition-all duration-200 active:scale-95",
                isActive
                  ? "text-ios-blue font-semibold"
                  : "text-ios-label-tertiary hover:text-ios-label-secondary",
              )}
            >
              {isActive && (
                <span className="absolute inset-0 -z-10 rounded-full bg-ios-blue/10 dark:bg-ios-blue/20 transition-all duration-300" />
              )}
              <Icon
                className={cn(
                  "h-5 w-5 transition-transform duration-200",
                  isActive ? "scale-110 text-ios-blue" : "text-ios-label-tertiary group-hover:text-ios-label-secondary",
                )}
                strokeWidth={isActive ? 2.4 : 1.9}
              />
              <span className="mt-0.5 text-[10px] tracking-tight">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
