"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { ConvergencePoint } from "@/types";

interface ConvergenceChartProps {
  /** key = algorithm name, value = convergence history */
  data: Record<string, ConvergencePoint[]>;
  height?: number;
  /** Optionally highlight the last N data points as "live" */
  isLive?: boolean;
}

const PALETTE = [
  "#06b6d4", // cyan   -  QPSO
  "#6366f1", // indigo  -  PSO
  "#10b981", // emerald  -  GA
  "#f59e0b", // amber  -  ACO
  "#f43f5e", // rose  -  OR-Tools
];

function buildCombinedData(data: Record<string, ConvergencePoint[]>) {
  const algos = Object.keys(data);
  if (algos.length === 0) return [];

  const maxLen = Math.max(...algos.map((a) => data[a].length));
  const combined: Record<string, number | string>[] = [];

  for (let i = 0; i < maxLen; i++) {
    const row: Record<string, number | string> = {};
    for (const algo of algos) {
      const pt = data[algo][i];
      if (pt) {
        row.iteration = pt.iteration;
        row[algo] = Number(pt.best_fitness.toFixed(3));
      }
    }
    combined.push(row);
  }
  return combined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/95 px-4 py-3 text-xs shadow-xl backdrop-blur-sm">
      <p className="mb-2 font-semibold text-slate-300">Iteration {label}</p>
      {payload.map((p: { name: string; value: number; color: string }) => (
        <div key={p.name} className="flex items-center justify-between gap-6 mb-1">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
            <span className="text-slate-400">{p.name}</span>
          </div>
          <span className="font-mono font-bold" style={{ color: p.color }}>
            {p.value.toFixed(3)}
          </span>
        </div>
      ))}
    </div>
  );
};

export function ConvergenceChart({ data, height = 320, isLive = false }: ConvergenceChartProps) {
  const algos = Object.keys(data);
  const combined = buildCombinedData(data);

  if (combined.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 text-slate-500 text-sm"
        style={{ height }}
      >
        No convergence data yet
      </div>
    );
  }

  return (
    <div className="relative">
      {isLive && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1.5 rounded-full bg-slate-900/80 border border-cyan-800/60 px-2.5 py-1 text-[10px] font-semibold text-cyan-400 backdrop-blur-sm">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
          </span>
          LIVE
        </div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={combined}
          margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis
            dataKey="iteration"
            tick={{ fill: "#64748b", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "#1e293b" }}
            label={{ value: "Iteration", position: "insideBottom", offset: -2, fill: "#64748b", fontSize: 11 }}
          />
          <YAxis
            tick={{ fill: "#64748b", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "#1e293b" }}
            label={{ value: "Best Fitness", angle: -90, position: "insideLeft", fill: "#64748b", fontSize: 11 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: "11px", color: "#94a3b8", paddingTop: "8px" }}
            iconType="circle"
            iconSize={8}
          />
          {algos.map((algo, idx) => (
            <Line
              key={algo}
              type="monotone"
              dataKey={algo}
              stroke={PALETTE[idx % PALETTE.length]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
              isAnimationActive={isLive}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
