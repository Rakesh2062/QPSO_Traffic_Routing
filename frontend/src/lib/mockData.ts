/**
 * Mock datasets and simulated telemetry engine for testing and offline fallback.
 */

import {
  GraphDetail,
  GraphSummary,
  ScenarioResultsResponse,
  Preset,
  BenchmarkEntry,
} from "@/types";

export const MOCK_GRAPHS: GraphDetail[] = [
  {
    id: "g-bengaluru-core",
    name: "Bengaluru City Center (OSM)",
    source_type: "osm",
    node_count: 18,
    edge_count: 42,
    has_coordinates: true,
    created_at: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
    graph_data: {
      nodes: [
        { id: "depot", lat: 12.9716, lon: 77.5946, demand: 0, label: "Central Depot (MG Road)" },
        { id: "n1", lat: 12.9822, lon: 77.5983, demand: 15, label: "Shivajinagar Hub" },
        { id: "n2", lat: 12.9654, lon: 77.6081, demand: 25, label: "Indiranagar 100ft" },
        { id: "n3", lat: 12.9352, lon: 77.6245, demand: 30, label: "Koramangala 4th Block" },
        { id: "n4", lat: 12.9165, lon: 77.6101, demand: 18, label: "BTM Layout Ring Rd" },
        { id: "n5", lat: 12.9279, lon: 77.5852, demand: 22, label: "Jayanagar 4th Block" },
        { id: "n6", lat: 12.9601, lon: 77.5684, demand: 12, label: "Chamarajpet" },
        { id: "n7", lat: 12.9784, lon: 77.5721, demand: 35, label: "Majestic Terminal" },
        { id: "n8", lat: 13.0034, lon: 77.5891, demand: 20, label: "Malleswaram 8th Cross" },
        { id: "n9", lat: 13.0112, lon: 77.6213, demand: 28, label: "Hebbal Flyover Junction" },
        { id: "n10", lat: 12.9915, lon: 77.6401, demand: 16, label: "Kalyan Nagar" },
        { id: "n11", lat: 12.9568, lon: 77.7011, demand: 40, label: "Whitefield ITPL" },
        { id: "n12", lat: 12.9341, lon: 77.6912, demand: 32, label: "Bellandur EcoSpace" },
        { id: "n13", lat: 12.8452, lon: 77.6602, demand: 45, label: "Electronic City Ph 1" },
        { id: "n14", lat: 12.9082, lon: 77.5741, demand: 14, label: "JP Nagar 6th Phase" },
        { id: "n15", lat: 12.9482, lon: 77.5512, demand: 19, label: "Banashankari BDA" },
        { id: "n16", lat: 12.9892, lon: 77.5342, demand: 26, label: "Rajajinagar Industrial" },
        { id: "n17", lat: 13.0312, lon: 77.5612, demand: 15, label: "Yeshwanthpur Rly" },
      ],
      edges: [
        { src: "depot", dst: "n1", distance: 1600, base_time: 4.2, congestion: 1.2 },
        { src: "n1", dst: "depot", distance: 1600, base_time: 4.2, congestion: 1.1 },
        { src: "depot", dst: "n2", distance: 2200, base_time: 5.5, congestion: 1.8 },
        { src: "n2", dst: "n3", distance: 3400, base_time: 8.0, congestion: 2.1 },
        { src: "n3", dst: "n4", distance: 2800, base_time: 6.2, congestion: 1.5 },
        { src: "n4", dst: "n5", distance: 2100, base_time: 4.8, congestion: 1.3 },
        { src: "n5", dst: "depot", distance: 4100, base_time: 9.0, congestion: 1.4 },
        { src: "depot", dst: "n7", distance: 2800, base_time: 7.0, congestion: 2.3 },
        { src: "n7", dst: "n8", distance: 3100, base_time: 6.8, congestion: 1.4 },
        { src: "n8", dst: "n9", distance: 4200, base_time: 8.5, congestion: 1.6 },
        { src: "n9", dst: "n10", distance: 3500, base_time: 7.1, congestion: 1.3 },
        { src: "n10", dst: "n2", distance: 4600, base_time: 9.8, congestion: 1.7 },
        { src: "n2", dst: "n11", distance: 8900, base_time: 18.0, congestion: 2.4 },
        { src: "n11", dst: "n12", distance: 4100, base_time: 9.2, congestion: 2.0 },
        { src: "n12", dst: "n13", distance: 9800, base_time: 21.0, congestion: 2.2 },
        { src: "n13", dst: "n4", distance: 8200, base_time: 16.5, congestion: 1.9 },
        { src: "n5", dst: "n14", distance: 2400, base_time: 5.0, congestion: 1.1 },
        { src: "n14", dst: "n15", distance: 3100, base_time: 6.2, congestion: 1.2 },
        { src: "n15", dst: "n6", distance: 2300, base_time: 4.9, congestion: 1.0 },
        { src: "n6", dst: "depot", distance: 3200, base_time: 7.1, congestion: 1.5 },
        { src: "n7", dst: "n16", distance: 3800, base_time: 8.2, congestion: 1.6 },
        { src: "n16", dst: "n17", distance: 3900, base_time: 7.9, congestion: 1.3 },
        { src: "n17", dst: "n8", distance: 2900, base_time: 5.8, congestion: 1.2 },
        { src: "n1", dst: "n7", distance: 2500, base_time: 5.5, congestion: 1.7 },
        { src: "n3", dst: "n12", distance: 6200, base_time: 14.0, congestion: 2.5 },
      ],
    },
  },
  {
    id: "g-synthetic-grid-25",
    name: "Synthetic 5x5 Manhattan Grid",
    source_type: "synthetic_grid",
    node_count: 25,
    edge_count: 80,
    has_coordinates: true,
    created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
    graph_data: generateGridNodes(5, 5),
  },
];

function generateGridNodes(rows: number, cols: number) {
  const nodes = [];
  const edges = [];
  const baseLat = 12.95;
  const baseLon = 77.58;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const id = r === 0 && c === 0 ? "depot" : `n_${r}_${c}`;
      nodes.push({
        id,
        lat: baseLat + r * 0.015,
        lon: baseLon + c * 0.015,
        demand: id === "depot" ? 0 : Math.floor(10 + ((r * 7 + c * 13) % 35)),
        label: id === "depot" ? "Main Depot" : `Block (${r},${c})`,
      });

      if (c < cols - 1) {
        const nextId = r === 0 && c + 1 === 0 ? "depot" : `n_${r}_${c + 1}`;
        edges.push({ src: id, dst: nextId, distance: 1500, base_time: 3.5, congestion: 1.0 + (r % 2) * 0.4 });
        edges.push({ src: nextId, dst: id, distance: 1500, base_time: 3.5, congestion: 1.0 + (r % 2) * 0.4 });
      }
      if (r < rows - 1) {
        const nextId = r + 1 === 0 && c === 0 ? "depot" : `n_${r + 1}_${c}`;
        edges.push({ src: id, dst: nextId, distance: 1500, base_time: 3.5, congestion: 1.1 + (c % 2) * 0.5 });
        edges.push({ src: nextId, dst: id, distance: 1500, base_time: 3.5, congestion: 1.1 + (c % 2) * 0.5 });
      }
    }
  }

  return { nodes, edges };
}

export const MOCK_PRESETS: Preset[] = [
  {
    name: "fast",
    label: "Fast & Agile (Demo / Quick Run)",
    description: "Swarm size 30, 50 iterations with 2-Opt refinement for rapid feedback (~2-5s).",
    algorithm_params: {
      swarm_size: 30,
      T_max: 50,
      beta_max: 1.4,
      beta_min: 0.5,
      enable_2opt: true,
      opt2_frequency: 5,
    },
  },
  {
    name: "balanced",
    label: "Balanced (Recommended)",
    description: "Swarm size 60, 200 iterations. Strong global exploration + quantum contraction.",
    algorithm_params: {
      swarm_size: 60,
      T_max: 200,
      beta_max: 1.6,
      beta_min: 0.4,
      enable_2opt: true,
      opt2_frequency: 10,
    },
  },
  {
    name: "thorough",
    label: "Thorough (Academic Benchmark)",
    description: "Swarm size 120, 500 iterations. Maximum solution precision and local search depth.",
    algorithm_params: {
      swarm_size: 120,
      T_max: 500,
      beta_max: 1.8,
      beta_min: 0.3,
      enable_2opt: true,
      opt2_frequency: 5,
    },
  },
];

export const MOCK_BENCHMARKS: BenchmarkEntry[] = [
  {
    scenario_id: "sc-001",
    scenario_name: "Bengaluru IT Corridor Rush Hour",
    graph_id: "g-bengaluru-core",
    algorithm: "QPSO (Proposed)",
    final_fitness: 42.8,
    wall_clock_ms: 1840,
    constraint_violations: 0,
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    scenario_id: "sc-001",
    scenario_name: "Bengaluru IT Corridor Rush Hour",
    graph_id: "g-bengaluru-core",
    algorithm: "Classical PSO",
    final_fitness: 54.3,
    wall_clock_ms: 1920,
    constraint_violations: 0,
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    scenario_id: "sc-001",
    scenario_name: "Bengaluru IT Corridor Rush Hour",
    graph_id: "g-bengaluru-core",
    algorithm: "Genetic Algorithm (GA)",
    final_fitness: 48.6,
    wall_clock_ms: 3200,
    constraint_violations: 0,
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    scenario_id: "sc-001",
    scenario_name: "Bengaluru IT Corridor Rush Hour",
    graph_id: "g-bengaluru-core",
    algorithm: "Ant Colony Optimization (ACO)",
    final_fitness: 46.1,
    wall_clock_ms: 4850,
    constraint_violations: 0,
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    scenario_id: "sc-001",
    scenario_name: "Bengaluru IT Corridor Rush Hour",
    graph_id: "g-bengaluru-core",
    algorithm: "OR-Tools Exact",
    final_fitness: 43.5,
    wall_clock_ms: 6100,
    constraint_violations: 0,
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
];
