"""
Tests for baseline algorithms and benchmarking metrics.
"""

import pytest

from backend.app.benchmarking.metrics import (
    aggregate_seed_runs,
    calculate_convergence_speed,
    compute_relative_improvement,
)
from backend.app.engine.baselines.exact_ortools import run_ortools
from backend.app.engine.graph_model import generate_synthetic_graph, TrafficSimulator
from backend.app.engine.qpso.encoding import VRPProblem


@pytest.fixture
def baseline_setup():
    G = generate_synthetic_graph("grid", n_nodes=9, seed=42)
    sim = TrafficSimulator(G, base_seed=42)
    customers = [f"n{i}" for i in range(1, 9)]
    demands = {c: 1.0 for c in customers}
    problem = VRPProblem(
        depot="n0",
        customers=customers,
        demands=demands,
        capacity=10.0,
        n_vehicles=2,
    )
    obj = {"distance": 0.5, "time": 0.3, "congestion": 0.2}
    return G, sim, problem, obj


def test_ortools_node_limit_cap(baseline_setup):
    G, sim, problem, obj = baseline_setup
    # Setting cap lower than node count triggers defensive error message
    res = run_ortools(problem, G, sim, obj, max_nodes_cap=4)
    assert res["status"] == "failed"
    assert "OR-Tools solver disabled" in res["error_message"]


def test_calculate_convergence_speed():
    history = [
        {"iteration": 1, "best_fitness": 100.0},
        {"iteration": 2, "best_fitness": 80.0},
        {"iteration": 3, "best_fitness": 55.0},
        {"iteration": 4, "best_fitness": 50.5},
        {"iteration": 5, "best_fitness": 50.0},
    ]
    # Within 1% of 50.0 is <= 50.5 -> iteration 4
    speed = calculate_convergence_speed(history, final_fitness=50.0, threshold_percent=1.0)
    assert speed == 4


def test_aggregate_seed_runs():
    runs = [
        {"status": "completed", "final_fitness": 10.0, "wall_clock_ms": 100, "n_violations": 0},
        {"status": "completed", "final_fitness": 12.0, "wall_clock_ms": 110, "n_violations": 0},
        {"status": "completed", "final_fitness": 8.0, "wall_clock_ms": 90, "n_violations": 0},
    ]
    stats = aggregate_seed_runs(runs)
    assert stats["n_runs"] == 3
    assert stats["success_rate"] == 1.0
    assert stats["fitness"]["mean"] == 10.0
    assert stats["fitness"]["min"] == 8.0
    assert stats["fitness"]["max"] == 12.0


def test_compute_relative_improvement():
    # Baseline = 100, QPSO = 80 -> 20% improvement
    imp = compute_relative_improvement(baseline_fitness=100.0, qpso_fitness=80.0)
    assert imp == 20.0
