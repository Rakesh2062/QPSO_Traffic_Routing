import Link from "next/link";
import { Activity, BarChart3, History, Plus, Cpu, Map, Zap, Truck, GitCompare, ArrowRight } from "lucide-react";
import { StatCard } from "@/components/shared/StatCard";
import { Badge } from "@/components/shared/Badge";
import { MOCK_GRAPHS } from "@/lib/mockData";

const RECENT_JOBS = [
  { id: "job-a1b2c3d4", name: "Bengaluru City Center - 3 vehicles", status: "completed", fitness: 42.8, runtime_ms: 1840, when: "2h ago" },
  { id: "job-e5f6g7h8", name: "Grid 5x5 - 4 vehicles", status: "completed", fitness: 38.1, runtime_ms: 2310, when: "8h ago" },
  { id: "job-i9j0k1l2", name: "Evening Rush Hour - 2 vehicles", status: "failed", fitness: null, runtime_ms: null, when: "12h ago" },
];

const FEATURE_CARDS = [
  {
    icon: <Cpu className="h-6 w-6 text-cyan-400" />,
    title: "QPSO Optimizer",
    desc: "Quantum-Behaved Particle Swarm Optimization with adaptive alpha contraction coefficient and 2-Opt local search refinement.",
    href: "/studio",
    cta: "Launch Job →",
    accent: "border-cyan-800/40 bg-cyan-950/20",
  },
  {
    icon: <Map className="h-6 w-6 text-indigo-400" />,
    title: "Real Map & Synthetic Studio",
    desc: "Interactive Leaflet road-snapping map and synthetic step-by-step quantum swarm evolution visualizer.",
    href: "/studio",
    cta: "Open Studio →",
    accent: "border-indigo-800/40 bg-indigo-950/20",
  },
  {
    icon: <GitCompare className="h-6 w-6 text-emerald-400" />,
    title: "Multi-Algorithm Benchmark",
    desc: "Head-to-head comparison against Classical PSO, Genetic Algorithm, Ant Colony Optimization, and OR-Tools exact solver.",
    href: "/benchmark",
    cta: "Compare →",
    accent: "border-emerald-800/40 bg-emerald-950/20",
  },
  {
    icon: <Zap className="h-6 w-6 text-amber-400" />,
    title: "Real-Time Streaming",
    desc: "WebSocket-driven live particle convergence animation, dynamic speed control, and penalty landscape monitoring.",
    href: "/studio",
    cta: "Watch Live →",
    accent: "border-amber-800/40 bg-amber-950/20",
  },
];

export default function HomePage() {
  return (
    <div className="space-y-10 pb-16">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-8 sm:p-12">
        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/20 bg-cyan-950/40 px-3 py-1 text-xs text-cyan-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
            </span>
            Research Platform • Demo Mode Active
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl">
            Traffic-Constrained Vehicle Routing with{" "}
            <span className="bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">
              Quantum Swarm
            </span>
          </h1>
          <p className="text-sm text-slate-300 sm:text-base leading-relaxed">
            High-performance Vehicle Routing with Time Windows (VRPTW) powered by{" "}
            <strong className="text-slate-300">Quantum-Behaved Particle Swarm Optimization (QPSO)</strong>  -  benchmarked
            against Classical PSO, Genetic Algorithms, Ant Colony Optimization, and OR-Tools exact solver.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/studio"
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 px-5 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/25 transition-all"
            >
              <Map className="h-4 w-4 text-slate-950" />
              Interactive Map & Graph Studio
              <ArrowRight className="h-4 w-4 text-slate-950 stroke-[2.5]" />
            </Link>
            <Link
              href="/benchmark"
              className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-5 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition-all"
            >
              <BarChart3 className="h-4 w-4 text-slate-400" />
              Algorithm Benchmarks
            </Link>
          </div>
        </div>
      </section>

      {/* Metric Cards */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Convergence Speed"
          value="60 iter"
          sub="~1,840 ms avg"
          icon={<Zap className="h-5 w-5" />}
          accent="cyan"
        />
        <StatCard
          label="Best Solution"
          value="42.8"
          sub="QPSO • Bengaluru OSM"
          icon={<Zap className="h-5 w-5" />}
          accent="indigo"
        />
        <StatCard
          label="Constraint Rate"
          value="0 violations"
          sub="Capacity & TW satisfied"
          icon={<Activity className="h-5 w-5" />}
          accent="emerald"
        />
        <StatCard
          label="Baselines"
          value="4"
          sub="PSO • GA • ACO • OR-Tools"
          icon={<GitCompare className="h-5 w-5" />}
          accent="amber"
        />
      </section>

      {/* Feature Navigation Cards */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURE_CARDS.map((card) => (
          <Link
            key={card.title}
            href={card.href}
            className={`group rounded-2xl border p-5 transition-all hover:scale-[1.02] ${card.accent}`}
          >
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 border border-slate-800">
              {card.icon}
            </div>
            <h3 className="font-bold text-white text-sm group-hover:text-cyan-300 transition-colors">
              {card.title}
            </h3>
            <p className="mt-1 text-xs text-slate-400 leading-relaxed">{card.desc}</p>
            <span className="mt-3 inline-block text-xs font-semibold text-cyan-400 group-hover:underline">
              {card.cta}
            </span>
          </Link>
        ))}
      </section>

      {/* Two Column Section */}
      <section className="grid gap-6 lg:grid-cols-2">
        {/* Recent Runs */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-white text-base flex items-center gap-2">
              <History className="h-4 w-4 text-cyan-400" />
              Recent Optimization Runs
            </h2>
            <Link href="/history" className="text-xs text-cyan-400 hover:underline">
              View all →
            </Link>
          </div>
          <div className="space-y-3">
            {RECENT_JOBS.map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-950/50 p-3.5 hover:border-slate-700 transition-colors"
              >
                <div>
                  <p className="text-xs font-semibold text-white">{job.name}</p>
                  <p className="text-[11px] text-slate-500 font-mono">{job.id} • {job.when}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge status={job.status} />
                  {job.status === "completed" && (
                    <span className="text-xs font-mono font-bold text-cyan-400">
                      {job.fitness?.toFixed(1)}
                    </span>
                  )}
                  <Link
                    href={`/scenarios/${job.id}/results`}
                    className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs text-slate-300 hover:text-white transition-colors"
                  >
                    Results →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pre-built Graphs */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-white text-base flex items-center gap-2">
              <Map className="h-4 w-4 text-indigo-400" />
              Saved Networks & Topologies
            </h2>
            <Link href="/studio" className="text-xs text-cyan-400 hover:underline">
              Open Studio →
            </Link>
          </div>
          <div className="space-y-3">
            {MOCK_GRAPHS.map((g) => (
              <div
                key={g.id}
                className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-950/50 p-3.5 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`h-2 w-2 rounded-full flex-shrink-0 ${
                      g.has_coordinates ? "bg-emerald-400" : "bg-amber-400"
                    }`}
                  />
                  <div>
                    <p className="text-xs font-semibold text-white">{g.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {g.source_type} • {g.node_count} nodes • {g.edge_count} edges
                    </p>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                    g.has_coordinates
                      ? "border-emerald-800 text-emerald-400 bg-emerald-950/60"
                      : "border-amber-800 text-amber-400 bg-amber-950/60"
                  }`}
                >
                  {g.has_coordinates ? "GIS Coordinates" : "Topological"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
