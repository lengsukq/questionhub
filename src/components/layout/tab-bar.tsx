"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Library, Repeat, User } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/", label: "首页", icon: Home },
  { href: "/banks", label: "题库", icon: Library },
  { href: "/review", label: "复习", icon: Repeat },
  { href: "/settings", label: "我的", icon: User },
];

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="底部导航"
      className="glass fixed bottom-0 left-1/2 z-40 w-full max-w-[560px] -translate-x-1/2 border-t border-ios-separator/60"
    >
      <div className="safe-bottom grid grid-cols-4">
        {tabs.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-1 pb-1.5 pt-2 text-[10px] font-medium transition-colors",
                isActive ? "text-ios-blue" : "text-ios-label-tertiary",
              )}
            >
              <Icon className="h-6 w-6" strokeWidth={isActive ? 2.4 : 2} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
