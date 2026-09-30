"""
Random-key encoding/decoding for VRP routes.

The QPSO math operates on continuous real vectors.  This module converts
between that continuous representation and the discrete route structure that
the fitness function evaluates.

Encoding scheme (Sun et al., adapted for VRP):
  - Position vector X has dimension n_customers (one value per customer node).
  - Sort customers by their X values to obtain a visit ordering.
  - Greedily assign sorted customers to vehicles: add the next customer to
    the current vehicle if it won't exceed capacity; otherwise open a new
    vehicle.
  - This guarantees every feasible-capacity solution is reachable and the
    mapping is deterministic given the sorted order.

Constraint violations:
  - If more vehicles than n_vehicles are needed, record the overflow as
    a constraint violation (penalised in the fitness function).
  - If a customer cannot be added to any vehicle (demand > capacity), it
    is still assigned (to the last vehicle) and the violation count
    increments — the penalty will dominate fitness and drive the swarm away.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import numpy as np


@dataclass
class VRPProblem:
    """
    Immutable description of the VRP instance.

    Attributes
    ----------
    customers        : list of node IDs (depot excluded)
    depot_node_id    : depot node ID
    demands          : mapping from node ID to demand quantity
    vehicle_capacity : vehicle capacity (same for all vehicles)
    n_vehicles       : max number of vehicles
    """

    customers: list[str]
    depot_node_id: str
    demands: dict[str, float]
    vehicle_capacity: float
    n_vehicles: int

    def __init__(
        self,
        customers: list[str],
        demands: dict[str, float],
        n_vehicles: int | None = None,
        depot_node_id: str | None = None,
        vehicle_capacity: float | None = None,
        depot: str | None = None,
        capacity: float | None = None,
        num_vehicles: int | None = None,
    ):
        self.customers = customers
        self.demands = demands
        self.depot_node_id = depot_node_id if depot_node_id is not None else (depot if depot is not None else "depot")
        self.vehicle_capacity = vehicle_capacity if vehicle_capacity is not None else (capacity if capacity is not None else 100.0)
        self.n_vehicles = n_vehicles if n_vehicles is not None else (num_vehicles if num_vehicles is not None else 1)

    @property
    def depot(self) -> str:
        return self.depot_node_id

    @property
    def capacity(self) -> float:
        return self.vehicle_capacity

    @property
    def num_vehicles(self) -> int:
        return self.n_vehicles

    @property
    def n_customers(self) -> int:
        return len(self.customers)

    @property
    def depot_id(self) -> str:
        return self.depot_node_id

    @property
    def customer_ids(self) -> list[str]:
        return self.customers

    @classmethod
    def from_graph_and_config(
        cls,
        graph_data: dict[str, Any],
        depot_node_id: str,
        num_vehicles: int,
        vehicle_capacity: float,
    ) -> "VRPProblem":
        all_nodes = [str(n["id"]) for n in graph_data["nodes"]]
        customers = [n for n in all_nodes if n != depot_node_id]
        demands = {
            str(n["id"]): float(n.get("demand", 0.0))
            for n in graph_data["nodes"]
        }
        return cls(
            customers=customers,
            depot_node_id=depot_node_id,
            demands=demands,
            vehicle_capacity=vehicle_capacity,
            n_vehicles=num_vehicles,
        )


# ── Encode: routes → continuous position vector ───────────────────────────────

def encode(routes: list[list[str]], problem: VRPProblem) -> np.ndarray:
    """
    Produce a continuous position vector X ∈ [0, n_vehicles) where
    X[i] encodes both the vehicle assignment and the relative visit order
    of customer i within that vehicle.

    Formula:
        X[customer_i] = vehicle_idx + rank_within_vehicle / (n_customers + 1)

    This ensures X values from the same vehicle are in the same [k, k+1)
    interval and ordering within the interval matches visit order.
    """
    n = problem.n_customers
    X = np.zeros(n)

    for v_idx, route in enumerate(routes):
        stops = [s for s in route if s != problem.depot]
        for rank, customer in enumerate(stops):
            if customer in problem.customers:
                c_idx = problem.customers.index(customer)
                X[c_idx] = v_idx + (rank + 1) / (len(stops) + 1)

    return X


# ── Decode: continuous position vector → routes ───────────────────────────────

def decode(
    X: np.ndarray,
    problem: VRPProblem,
) -> tuple[list[list[str]], int]:
    """
    Convert a continuous position vector X to a list of routes and a
    constraint violation count.

    Returns
    -------
    routes            : list of routes, each a list of node IDs (depot-to-depot)
    n_violations      : number of capacity/vehicle-count violations
    """
    # Sort customers by their X value to get the visit ordering
    order = np.argsort(X)                         # ascending sort
    sorted_customers = [problem.customers[i] for i in order]

    routes: list[list[str]] = []
    current_route: list[str] = [problem.depot]
    current_load: float = 0.0
    n_violations: int = 0

    for customer in sorted_customers:
        demand = problem.demands.get(customer, 0.0)

        if current_load + demand > problem.capacity:
            # Close current vehicle
            current_route.append(problem.depot)
            routes.append(current_route)
            # Open new vehicle
            current_route = [problem.depot]
            current_load = 0.0

            if len(routes) >= problem.n_vehicles:
                # Exceeded vehicle count — still assign, record violation
                n_violations += 1

        current_route.append(customer)
        current_load += demand

        if demand > problem.capacity:
            # Single customer demand exceeds capacity — unresolvable violation
            n_violations += 1

    # Close last route
    current_route.append(problem.depot)
    routes.append(current_route)

    # Pad with empty routes if fewer vehicles used than allocated
    while len(routes) < problem.n_vehicles:
        routes.append([problem.depot, problem.depot])

    return routes, n_violations
