"""
OR-Tools baseline — exact / constraint-programming solver for small-scale VRP.

Enforces a strict node-count safety cap (ortools_max_nodes) because exact
routing algorithms experience factorial complexity scaling on larger networks.
"""

from __future__ import annotations

import logging
import time
from typing import Any, Callable

import networkx as nx

from backend.app.core.config import settings
from backend.app.engine.graph_model import TrafficSimulator
from backend.app.engine.qpso.encoding import VRPProblem

logger = logging.getLogger(__name__)


def run_ortools(
    problem: VRPProblem,
    G: nx.DiGraph,
    sim: TrafficSimulator,
    obj: dict[str, float],
    max_nodes_cap: int | None = None,
    time_limit_seconds: int = 30,
) -> dict[str, Any]:
    """
    Solve VRP using Google OR-Tools constraint solver.
    """
    start_ms = int(time.time() * 1000)
    cap = max_nodes_cap or settings.ortools_max_nodes

    total_nodes = problem.n_customers + 1
    if total_nodes > cap:
        msg = (
            f"OR-Tools solver disabled for graphs with > {cap} nodes "
            f"(current graph has {total_nodes} nodes). "
            f"Exact routing has exponential scaling; please select metaheuristics (QPSO/PSO/GA/ACO)."
        )
        logger.warning(msg)
        return _error_result(msg)

    try:
        from ortools.constraint_solver import pywrapcp, routing_enums_pb2
    except ImportError:
        logger.error("ortools not installed — cannot run OR-Tools baseline")
        return _error_result("Google OR-Tools is not installed on this environment")

    # Map nodes: 0 is depot, 1..n are customers
    node_list = [problem.depot_id] + problem.customer_ids
    n_nodes = len(node_list)
    node_to_idx = {node: i for i, node in enumerate(node_list)}

    # Build cost matrix between all pairs of nodes
    dist_matrix = [[0.0] * n_nodes for _ in range(n_nodes)]
    for i, u in enumerate(node_list):
        for j, v in enumerate(node_list):
            if i == j:
                dist_matrix[i][j] = 0.0
            else:
                try:
                    # Shortest path weight
                    d = nx.shortest_path_length(G, source=u, target=v, weight="length")
                except (nx.NetworkXNoPath, nx.NodeNotFound):
                    d = 1e6
                dist_matrix[i][j] = d

    # Convert demands (0 for depot)
    demands = [0.0] + [problem.demands.get(cid, 1.0) for cid in problem.customer_ids]
    # Scale to integers for OR-Tools
    scale = 1000
    int_dist_matrix = [[int(dist_matrix[i][j] * scale) for j in range(n_nodes)] for i in range(n_nodes)]
    int_demands = [int(d * scale) for d in demands]
    int_capacity = int(problem.vehicle_capacity * scale)

    # Routing manager & model
    manager = pywrapcp.RoutingIndexManager(
        n_nodes,
        problem.n_vehicles,
        0,  # single depot at index 0
    )
    routing = pywrapcp.RoutingModel(manager)

    # Transit callback
    def distance_callback(from_index: int, to_index: int) -> int:
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return int_dist_matrix[from_node][to_node]

    transit_callback_index = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

    # Capacity constraints
    def demand_callback(from_index: int) -> int:
        from_node = manager.IndexToNode(from_index)
        return int_demands[from_node]

    demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)
    routing.AddDimensionWithVehicleCapacity(
        demand_callback_index,
        0,  # null capacity slack
        [int_capacity] * problem.n_vehicles,
        True,  # start cumul to zero
        "Capacity",
    )

    # Search parameters
    search_parameters = pywrapcp.DefaultRoutingSearchParameters()
    search_parameters.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )
    search_parameters.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    )
    search_parameters.time_limit.seconds = time_limit_seconds

    # Solve
    solution = routing.SolveWithParameters(search_parameters)

    elapsed_ms = int(time.time() * 1000) - start_ms

    if not solution:
        return _error_result("OR-Tools found no feasible solution within time limit")

    # Extract routes
    routes: list[list[str]] = []
    total_dist = 0.0
    total_time = 0.0
    total_congestion = 0.0

    w_dist = obj.get("distance", 0.5)
    w_time = obj.get("time", 0.3)
    w_cong = obj.get("congestion", 0.2)

    for vehicle_id in range(problem.n_vehicles):
        index = routing.Start(vehicle_id)
        route_nodes = []
        while not routing.IsEnd(index):
            node_idx = manager.IndexToNode(index)
            route_nodes.append(node_list[node_idx])
            previous_index = index
            index = solution.Value(routing.NextVar(index))
            next_node_idx = manager.IndexToNode(index)
            d_seg = dist_matrix[node_idx][next_node_idx]
            total_dist += d_seg
            total_time += d_seg / 40.0  # Approx speed
        route_nodes.append(problem.depot_id)
        if len(route_nodes) > 2:  # Has customers
            routes.append(route_nodes)

    fitness = (w_dist * total_dist) + (w_time * total_time) + (w_cong * total_congestion)

    return {
        "algorithm": "ortools",
        "final_fitness": fitness,
        "routes": routes,
        "n_violations": 0,
        "wall_clock_ms": elapsed_ms,
        "iterations_run": 1,
        "converged_at_iter": 1,
        "status": "completed",
        "total_distance": total_dist,
        "total_time": total_time,
        "congestion_penalty": total_congestion,
        "error_message": None,
        "convergence_history": [{"iteration": 1, "best_fitness": fitness, "elapsed_ms": elapsed_ms}],
    }


def _error_result(message: str) -> dict[str, Any]:
    return {
        "algorithm": "ortools",
        "final_fitness": None,
        "routes": [],
        "n_violations": 0,
        "wall_clock_ms": 0,
        "iterations_run": 0,
        "converged_at_iter": None,
        "status": "failed",
        "total_distance": None,
        "total_time": None,
        "congestion_penalty": None,
        "error_message": message,
        "convergence_history": [],
    }
