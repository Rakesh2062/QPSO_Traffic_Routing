"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, Clock, Zap, XCircle, CheckCircle } from "lucide-react";
import { useJobStream } from "@/hooks/useJobStream";
import { NetworkMap } from "@/components/map/NetworkMap";
import { DualSectionGraphStudio } from "@/components/map/DualSectionGraphStudio";
import { ConvergenceChart } from "@/components/charts/ConvergenceChart";
import { TimeScrubber } from "@/components/map/TimeScrubber";
import { StatCard } from "@/components/shared/StatCard";
import { Badge } from "@/components/shared/Badge";
import { MOCK_GRAPHS } from "@/lib/mockData";
import { api } from "@/lib/api";
import { ConvergencePoint } from "@/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function LiveScenarioPage({ params }: PageProps) {
  const { id: jobId } = use(params);
  const router = useRouter();
  const [isCancelling, setIsCancelling] = useState(false);
  const graph = MOCK_GRAPHS[0];

  const { latestMessage, algorithmStreams, throttledRoute, isConnected, isDone } = useJobStream({
    jobId,
    totalIterations: 150,
    onDone: () => {
      setTimeout(() => router.push(`/scenarios/${jobId}/results`), 2000);
    },
  });

  const convergenceHistory: Record<string, ConvergencePoint[]> = Object.keys(algorithmStreams).length > 0
    ? Object.fromEntries(
        Object.entries(algorithmStreams).map(([algo, state]) => [
          algo.toLowerCase() === "qpso" ? "QPSO (Proposed)" : algo.toUpperCase(),
          state.history,
        ])
      )
    : { "QPSO (Proposed)": [] };

  const handleCancel = async () => {
    setIsCancelling(true);
    await api.cancelScenario(jobId);
    router.push("/history");
  };

  const currentIter = latestMessage?.iteration ?? 0;
  const bestFitness = latestMessage?.best_fitness ?? null;
  const elapsedMs = latestMessage?.elapsed_ms ?? 0;
  const activeRoutesForMap = throttledRoute
    ? throttledRoute.map((r) => r.stops)
    : [];

  const [viewMode, setViewMode] = useState<"topology" | "real_map" | "synthetic_step">("topology");

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan-500 mb-1">Live Optimization</p>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Badge status={isDone ? "completed" : "running"} />
            <span className="font-mono text-lg text-slate-300">{jobId.slice(0, 18)}…</span>
          </h1>
        </div>
        <div className="flex gap-2">
          {!isDone && (
            <button
              onClick={handleCancel}
              disabled={isCancelling}
              className="flex items-center gap-2 rounded-lg border border-rose-800/60 bg-rose-950/40 px-4 py-2 text-sm font-semibold text-rose-400 hover:bg-rose-950/80 transition-colors disabled:opacity-60"
            >
              <XCircle className="h-4 w-4" />
              {isCancelling ? "Cancelling…" : "Cancel Job"}
            </button>
          )}
          {isDone && (
            <button
              onClick={() => router.push(`/scenarios/${jobId}/results`)}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 px-4 py-2 text-sm font-bold text-white shadow-md hover:from-cyan-400 transition-all"
            >
              <CheckCircle className="h-4 w-4" />
              View Full Results
            </button>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Current Iteration"
          value={currentIter}
          sub={`of 150 total`}
          icon={<Activity className="h-5 w-5" />}
          accent="cyan"
        />
        <StatCard
          label="Best Fitness"
          value={bestFitness !== null ? bestFitness.toFixed(3) : " - "}
          sub="Lower is better"
          icon={<Zap className="h-5 w-5" />}
          accent="indigo"
        />
        <StatCard
          label="Elapsed Time"
          value={elapsedMs > 0 ? `${(elapsedMs / 1000).toFixed(1)}s` : " - "}
          sub="Wall-clock"
          icon={<Clock className="h-5 w-5" />}
          accent="emerald"
        />
        <StatCard
          label="WS Connection"
          value={isConnected ? "Live" : "Connecting…"}
          sub={isDone ? "Optimization done" : "Streaming telemetry"}
          icon={<Activity className="h-5 w-5" />}
          accent={isConnected ? "emerald" : "amber"}
        />
      </div>

      {/* Section View Mode Switcher */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-900/80 p-2 border border-slate-800">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 px-2">
          Visualization Mode
        </span>
        <div className="flex gap-1">
          <button
            onClick={() => setViewMode("topology")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === "topology"
                ? "bg-slate-800 text-cyan-400 border border-slate-700"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Topology Map
          </button>
          <button
            onClick={() => setViewMode("real_map")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === "real_map"
                ? "bg-gradient-to-r from-cyan-500 to-indigo-600 text-white shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Real Road Map (Snapping)
          </button>
          <button
            onClick={() => setViewMode("synthetic_step")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === "synthetic_step"
                ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-md"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Synthetic Step Graph
          </button>
        </div>
      </div>

      {/* Conditional View Rendering */}
      {viewMode === "real_map" ? (
        <div className="mb-6">
          <DualSectionGraphStudio initialSection="real" />
        </div>
      ) : viewMode === "synthetic_step" ? (
        <div className="mb-6">
          <DualSectionGraphStudio initialSection="synthetic" />
        </div>
      ) : (
        /* Main Layout: Topology Map + Chart */
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
          {/* Map  -  3 cols */}
          <div className="xl:col-span-3 flex flex-col gap-4">
            <NetworkMap
              graphData={graph.graph_data}
              activeRoutes={activeRoutesForMap}
              depotNodeId="depot"
              className="h-[420px]"
            />
            <TimeScrubber />
          </div>

          {/* Convergence Chart  -  2 cols */}
          <div className="xl:col-span-2 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white text-sm">Convergence Curve</h2>
              <span className="text-[10px] text-slate-500 font-mono">
                f(x) vs Iteration
              </span>
            </div>
            <ConvergenceChart data={convergenceHistory} height={360} isLive={!isDone} />
          </div>
        </div>
      )}

      {/* Done Banner */}
      {isDone && (
        <div className="mt-5 rounded-xl border border-emerald-800/60 bg-emerald-950/40 px-6 py-4 text-sm text-emerald-300 flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-emerald-400 flex-shrink-0" />
          <span>
            <strong className="text-emerald-200">Optimization complete.</strong> Redirecting to results in 2 seconds…
          </span>
        </div>
      )}
    </div>
  );
}
