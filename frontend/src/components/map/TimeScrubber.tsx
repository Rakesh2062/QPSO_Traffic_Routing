"use client";

import { Clock, Sun, Moon } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";

export function TimeScrubber() {
  const { timeOfDaySeconds, setTimeOfDaySeconds } = useAppStore();

  const hours = Math.floor(timeOfDaySeconds / 3600);
  const minutes = Math.floor((timeOfDaySeconds % 3600) / 60);
  const formattedTime = `${hours.toString().padStart(2, "0")}:${minutes
    .toString()
    .padStart(2, "0")}`;

  // Peak congestion intervals: Morning 8:00 (28800) & Evening 17:00 (61200)
  const isMorningPeak = hours >= 7 && hours <= 10;
  const isEveningPeak = hours >= 16 && hours <= 19;
  const isPeak = isMorningPeak || isEveningPeak;

  return (
    <div className="glass-panel rounded-xl p-3.5 shadow-lg">
      <div className="flex items-center justify-between gap-4 mb-2">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-cyan-400" />
          <span className="text-xs font-semibold text-slate-300">Simulation Clock</span>
        </div>
        <div className="flex items-center gap-2">
          {hours >= 6 && hours <= 18 ? (
            <Sun className="h-3.5 w-3.5 text-amber-400" />
          ) : (
            <Moon className="h-3.5 w-3.5 text-indigo-400" />
          )}
          <span className="font-mono text-sm font-bold text-white bg-slate-900/90 px-2 py-0.5 rounded border border-slate-700">
            {formattedTime}
          </span>
          {isPeak && (
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-rose-950/80 text-rose-400 border border-rose-800 animate-pulse">
              Rush Hour Peak
            </span>
          )}
        </div>
      </div>

      <input
        type="range"
        min={0}
        max={86400}
        step={300} // 5 min steps
        value={timeOfDaySeconds}
        onChange={(e) => setTimeOfDaySeconds(Number(e.target.value))}
        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
      />

      <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
        <span>00:00 (Night)</span>
        <span className="text-rose-400/80 font-semibold">08:00 AM Peak</span>
        <span>12:00 (Noon)</span>
        <span className="text-rose-400/80 font-semibold">17:00 PM Peak</span>
        <span>23:59 (Night)</span>
      </div>
    </div>
  );
}
