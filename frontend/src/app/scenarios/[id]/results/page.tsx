"use client";

import { use, useEffect, useState } from "react";
import { Download, Map, BarChart3, ChevronDown, ChevronUp, Truck } from "lucide-react";
import { NetworkMap } from "@/components/map/NetworkMap";
import { RealRoadMap } from "@/components/map/RealRoadMap";
import { ConvergenceChart } from "@/components/charts/ConvergenceChart";
import { MetricBarChart } from "@/components/charts/MetricBarChart";
import { StatCard } from "@/components/shared/StatCard";
import { Badge } from "@/components/shared/Badge";
import { MOCK_GRAPHS } from "@/lib/mockData";
import { api } from "@/lib/api";
import { ScenarioResultsResponse, AlgorithmResult } from "@/types";

const ROUTE_COLORS = ["#06b6d4", "#6366f1", "#10b981", "#f59e0b", "#f43f5e"];

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function ScenarioResultsPage({ params }: PageProps) {
  const { id: jobId } = use(params);
  const [results, setResults] = useState<ScenarioResultsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAlgo, setSelectedAlgo] = useState<string>("QPSO (Proposed)");
  const [expandedRoute, setExpandedRoute] = useState<number | null>(0);
  const [selectedVehicle, setSelectedVehicle] = useState<number | null>(null);
  const [mapViewMode, setMapViewMode] = useState<"grid" | "real_osm">("grid");

  useEffect(() => {
    api.getScenarioResults(jobId).then((data) => {
      setResults(data);
      const algos = Object.keys(data.algorithms);
      if (algos.length > 0) setSelectedAlgo(algos[0]);
      setLoading(false);
    });
  }, [jobId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-700 border-t-cyan-400 mx-auto mb-4" />
          <p className="text-sm text-slate-400">Loading scenario results…</p>
        </div>
      </div>
    );
  }

  if (!results) return null;

  const algoResult: AlgorithmResult | undefined = results.algorithms[selectedAlgo];
  const graph = MOCK_GRAPHS[0];
  const activeRoutes = algoResult?.routes?.map((r) => r.stops) ?? [];

  const qpso = results.algorithms["QPSO (Proposed)"];
  const bestBaseline = Object.entries(results.algorithms)
    .filter(([k]) => k !== "QPSO (Proposed)" && results.algorithms[k].final_fitness)
    .sort(([, a], [, b]) => (a.final_fitness ?? Infinity) - (b.final_fitness ?? Infinity))[0];

  const improvement = qpso?.final_fitness && bestBaseline?.[1]?.final_fitness
    ? (((bestBaseline[1].final_fitness - qpso.final_fitness) / bestBaseline[1].final_fitness) * 100).toFixed(1)
    : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-7 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan-500 mb-1">Scenario Results</p>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Badge status="completed" />
            <span className="font-mono text-lg text-slate-300">{jobId.slice(0, 18)}…</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const csv = results.algorithms["QPSO (Proposed)"]?.routes
                ?.map((r) => `${r.vehicle_id},${r.stops.join("→")},${r.distance},${r.time},${r.load}`)
                .join("\n");
              const blob = new Blob([`vehicle_id,route,distance_m,time_min,load\n${csv}`], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `qpso_routes_${jobId}.csv`;
              a.click();
            }}
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Best Fitness (QPSO)" value={qpso?.final_fitness?.toFixed(3) ?? " - "} sub="Final optimized cost" accent="cyan" />
        <StatCard label="Total Distance" value={qpso?.total_distance ? `${(qpso.total_distance / 1000).toFixed(1)} km` : " - "} sub="All routes combined" accent="indigo" />
        <StatCard label="Travel Time" value={qpso?.total_time ? `${qpso.total_time.toFixed(1)} min` : " - "} sub="Fleet total" accent="emerald" />
        {improvement && (
          <StatCard label="QPSO Improvement" value={`${improvement}%`} sub={`vs. best baseline (${bestBaseline![0]})`} accent="amber" />
        )}
        {!improvement && (
          <StatCard label="Violations" value={qpso?.constraint_violations ?? 0} sub="Constraint violations" accent="rose" />
        )}
      </div>

      {/* Algorithm Selector Tabs */}
      <div className="mb-5 flex flex-wrap gap-2">
        {Object.keys(results.algorithms).map((algo, idx) => {
          const r = results.algorithms[algo];
          const isSelected = algo === selectedAlgo;
          return (
            <button
              key={algo}
              onClick={() => setSelectedAlgo(algo)}
              className={`flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-all ${
                isSelected
                  ? "border-cyan-700 bg-cyan-950/60 text-cyan-300"
                  : "border-slate-700 bg-slate-800/40 text-slate-400 hover:border-slate-600 hover:text-slate-300"
              }`}
            >
              <span
                className="h-2 w-2 rounded-full flex-shrink-0"
                style={{ background: ROUTE_COLORS[idx % ROUTE_COLORS.length] }}
              />
              {algo}
              {r.final_fitness && (
                <span className="font-mono text-[10px] text-slate-500">{r.final_fitness.toFixed(2)}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5 mb-6">
        {/* Map */}
        <div className="xl:col-span-3 flex flex-col gap-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-1">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Map className="h-4 w-4 text-cyan-400" />
                <span className="text-sm font-semibold text-white">Route Visualization  -  {selectedAlgo}</span>
              </div>
              <div className="flex items-center p-0.5 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                <button
                  onClick={() => setMapViewMode("grid")}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                    mapViewMode === "grid" ? "bg-cyan-950 text-cyan-300 border border-cyan-800" : "text-slate-400 hover:text-white"
                  }`}
                >
                  🏙️ City Grid View
                </button>
                <button
                  onClick={() => setMapViewMode("real_osm")}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                    mapViewMode === "real_osm" ? "bg-indigo-950 text-indigo-300 border border-indigo-800" : "text-slate-400 hover:text-white"
                  }`}
                >
                  🗺️ Real OSM Map
                </button>
              </div>
            </div>

            {mapViewMode === "grid" ? (
              <NetworkMap
                graphData={graph.graph_data}
                activeRoutes={activeRoutes}
                depotNodeId="depot"
                className="h-[380px]"
                selectedVehicleIndex={selectedVehicle}
                onSelectVehicle={(idx) => {
                  setSelectedVehicle(idx);
                  if (idx !== null) setExpandedRoute(idx);
                }}
              />
            ) : (
              <div className="p-2">
                <RealRoadMap />
              </div>
            )}
          </div>
        </div>

        {/* Per-vehicle route list */}
        <div className="xl:col-span-2 rounded-xl border border-slate-800 bg-slate-900/60 p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-indigo-400" />
              <h2 className="font-semibold text-white text-sm">Vehicle Routes ({algoResult?.routes?.length || 0})</h2>
            </div>
            {selectedVehicle !== null && (
              <button
                onClick={() => setSelectedVehicle(null)}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold"
              >
                Show All Paths
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 max-h-[320px]">
            {algoResult?.routes?.map((route, idx) => {
              const loadPct = route.load / 100;
              const isSelected = selectedVehicle === idx;
              const isExpanded = expandedRoute === idx;
              return (
                <div
                  key={idx}
                  className={`rounded-lg border transition-all ${
                    isSelected
                      ? "border-cyan-500/80 bg-cyan-950/20 shadow-md shadow-cyan-500/10"
                      : "border-slate-800 bg-slate-900/60"
                  } overflow-hidden`}
                >
                  <button
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800/40 transition-colors"
                    onClick={() => {
                      const next = isSelected ? null : idx;
                      setSelectedVehicle(next);
                      setExpandedRoute(isExpanded ? null : idx);
                    }}
                  >
                    <span
                      className="h-3 w-3 rounded-full flex-shrink-0"
                      style={{ background: ROUTE_COLORS[idx % ROUTE_COLORS.length] }}
                    />
                    <span className="text-sm font-semibold text-slate-200 flex-1 text-left">
                      Vehicle {route.vehicle_id}
                    </span>
                    {isSelected && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                        Selected Path
                      </span>
                    )}
                    <span className="text-xs text-slate-500 font-mono">{route.stops.length - 2} stops</span>
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-slate-500" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-500" />}
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-3 border-t border-slate-800">
                      {/* Load Bar */}
                      <div className="flex items-center gap-2 mt-3 mb-2">
                        <span className="text-[10px] text-slate-500 w-10">Load</span>
                        <div className="flex-1 h-1.5 rounded-full bg-slate-800">
                          <div
                            className="h-1.5 rounded-full transition-all"
                            style={{
                              width: `${Math.min(loadPct * 100, 100)}%`,
                              background: loadPct > 0.9 ? "#f43f5e" : loadPct > 0.7 ? "#f59e0b" : "#10b981",
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono w-14 text-right">
                          {route.load} / 100
                        </span>
                      </div>
                      {/* Route stops */}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {route.stops.map((stop, si) => (
                          <span
                            key={si}
                            className="rounded-md bg-slate-800 px-2 py-0.5 text-[11px] font-mono text-slate-300 border border-slate-700"
                          >
                            {stop === "depot" ? "🏭 depot" : stop}
                          </span>
                        ))}
                      </div>
                      <div className="flex gap-4 mt-3 text-xs text-slate-500">
                        <span>Dist: <strong className="text-slate-300">{(route.distance / 1000).toFixed(1)} km</strong></span>
                        <span>Time: <strong className="text-slate-300">{route.time.toFixed(1)} min</strong></span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Cost Breakdown */}
          <div className="rounded-lg border border-slate-800 bg-slate-900/80 px-4 py-3 space-y-2">
            <p className="text-xs font-semibold uppercase text-slate-500 tracking-wide mb-2">Cost Breakdown</p>
            {[
              { label: "Total Distance", value: algoResult?.total_distance ? `${(algoResult.total_distance / 1000).toFixed(2)} km` : " - ", ok: true },
              { label: "Total Travel Time", value: algoResult?.total_time ? `${algoResult.total_time.toFixed(2)} min` : " - ", ok: true },
              { label: "Congestion Penalty", value: algoResult?.congestion_penalty?.toFixed(3) ?? " - ", ok: (algoResult?.congestion_penalty ?? 0) < 10 },
              { label: "Constraint Violations", value: algoResult?.constraint_violations ?? 0, ok: algoResult?.constraint_violations === 0 },
              { label: "Wall-Clock Time", value: algoResult?.wall_clock_ms ? `${algoResult.wall_clock_ms} ms` : " - ", ok: true },
            ].map(({ label, value, ok }) => (
              <div key={label} className="flex justify-between items-center">
                <span className="text-xs text-slate-400">{label}</span>
                <span className={`text-xs font-mono font-semibold ${ok ? "text-emerald-400" : "text-rose-400"}`}>
                  {String(value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts Side by Side */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-cyan-400" />
            <h2 className="font-semibold text-white text-sm">Algorithm Convergence Comparison</h2>
          </div>
          <ConvergenceChart data={results.convergence_history} height={300} />
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-4 w-4 text-indigo-400" />
            <h2 className="font-semibold text-white text-sm">Multi-Objective Metric Comparison</h2>
          </div>
          <MetricBarChart algorithms={results.algorithms} />
        </div>
      </div>
    </div>
  );
}
