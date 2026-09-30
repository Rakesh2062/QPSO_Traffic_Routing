"""
qpso_engine/fitness.py

Evaluates a decoded VRP solution (a set of vehicle routes) against:
  - total distance
  - total travel time (time-dependent, congestion-aware)
  - congestion exposure
  - constraint violations (capacity, vehicle count, connectivity)

Returns a single scalar fitness value. Lower is better (QPSO here is framed
as a minimization problem).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import networkx as nx
import numpy as np

from backend.app.engine.graph_model import TrafficSimulator, route_cost
from backend.app.engine.qpso.encoding import VRPProblem, decode

PENALTY_PER_VIOLATION: float = 1_000_000.0


@dataclass
class FitnessWeights:
    """Tunable weights for the multi-objective cost function.
    Must reflect what the scenario config's objective_weights JSONB holds."""
    distance: float = 0.4
    time: float = 0.4
    congestion: float = 0.2
    # Constraint violation penalty multiplier
    penalty_multiplier: float = 1_000_000.0


@dataclass
class Vehicle:
    """Represents a single vehicle in the fleet for fitness evaluation.
    Field names align directly with scenarios DB columns."""
    vehicle_id: int
    vehicle_capacity: float
    depot_node_id: str
    max_route_duration: float = float("inf")


@dataclass
class RouteCostBreakdown:
    """Detailed cost metrics for a single vehicle's route."""
    vehicle_id: int
    stops: list[str]
    distance: float
    time: float
    load: float
    congestion: float = 0.0
    feasible: bool = True


def evaluate_solution(
    routes: list[list[str]],
    vehicles: list[Vehicle],
    G: nx.DiGraph,
    sim: TrafficSimulator,
    weights: FitnessWeights | dict[str, float],
    demands: dict[str, float] | None = None,
    t: float = 0.0,
) -> tuple[float, list[dict[str, Any]], int]:
    """
    Evaluates a decoded set of vehicle routes against the network graph and traffic conditions.

    Returns:
    --------
    fitness                : scalar fitness value (lower is better)
    per_vehicle_breakdown  : list of RouteDTO dicts matching {vehicle_id, stops, distance, time, load}
    n_violations           : total count of capacity/connectivity violations
    """
    if isinstance(weights, dict):
        w_d = weights.get("distance", 0.4)
        w_t = weights.get("time", 0.4)
        w_c = weights.get("congestion", 0.2)
        penalty_mult = weights.get("penalty_multiplier", PENALTY_PER_VIOLATION)
    else:
        w_d = weights.distance
        w_t = weights.time
        w_c = weights.congestion
        penalty_mult = weights.penalty_multiplier

    total_dist = 0.0
    total_time = 0.0
    total_congestion = 0.0
    n_violations = 0
    breakdown: list[dict[str, Any]] = []

    demands_map = demands or {}

    for vid, r in enumerate(routes):
        if vid < len(vehicles):
            veh = vehicles[vid]
            cap = veh.vehicle_capacity
        else:
            cap = 100.0

        # Calculate demand load
        route_load = sum(demands_map.get(node, 0.0) for node in r)
        if route_load > cap:
            n_violations += 1

        if len(r) <= 2:
            # Empty route depot -> depot
            breakdown.append({
                "vehicle_id": vid,
                "stops": r,
                "distance": 0.0,
                "time": 0.0,
                "load": round(route_load, 2),
            })
            continue

        cost = route_cost(G, r, sim, t)
        dist = cost["distance"]
        t_time = cost["time"]
        cong = cost["congestion"]

        if not cost["feasible"]:
            n_violations += 1

        total_dist += dist
        total_time += t_time
        total_congestion += cong

        breakdown.append({
            "vehicle_id": vid,
            "stops": r,
            "distance": round(dist, 2),
            "time": round(t_time, 2),
            "load": round(route_load, 2),
        })

    # Normalization: distance in km, time in minutes, congestion dimensionless
    fitness = (
        w_d * (total_dist / 1000.0)
        + w_t * total_time
        + w_c * total_congestion
        + n_violations * penalty_mult
    )

    return fitness, breakdown, n_violations


def evaluate(
    X: np.ndarray,
    problem: VRPProblem,
    G: nx.DiGraph,
    sim: TrafficSimulator,
    objective_weights: dict[str, float],
    t: float = 0.0,
) -> tuple[float, list[list[str]], int]:
    """
    Evaluate the fitness of a continuous position vector X.
    Compatible with swarm optimization iterations.
    """
    w_d = objective_weights.get("distance", 0.4)
    w_t = objective_weights.get("time", 0.4)
    w_c = objective_weights.get("congestion", 0.2)

    routes, n_violations = decode(X, problem)

    total_distance = 0.0
    total_time = 0.0
    total_congestion = 0.0

    for route in routes:
        if len(route) <= 2:
            continue
        cost = route_cost(G, route, sim, t)
        total_distance += cost["distance"]
        total_time += cost["time"]
        total_congestion += cost["congestion"]
        if not cost["feasible"]:
            n_violations += 1

    fitness = (
        w_d * (total_distance / 1000.0)
        + w_t * total_time
        + w_c * total_congestion
        + n_violations * PENALTY_PER_VIOLATION
    )

    return fitness, routes, n_violations
