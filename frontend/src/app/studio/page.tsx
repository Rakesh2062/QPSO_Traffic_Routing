"use client";

import { DualSectionGraphStudio } from "@/components/map/DualSectionGraphStudio";
import { Sparkles, Map, Cpu } from "lucide-react";

export default function StudioPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 space-y-6">
      {/* Studio Banner */}
      <div>
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-800/40 bg-cyan-950/30 px-3 py-1 text-xs font-semibold text-cyan-400 mb-3">
          <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
          Real Road Snapping & Synthetic Step Engine
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">
          Routing & Graph Studio
        </h1>
        <p className="max-w-3xl text-sm text-slate-400 leading-relaxed">
          Switch between the <strong className="text-cyan-300">Real Map</strong> (click anywhere to snap delivery stops strictly onto drivable roads and route along authentic road curves) and the <strong className="text-indigo-300">Synthetic Graph</strong> (watch network assembly and quantum optimization evolve one-by-one step-by-step).
        </p>
      </div>

      {/* Dual Section Studio */}
      <DualSectionGraphStudio />
    </div>
  );
}
