"""
2-opt local search for VRP route improvement.

Applied to the decoded routes of the top-k particles every `frequency`
iterations, not on every iteration, to bound the overhead.

2-opt reverses a segment [i+1 … j] within a single vehicle's route and
accepts the reversal if it reduces that vehicle's travel distance.  This is
an intra-route improvement only; inter-route moves are not implemented here
(they require more complex Lin–Kernighan moves).

Usage::

    improved_routes = two_opt_all_routes(routes, G, sim, t, max_iterations=50)
"""

from __future__ import annotations

import networkx as nx
import numpy as np

from backend.app.engine.graph_model import TrafficSimulator, route_cost


def _two_opt_route(
    route: list[str],
    G: nx.DiGraph,
    sim: TrafficSimulator,
    t: float = 0.0,
    max_iterations: int = 100,
) -> list[str]:
    """
    Apply 2-opt to a single route (including depot end-caps).
    Returns a new (possibly improved) route.
    """
    best_route = list(route)
    best_cost = route_cost(G, best_route, sim, t)["distance"]

    improved = True
    iteration = 0
    while improved and iteration < max_iterations:
        improved = False
        iteration += 1
        # Only swap the customer segment (index 1..n-2), not the depot
        n = len(best_route)
        for i in range(1, n - 2):
            for j in range(i + 1, n - 1):
                new_route = (
                    best_route[:i]
                    + list(reversed(best_route[i : j + 1]))
                    + best_route[j + 1 :]
                )
                new_cost = route_cost(G, new_route, sim, t)["distance"]
                if new_cost < best_cost - 1e-9:
                    best_route = new_route
                    best_cost = new_cost
                    improved = True
                    break
            if improved:
                break

    return best_route


def two_opt_route(
    route: list[str],
    G: nx.DiGraph,
    sim: TrafficSimulator | None = None,
    t: float = 0.0,
    max_iterations: int = 100,
) -> list[str]:
    """Public wrapper for 2-opt single route optimization."""
    if sim is None:
        sim = TrafficSimulator(G)
    return _two_opt_route(route, G, sim, t, max_iterations)


def two_opt_all_routes(
    routes: list[list[str]],
    G: nx.DiGraph,
    sim: TrafficSimulator,
    t: float = 0.0,
    max_iterations: int = 50,
) -> list[list[str]]:
    """
    Apply 2-opt independently to each vehicle route.
    Returns the improved set of routes.
    """
    return [
        _two_opt_route(r, G, sim, t, max_iterations)
        if len(r) > 3  # at least depot + 1 customer + depot
        else r
        for r in routes
    ]
