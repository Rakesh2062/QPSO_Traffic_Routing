"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { AlgorithmResult } from "@/types";

interface MetricBarChartProps {
  algorithms: Record<string, AlgorithmResult>;
}

export function MetricBarChart({ algorithms }: MetricBarChartProps) {
  const data = Object.entries(algorithms)
    .filter(([, r]) => r.status === "completed")
    .map(([name, r]) => ({
      name: name.replace("(Proposed)", "").trim(),
      "Distance (km)": r.total_distance ? +(r.total_distance / 1000).toFixed(1) : 0,
      "Time (min)": r.total_time ? +r.total_time.toFixed(1) : 0,
      "Congestion": r.congestion_penalty ? +r.congestion_penalty.toFixed(2) : 0,
      "Runtime (s)": r.wall_clock_ms ? +(r.wall_clock_ms / 1000).toFixed(2) : 0,
    }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "#1e293b" }} />
        <YAxis tick={{ fill: "#64748b", fontSize: 10 }} tickLine={false} axisLine={{ stroke: "#1e293b" }} />
        <Tooltip
          contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: "8px", fontSize: "11px" }}
          labelStyle={{ color: "#94a3b8" }}
          itemStyle={{ color: "#e2e8f0" }}
        />
        <Legend wrapperStyle={{ fontSize: "11px", color: "#94a3b8", paddingTop: "8px" }} iconSize={8} />
        <Bar dataKey="Distance (km)" fill="#06b6d4" radius={[3, 3, 0, 0]} />
        <Bar dataKey="Time (min)" fill="#6366f1" radius={[3, 3, 0, 0]} />
        <Bar dataKey="Congestion" fill="#f59e0b" radius={[3, 3, 0, 0]} />
        <Bar dataKey="Runtime (s)" fill="#10b981" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
