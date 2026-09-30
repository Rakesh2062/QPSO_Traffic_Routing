"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Clock, RefreshCw, MapPin, Truck, AlertTriangle, CheckCircle } from "lucide-react";
import { Badge } from "@/components/shared/Badge";

interface HistoryEntry {
  id: string;
  name: string;
  graph: string;
  status: string;
  created_at: string;
  fitness: number | null;
  runtime_ms: number | null;
  // Road map specific
  city?: string;
  totalDistanceKm?: number;
  totalTimeMinutes?: number;
  numVehicles?: number;
  numStops?: number;
  trafficCondition?: string;
  twViolations?: number;
  routeCount?: number;
  source?: "real_road" | "mock";
}

const MOCK_HISTORY: HistoryEntry[] = [
  {
    id: "job-e5f6g7h8",
    name: "Grid 5×5  -  4 vehicles (GA Comparison)",
    status: "completed",
    graph: "Synthetic 5×5 Grid",
    created_at: new Date(Date.now() - 3600000 * 8).toISOString(),
    fitness: 38.1,
    runtime_ms: 2310,
    source: "mock",
  },
  {
    id: "job-m3n4o5p6",
    name: "Erdős - Rényi 30 nodes  -  Throughput Test",
    status: "completed",
    graph: "ER-30 Random Graph",
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    fitness: 51.4,
    runtime_ms: 4920,
    source: "mock",
  },
  {
    id: "job-q7r8s9t0",
    name: "Barabási - Albert 20 nodes",
    status: "completed",
    graph: "BA-20 Scale-Free",
    created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
    fitness: 47.9,
    runtime_ms: 3250,
    source: "mock",
  },
];

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function TrafficBadge({ condition }: { condition?: string }) {
  if (!condition) return null;
  const map: Record<string, { label: string; color: string }> = {
    free_flow: { label: "🟢 Free Flow", color: "text-emerald-400" },
    moderate: { label: "🟡 Moderate", color: "text-amber-400" },
    heavy: { label: "🔴 Heavy", color: "text-rose-400" },
    gridlock: { label: "🚨 Gridlock", color: "text-rose-600" },
  };
  const info = map[condition] || { label: condition, color: "text-slate-400" };
  return <span className={`text-[10px] font-semibold ${info.color}`}>{info.label}</span>;
}

export default function HistoryPage() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  const loadHistory = () => {
    try {
      const stored: HistoryEntry[] = JSON.parse(
        localStorage.getItem("qpso_road_history") || "[]"
      );
      const tagged = stored.map((e) => ({ ...e, source: "real_road" as const }));
      setEntries([...tagged, ...MOCK_HISTORY]);
    } catch {
      setEntries(MOCK_HISTORY);
    }
  };

  useEffect(() => {
    loadHistory();
    const handleFocus = () => loadHistory();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  const realCount = entries.filter((e) => e.source === "real_road").length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan-500 mb-1">Run History</p>
          <h1 className="text-3xl font-bold text-white">Past Optimization Jobs</h1>
          <p className="text-sm text-slate-400 mt-1">
            {realCount > 0 ? (
              <>
                <span className="text-cyan-400 font-semibold">{realCount} real road run{realCount > 1 ? "s" : ""}</span>
                {" "}+ {MOCK_HISTORY.length} example runs
              </>
            ) : (
              <>Run an optimization from the Real Road Map tab to see your history here.</>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadHistory}
            className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-700 transition-all"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <Link
            href="/studio"
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-indigo-600 px-4 py-2 text-sm font-bold text-white shadow hover:from-cyan-400 transition-all"
          >
            + New Run
          </Link>
        </div>
      </div>

      {/* Real Road Runs info banner */}
      {realCount === 0 && (
        <div className="mb-6 rounded-xl border border-dashed border-cyan-900/50 bg-cyan-950/20 p-5 text-center">
          <MapPin className="h-8 w-8 text-cyan-600 mx-auto mb-2" />
          <p className="text-sm text-slate-300 font-medium">No real road optimization runs yet</p>
          <p className="text-xs text-slate-500 mt-1">
            Go to{" "}
            <Link href="/studio" className="text-cyan-400 hover:underline">
              Studio → Real Road Map
            </Link>{" "}
            and click <strong className="text-white">Solve with QPSO</strong> to generate history.
          </p>
        </div>
      )}

      {/* Entry Cards */}
      <div className="space-y-3">
        {entries.map((job) => (
          <div
            key={job.id}
            className={`rounded-xl border p-4 transition-all ${
              job.source === "real_road"
                ? "border-cyan-900/50 bg-slate-900/80 hover:border-cyan-800/60 shadow-md shadow-cyan-950/20"
                : "border-slate-800 bg-slate-900/40 hover:border-slate-700 opacity-70"
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              {/* Left: main info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  {job.source === "real_road" && (
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-950/50 border border-cyan-900/50 px-2 py-0.5 rounded-full">
                      <MapPin className="h-2.5 w-2.5" /> Real Road
                    </span>
                  )}
                  <Badge status={job.status} />
                  {job.twViolations !== undefined && (
                    <span
                      className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                        job.twViolations > 0
                          ? "text-rose-400 bg-rose-950/40 border-rose-900/40"
                          : "text-emerald-400 bg-emerald-950/40 border-emerald-900/40"
                      }`}
                    >
                      {job.twViolations > 0 ? (
                        <>
                          <AlertTriangle className="h-2.5 w-2.5" />
                          {job.twViolations} TW violation{job.twViolations > 1 ? "s" : ""}
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-2.5 w-2.5" />
                          No violations
                        </>
                      )}
                    </span>
                  )}
                </div>
                <p className="font-semibold text-slate-100 text-sm">{job.name}</p>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">{job.graph}</p>
              </div>

              {/* Right: metrics */}
              <div className="flex flex-wrap items-center gap-4 text-right">
                {job.fitness !== null && (
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-semibold">Fitness</p>
                    <p className="text-sm font-mono font-bold text-cyan-300">{job.fitness?.toFixed(3)}</p>
                  </div>
                )}
                {job.totalDistanceKm !== undefined && (
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-semibold">Distance</p>
                    <p className="text-sm font-mono font-bold text-indigo-300">{job.totalDistanceKm.toFixed(1)} km</p>
                  </div>
                )}
                {job.totalTimeMinutes !== undefined && (
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-semibold">Drive Time</p>
                    <p className="text-sm font-mono font-bold text-emerald-300">{job.totalTimeMinutes.toFixed(0)} min</p>
                  </div>
                )}
                {job.numVehicles !== undefined && (
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-semibold">Fleet</p>
                    <p className="text-sm font-mono font-bold text-amber-300 flex items-center gap-1">
                      <Truck className="h-3 w-3" />
                      {job.numVehicles}
                    </p>
                  </div>
                )}
                {job.runtime_ms !== null && (
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase font-semibold">Runtime</p>
                    <p className="text-sm font-mono text-slate-400">{job.runtime_ms} ms</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer: extra detail strip */}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/60 pt-2">
              <div className="flex items-center gap-4 text-[11px] text-slate-500 flex-wrap">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {relativeTime(job.created_at)}
                </span>
                {job.trafficCondition && <TrafficBadge condition={job.trafficCondition} />}
                {job.numStops !== undefined && <span>📦 {job.numStops} stops</span>}
                {job.routeCount !== undefined && (
                  <span>🗺️ {job.routeCount} active route{job.routeCount !== 1 ? "s" : ""}</span>
                )}
              </div>
              <Link
                href="/studio"
                className="flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1 text-[11px] text-slate-400 hover:bg-slate-800 transition-colors"
              >
                <RefreshCw className="h-3 w-3" />
                Re-run
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
