/**
 * Type definitions matching backend FastAPI & Pydantic schemas.
 */

export interface ObjectiveWeights {
  distance: number;
  time: number;
  congestion: number;
}

export interface AlgorithmParams {
  swarm_size: number;
  T_max: number;
  beta_max: number;
  beta_min: number;
  enable_2opt: boolean;
  opt2_frequency?: number;
  "2opt_frequency"?: number;
}

export type TopologyType = "grid" | "erdos_renyi" | "barabasi_albert";

export interface GraphGenerateRequest {
  name: string;
  topology: TopologyType;
  node_count: number;
  edge_probability?: number;
  seed?: number;
}

export interface GraphNode {
  id: string;
  lat?: number;
  lon?: number;
  x?: number;
  y?: number;
  demand?: number;
  [key: string]: unknown;
}

export interface GraphEdge {
  src: string;
  dst: string;
  distance?: number;
  weight?: number;
  base_time?: number;
  congestion?: number;
  [key: string]: unknown;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphSummary {
  id: string;
  name: string;
  source_type: string;
  node_count: number | null;
  edge_count: number | null;
  has_coordinates: boolean;
  created_at: string;
}

export interface GraphDetail extends GraphSummary {
  graph_data: GraphData;
  metadata?: Record<string, unknown>;
}

export type BaselineAlgorithm = "classical_pso" | "ga" | "aco" | "ortools";

export interface ScenarioCreateRequest {
  graph_id: string;
  name?: string;
  num_vehicles: number;
  vehicle_capacity: number;
  depot_node_id: string;
  objective_weights: ObjectiveWeights;
  algorithm_params: AlgorithmParams;
  baselines_selected: string[];
  seed?: number;
}

export interface ScenarioCreateResponse {
  job_id: string;
}

export type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface ScenarioStatusResponse {
  id: string;
  status: JobStatus;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  graph_id: string;
  name: string | null;
}

export interface RouteDTO {
  vehicle_id: number;
  stops: string[];
  distance: number;
  time: number;
  load: number;
}

export type VehicleRouteStop = RouteDTO;

export interface AlgorithmResult {
  algorithm: string;
  final_fitness: number | null;
  total_distance: number | null;
  total_time: number | null;
  congestion_penalty: number | null;
  constraint_violations: number;
  wall_clock_ms: number | null;
  iterations_run: number | null;
  converged_at_iter: number | null;
  routes: VehicleRouteStop[] | null;
  status: JobStatus;
}

export interface ConvergencePoint {
  iteration: number;
  best_fitness: number;
  elapsed_ms?: number;
}

export interface ScenarioResultsResponse {
  scenario_id: string;
  algorithms: Record<string, AlgorithmResult>;
  convergence_history: Record<string, ConvergencePoint[]>;
}

export interface WebSocketProgressMessage {
  job_id: string;
  algorithm: string;
  iteration: number;
  best_fitness: number;
  elapsed_ms: number;
  current_best_route?: VehicleRouteStop[];
  done?: boolean;
}

export interface BenchmarkEntry {
  scenario_id: string;
  scenario_name: string | null;
  graph_id: string;
  algorithm: string;
  final_fitness: number | null;
  wall_clock_ms: number | null;
  constraint_violations: number;
  created_at: string;
}

export interface Preset {
  name: string;
  label: string;
  description: string;
  algorithm_params: AlgorithmParams;
}
