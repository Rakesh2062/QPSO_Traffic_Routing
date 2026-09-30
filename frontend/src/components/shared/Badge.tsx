"use client";

import { clsx } from "clsx";

type StatusType = "queued" | "running" | "completed" | "failed" | "cancelled";

const configs: Record<StatusType, { dot: string; bg: string; text: string; label: string; pulse: boolean }> = {
  queued:    { dot: "bg-slate-400", bg: "bg-slate-800/60 border-slate-700", text: "text-slate-300", label: "Queued", pulse: false },
  running:   { dot: "bg-cyan-400",  bg: "bg-cyan-950/60 border-cyan-800/60", text: "text-cyan-300", label: "Running", pulse: true },
  completed: { dot: "bg-emerald-400", bg: "bg-emerald-950/60 border-emerald-800/60", text: "text-emerald-300", label: "Completed", pulse: false },
  failed:    { dot: "bg-rose-400",  bg: "bg-rose-950/60 border-rose-800/60", text: "text-rose-300", label: "Failed", pulse: false },
  cancelled: { dot: "bg-amber-400", bg: "bg-amber-950/60 border-amber-800/60", text: "text-amber-300", label: "Cancelled", pulse: false },
};

interface BadgeProps {
  status: StatusType | string;
  className?: string;
}

export function Badge({ status, className }: BadgeProps) {
  const cfg = configs[status as StatusType] ?? configs.queued;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
        cfg.bg,
        cfg.text,
        className
      )}
    >
      <span className="relative flex h-2 w-2">
        {cfg.pulse && (
          <span className={clsx("animate-ping absolute inline-flex h-full w-full rounded-full opacity-75", cfg.dot)} />
        )}
        <span className={clsx("relative inline-flex rounded-full h-2 w-2", cfg.dot)} />
      </span>
      {cfg.label}
    </span>
  );
}
