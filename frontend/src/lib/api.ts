/**
 * REST API client with automatic fallback for mock/demo mode.
 */

import {
  GraphDetail,
  GraphGenerateRequest,
  GraphSummary,
  ScenarioCreateRequest,
  ScenarioCreateResponse,
  ScenarioResultsResponse,
  ScenarioStatusResponse,
  BenchmarkEntry,
} from "@/types";
import { MOCK_GRAPHS, MOCK_BENCHMARKS } from "./mockData";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });

  if (!res.ok) {
    const errorBody = await res.text();
    throw new Error(`API error ${res.status}: ${errorBody || res.statusText}`);
  }

  return res.json();
}

export const api = {
  // ── Graphs ───────────────────────────────────────────────────────────────
  async getGraphs(): Promise<GraphSummary[]> {
    try {
      return await request<GraphSummary[]>("/api/graphs");
    } catch {
      console.warn("Backend unavailable, using mock graphs.");
      return MOCK_GRAPHS.map(({ graph_data, metadata, ...summary }) => summary);
    }
  },

  async getGraphById(id: string): Promise<GraphDetail> {
    try {
      return await request<GraphDetail>(`/api/graphs/${id}`);
    } catch {
      console.warn(`Backend unavailable, returning mock graph for id: ${id}`);
      const found = MOCK_GRAPHS.find((g) => g.id === id);
      return found || MOCK_GRAPHS[0];
    }
  },

  async generateGraph(data: GraphGenerateRequest): Promise<GraphDetail> {
    try {
      return await request<GraphDetail>("/api/graphs/generate", {
        method: "POST",
        body: JSON.stringify(data),
      });
    } catch {
      console.warn("Backend unavailable, generating mock synthetic graph.");
      const newGraph: GraphDetail = {
        id: `mock-synth-${Date.now()}`,
        name: data.name,
        source_type: `synthetic_${data.topology}`,
        node_count: data.node_count,
        edge_count: Math.floor(data.node_count * 2.8),
        has_coordinates: true,
        created_at: new Date().toISOString(),
        graph_data: {
          nodes: Array.from({ length: data.node_count }, (_, i) => ({
            id: i === 0 ? "depot" : `n${i}`,
            lat: 12.95 + (i % 6) * 0.015,
            lon: 77.58 + Math.floor(i / 6) * 0.015,
            demand: i === 0 ? 0 : 10 + (i % 30),
            label: i === 0 ? "Depot" : `Customer Node ${i}`,
          })),
          edges: Array.from({ length: Math.floor(data.node_count * 2.8) }, (_, i) => {
            const src = i === 0 ? "depot" : `n${i % data.node_count}`;
            const dst = `n${(i + 1) % data.node_count}`;
            return {
              src,
              dst,
              distance: 1200 + (i * 130) % 2500,
              base_time: 3.5 + (i * 0.4) % 6,
              congestion: 1.0 + (i * 0.15) % 1.2,
            };
          }),
        },
      };
      MOCK_GRAPHS.unshift(newGraph);
      return newGraph;
    }
  },

  // ── Scenarios ────────────────────────────────────────────────────────────
  async createScenario(payload: ScenarioCreateRequest): Promise<ScenarioCreateResponse> {
    try {
      return await request<ScenarioCreateResponse>("/api/scenarios", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    } catch {
      console.warn("Backend unavailable, returning mock job ID.");
      const mockJobId = `job-mock-${Date.now()}`;
      return { job_id: mockJobId };
    }
  },

  async getScenarioStatus(id: string): Promise<ScenarioStatusResponse> {
    try {
      return await request<ScenarioStatusResponse>(`/api/scenarios/${id}`);
    } catch {
      return {
        id,
        status: "running",
        created_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
        completed_at: null,
        error_message: null,
        graph_id: "g-bengaluru-core",
        name: "Mock Live Scenario",
      };
    }
  },

  async getScenarioResults(id: string): Promise<ScenarioResultsResponse> {
    try {
      return await request<ScenarioResultsResponse>(`/api/scenarios/${id}/results`);
    } catch {
      console.warn("Backend unavailable, generating mock scenario results.");
      return generateMockResults(id);
    }
  },

  async cancelScenario(id: string): Promise<{ success: boolean }> {
    try {
      return await request<{ success: boolean }>(`/api/scenarios/${id}/cancel`, {
        method: "POST",
      });
    } catch {
      return { success: true };
    }
  },

  // ── Benchmarks ───────────────────────────────────────────────────────────
  async getBenchmarks(): Promise<BenchmarkEntry[]> {
    try {
      return await request<BenchmarkEntry[]>("/api/benchmark");
    } catch {
      return MOCK_BENCHMARKS;
    }
  },
};

function generateMockResults(scenarioId: string): ScenarioResultsResponse {
  const algorithms = ["QPSO (Proposed)", "Classical PSO", "GA", "ACO", "OR-Tools"];
  const resultsRecord: ScenarioResultsResponse["algorithms"] = {};
  const historyRecord: ScenarioResultsResponse["convergence_history"] = {};

  algorithms.forEach((algo, idx) => {
    const baseFit = 38 + idx * 4.5;
    resultsRecord[algo] = {
      algorithm: algo,
      final_fitness: baseFit + 0.4,
      total_distance: 34200 + idx * 3100,
      total_time: 74.2 + idx * 8.5,
      congestion_penalty: 4.8 + idx * 2.1,
      constraint_violations: 0,
      wall_clock_ms: 1200 + idx * 950,
      iterations_run: 200,
      converged_at_iter: 72 + idx * 18,
      status: "completed",
      routes: [
        {
          vehicle_id: 1,
          stops: ["depot", "n1", "n2", "n3", "n4", "depot"],
          distance: 12400,
          time: 26.5,
          load: 92,
        },
        {
          vehicle_id: 2,
          stops: ["depot", "n7", "n8", "n9", "n10", "depot"],
          distance: 11100,
          time: 24.1,
          load: 85,
        },
        {
          vehicle_id: 3,
          stops: ["depot", "n5", "n14", "n15", "n6", "depot"],
          distance: 10700,
          time: 23.6,
          load: 78,
        },
      ],
    };

    const history = [];
    let curFitness = 140 + idx * 20;
    for (let it = 1; it <= 200; it += 2) {
      const decay = Math.exp(-it / (30 + idx * 10));
      curFitness = baseFit + (140 - baseFit) * decay + (Math.random() - 0.5) * 1.5;
      history.push({
        iteration: it,
        best_fitness: Math.max(baseFit, curFitness),
        elapsed_ms: it * (8 + idx * 4),
      });
    }
    historyRecord[algo] = history;
  });

  return {
    scenario_id: scenarioId,
    algorithms: resultsRecord,
    convergence_history: historyRecord,
  };
}
