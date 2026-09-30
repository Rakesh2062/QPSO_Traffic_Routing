"""
Classical PSO baseline — thin wrapper around Mealpy's OriginalPSO.

Mealpy 3.x API:
  - Define a Problem subclass or a dict with obj_func and bounds.
  - Instantiate the algorithm with epoch and pop_size.
  - Call model.solve(problem, seed=seed).
  - Best position and fitness are on model.solution.

The objective function bridges between the Mealpy continuous vector and
our QPSO fitness function, so both use identical evaluation logic.
"""

from __future__ import annotations

import logging
import time
from typing import Any, Callable

import networkx as nx
import numpy as np

from backend.app.engine.graph_model import TrafficSimulator
from backend.app.engine.qpso.encoding import VRPProblem
from backend.app.engine.qpso.fitness import evaluate

logger = logging.getLogger(__name__)

ProgressCallback = Callable[[int, float, int, list], None]


def run_classical_pso(
    problem: VRPProblem,
    G: nx.DiGraph,
    sim: TrafficSimulator,
    obj: dict[str, float],
    swarm_size: int = 50,
    T_max: int = 200,
    seed: int = 42,
    progress_fn: ProgressCallback | None = None,
    cancel_fn: Callable[[], bool] | None = None,
) -> dict[str, Any]:
    """
    Run Mealpy's OriginalPSO on the VRP encoded as a continuous problem.

    Returns a result dict compatible with AlgorithmRun fields.
    """
    try:
        from mealpy import PSO, FloatVar
    except ImportError:
        logger.error("mealpy not installed — cannot run classical PSO baseline")
        return _error_result("mealpy not installed")

    start_ms = int(time.time() * 1000)
    n = problem.n_customers
    n_v = problem.n_vehicles
    convergence_history: list[dict] = []
    best_routes: list[list[str]] = []
    best_violations: int = 0

    def obj_func(x: list[float]) -> float:
        nonlocal best_routes, best_violations
        X = np.array(x)
        fitness, routes, violations = evaluate(X, problem, G, sim, obj)
        best_routes = routes
        best_violations = violations
        return fitness

    bounds = FloatVar(lb=[0.0] * n, ub=[float(n_v) - 1e-9] * n)

    problem_dict = {
        "obj_func": obj_func,
        "bounds": bounds,
        "minmax": "min",
        "log_to": None,  # suppress Mealpy console output
    }

    model = PSO.OriginalPSO(epoch=T_max, pop_size=swarm_size)

    try:
        model.solve(problem_dict, seed=seed)
    except Exception as exc:
        logger.exception("Classical PSO failed: %s", exc)
        return _error_result(str(exc))

    # Extract convergence from model history
    if hasattr(model, "history") and hasattr(model.history, "list_global_best_fit"):
        for i, f in enumerate(model.history.list_global_best_fit):
            convergence_history.append(
                {"iteration": i + 1, "best_fitness": float(f), "elapsed_ms": 0}
            )

    elapsed_ms = int(time.time() * 1000) - start_ms
    best_fitness = float(model.solution[1]) if model.solution else float("inf")

    return {
        "algorithm": "classical_pso",
        "final_fitness": best_fitness,
        "routes": best_routes,
        "n_violations": best_violations,
        "wall_clock_ms": elapsed_ms,
        "iterations_run": T_max,
        "convergence_history": convergence_history,
        "status": "completed",
    }


def _error_result(msg: str) -> dict[str, Any]:
    return {
        "algorithm": "classical_pso",
        "final_fitness": None,
        "routes": [],
        "n_violations": 0,
        "wall_clock_ms": 0,
        "iterations_run": 0,
        "convergence_history": [],
        "status": "failed",
        "error": msg,
    }
