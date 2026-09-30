"use client";

import { DualSectionGraphStudio } from "@/components/map/DualSectionGraphStudio";

export default function NewScenarioPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-cyan-500 mb-1">
          Interactive Routing Engine
        </p>
        <h1 className="text-3xl font-bold text-white">Configure Scenario</h1>
        <p className="mt-2 text-sm text-slate-400">
          Design real road networks or step-by-step synthetic graphs, configure vehicle fleet &amp; time constraints, and solve using Quantum-Behaved Particle Swarm Optimization (QPSO).
        </p>
      </div>

      <div className="space-y-4">
        <DualSectionGraphStudio />
      </div>
    </div>
  );
}
