"use client";

import { ReactNode } from "react";
import { clsx } from "clsx";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: ReactNode;
  accent?: "cyan" | "emerald" | "indigo" | "amber" | "rose";
  className?: string;
}

const accentMap: Record<string, string> = {
  cyan:    "from-cyan-500/10 to-cyan-500/0 border-cyan-800/40 shadow-cyan-500/10",
  emerald: "from-emerald-500/10 to-emerald-500/0 border-emerald-800/40 shadow-emerald-500/10",
  indigo:  "from-indigo-500/10 to-indigo-500/0 border-indigo-800/40 shadow-indigo-500/10",
  amber:   "from-amber-500/10 to-amber-500/0 border-amber-800/40 shadow-amber-500/10",
  rose:    "from-rose-500/10 to-rose-500/0 border-rose-800/40 shadow-rose-500/10",
};

const iconMap: Record<string, string> = {
  cyan:    "text-cyan-400 bg-cyan-950/60",
  emerald: "text-emerald-400 bg-emerald-950/60",
  indigo:  "text-indigo-400 bg-indigo-950/60",
  amber:   "text-amber-400 bg-amber-950/60",
  rose:    "text-rose-400 bg-rose-950/60",
};

export function StatCard({ label, value, sub, icon, accent = "cyan", className }: StatCardProps) {
  return (
    <div
      className={clsx(
        "relative overflow-hidden rounded-xl border bg-gradient-to-b px-5 py-4 shadow-md transition-all hover:scale-[1.01]",
        accentMap[accent],
        className
      )}
    >
      {/* Background glow blob */}
      <div
        className={clsx(
          "pointer-events-none absolute -top-6 -right-6 h-24 w-24 rounded-full opacity-20 blur-2xl",
          accent === "cyan" && "bg-cyan-400",
          accent === "emerald" && "bg-emerald-400",
          accent === "indigo" && "bg-indigo-400",
          accent === "amber" && "bg-amber-400",
          accent === "rose" && "bg-rose-400"
        )}
      />

      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-1.5">
            {label}
          </p>
          <p className="text-2xl font-bold text-white truncate">{value}</p>
          {sub && <p className="mt-1 text-xs text-slate-500 truncate">{sub}</p>}
        </div>
        {icon && (
          <div className={clsx("ml-3 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg", iconMap[accent])}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
