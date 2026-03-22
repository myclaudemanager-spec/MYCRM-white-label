"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ANALYTICS_TABS = [
  { label: "Global", href: "/analytics/overview" },
  { label: "FB Live", href: "/analytics/facebook-live" },
  { label: "FB Ads", href: "/analytics/facebook-ads" },
  { label: "Dépenses", href: "/analytics/ad-spend" },
  { label: "ROI", href: "/analytics/roi" },
];

export default function AnalyticsTabs() {
  const pathname = usePathname();
  return (
    <div className="relative mb-5">
      <div className="flex gap-1 bg-card rounded-xl border border-border p-1.5 overflow-x-auto scrollbar-none">
        {ANALYTICS_TABS.map(tab => {
          const active = pathname === tab.href;
          return (
            <Link key={tab.href} href={tab.href}
              className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                active
                  ? "bg-primary text-white"
                  : "text-muted hover:text-secondary hover:bg-bg"
              }`}>
              {tab.label}
            </Link>
          );
        })}
      </div>
      {/* Gradient fade-out indiquant le scroll */}
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-bg to-transparent rounded-r-xl sm:hidden" />
    </div>
  );
}
