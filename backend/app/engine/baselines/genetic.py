"""Genetic Algorithm baseline — thin wrapper around Mealpy's BaseGA."""

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


def run_genetic(
    problem: VRPProblem,
    G: nx.DiGraph,
    sim: TrafficSimulator,
    obj: dict[str, float],
    pop_size: int = 50,
    T_max: int = 200,
    seed: int = 42,
    cancel_fn: Callable[[], bool] | None = None,
) -> dict[str, Any]:
    """Run Mealpy's BaseGA and return a result dict."""
    try:
        from mealpy import GA, FloatVar
    except ImportError:
        return _error_result("mealpy not installed")

    start_ms = int(time.time() * 1000)
    n = problem.n_customers
    n_v = problem.n_vehicles
    best_routes: list[list[str]] = []
    best_violations: int = 0
    convergence_history: list[dict] = []

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
        "log_to": None,
    }

    model = GA.BaseGA(epoch=T_max, pop_size=pop_size)
    try:
        model.solve(problem_dict, seed=seed)
    except Exception as exc:
        logger.exception("GA failed: %s", exc)
        return _error_result(str(exc))

    if hasattr(model, "history") and hasattr(model.history, "list_global_best_fit"):
        for i, f in enumerate(model.history.list_global_best_fit):
            convergence_history.append(
                {"iteration": i + 1, "best_fitness": float(f), "elapsed_ms": 0}
            )

    elapsed_ms = int(time.time() * 1000) - start_ms
    best_fitness = float(model.solution[1]) if model.solution else float("inf")

    return {
        "algorithm": "ga",
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
        "algorithm": "ga",
        "final_fitness": None,
        "routes": [],
        "n_violations": 0,
        "wall_clock_ms": 0,
        "iterations_run": 0,
        "convergence_history": [],
        "status": "failed",
        "error": msg,
    }


run_genetic_algorithm = run_genetic
