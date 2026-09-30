"use client";

import { useState } from "react";
import { Map, Cpu } from "lucide-react";
import { RealRoadMap } from "@/components/map/RealRoadMap";
import { SyntheticStepGraph } from "@/components/map/SyntheticStepGraph";
import { BenchmarkPanel, BenchmarkConfig } from "@/components/charts/BenchmarkPanel";

interface DualSectionGraphStudioProps {
  initialSection?: "real" | "synthetic";
  className?: string;
}

export function DualSectionGraphStudio({
  initialSection = "real",
  className = "",
}: DualSectionGraphStudioProps) {
  const [activeSection, setActiveSection] = useState<"real" | "synthetic">(initialSection);
  const [benchmarkConfig, setBenchmarkConfig] = useState<BenchmarkConfig | null>(null);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Studio Top Header & Section Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex h-2 w-2 rounded-full bg-cyan-400" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">
              Interactive Network Studio
            </span>
          </div>
          <h2 className="text-xl font-bold text-white">
            {activeSection === "real" ? "Real-World Road Routing" : "Synthetic Graph Step-by-Step"}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {activeSection === "real"
              ? "Click on real street maps to place deliveries. Routes strictly snap & follow road geometry (preventing water/off-road lines)."
              : "Watch the synthetic network topology assemble and optimize one-by-one as the quantum swarm algorithm advances."}
          </p>
        </div>

        {/* Section Toggle Pill Switcher */}
        <div className="flex items-center p-1 rounded-xl bg-slate-950 border border-slate-800 shrink-0">
          <button
            onClick={() => setActiveSection("real")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeSection === "real"
                ? "bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-lg shadow-cyan-500/20"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Map className="h-4 w-4" />
            <span>Real Road Map</span>
          </button>
          <button
            onClick={() => setActiveSection("synthetic")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              activeSection === "synthetic"
                ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/20"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Cpu className="h-4 w-4" />
            <span>Synthetic Step Graph</span>
          </button>
        </div>
      </div>

      {/* Render Active Section */}
      {activeSection === "real" ? (
        <RealRoadMap />
      ) : (
        <SyntheticStepGraph
          onRunQPSO={(config) => {
            setBenchmarkConfig(config);
          }}
        />
      )}

      {/* Benchmark Panel  -  shown below studio after QPSO runs on synthetic graph */}
      {activeSection === "synthetic" && benchmarkConfig && (
        <div className="mt-2">
          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
              Benchmark Results
            </span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-700 to-transparent" />
          </div>
          <BenchmarkPanel config={benchmarkConfig} />
        </div>
      )}
    </div>
  );
}
