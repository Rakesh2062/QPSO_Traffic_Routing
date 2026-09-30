"""
Benchmarking metrics and comparative evaluation module.

Computes:
  - Solution quality (fitness, distance, travel time, congestion)
  - Convergence speed: iterations to reach within X% of the final best fitness
  - Multi-seed statistical aggregation (mean ± std dev, min, max)
  - Scalability statistics across variable problem sizes
"""

from __future__ import annotations

import math
from typing import Any


def calculate_convergence_speed(
    history: list[dict[str, Any]],
    final_fitness: float,
    threshold_percent: float = 1.0,
) -> int | None:
    """
    Find the earliest iteration where fitness was within threshold_percent of final_fitness.
    e.g., threshold_percent=1.0 means fitness <= final_fitness * 1.01 (for minimization).
    """
    if not history or final_fitness is None or math.isinf(final_fitness):
        return None

    target = final_fitness * (1.0 + threshold_percent / 100.0)
    for point in history:
        f = point.get("best_fitness")
        if f is not None and f <= target:
            return point.get("iteration")
    return history[-1].get("iteration") if history else None


def aggregate_seed_runs(runs: list[dict[str, Any]]) -> dict[str, Any]:
    """
    Given a list of algorithm run results from multiple random seeds, compute
    systematic statistical aggregations: mean, std dev, min, max, success rate.
    """
    valid_runs = [r for r in runs if r.get("status") == "completed" and r.get("final_fitness") is not None]
    n_total = len(runs)
    n_valid = len(valid_runs)

    if n_valid == 0:
        return {
            "n_runs": n_total,
            "success_rate": 0.0,
            "fitness": None,
            "wall_clock_ms": None,
            "violations": None,
        }

    fitnesses = [r["final_fitness"] for r in valid_runs]
    times = [r["wall_clock_ms"] for r in valid_runs if r.get("wall_clock_ms") is not None]
    violations = [r.get("n_violations", 0) for r in valid_runs]

    def _stats(arr: list[float | int]) -> dict[str, float]:
        if not arr:
            return {"mean": 0.0, "std": 0.0, "min": 0.0, "max": 0.0}
        n = len(arr)
        mean_val = sum(arr) / n
        variance = sum((x - mean_val) ** 2 for x in arr) / n if n > 1 else 0.0
        return {
            "mean": round(mean_val, 4),
            "std": round(math.sqrt(variance), 4),
            "min": round(min(arr), 4),
            "max": round(max(arr), 4),
        }

    return {
        "n_runs": n_total,
        "n_successful": n_valid,
        "success_rate": round(n_valid / n_total, 4) if n_total > 0 else 0.0,
        "fitness": _stats(fitnesses),
        "wall_clock_ms": _stats(times),
        "violations": _stats(violations),
    }


def compute_relative_improvement(
    baseline_fitness: float,
    qpso_fitness: float,
) -> float:
    """
    Percentage improvement of QPSO over baseline.
    Positive value means QPSO achieved a lower (better) fitness.
    """
    if baseline_fitness is None or qpso_fitness is None or baseline_fitness <= 0:
        return 0.0
    diff = baseline_fitness - qpso_fitness
    return round((diff / baseline_fitness) * 100.0, 2)
