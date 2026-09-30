"""
Tests for QPSO optimization engine, encoding, fitness evaluation, and determinism.
"""

import numpy as np
import pytest

from backend.app.engine.graph_model import generate_synthetic_graph, TrafficSimulator
from backend.app.engine.qpso.encoding import decode, VRPProblem
from backend.app.engine.qpso.fitness import evaluate
from backend.app.engine.qpso.local_search import two_opt_route
from backend.app.engine.qpso.swarm import Swarm, SwarmConfig


@pytest.fixture
def test_setup():
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


def test_random_key_decoding(test_setup):
    G, sim, problem, obj = test_setup
    n = problem.n_customers

    # Random position vector
    np.random.seed(42)
    pos = np.random.uniform(0.0, 1.99, size=n)
    routes, violations = decode(pos, problem)

    assert len(routes) <= problem.n_vehicles
    all_served = [stop for r in routes for stop in r if stop != problem.depot]
    assert sorted(all_served) == sorted(problem.customers)


def test_fitness_evaluation(test_setup):
    G, sim, problem, obj = test_setup
    n = problem.n_customers
    pos = np.ones(n) * 0.5  # All customers to vehicle 0

    fit, routes, violations = evaluate(pos, problem, G, sim, obj)
    assert fit > 0.0
    assert isinstance(violations, int)
    assert len(routes) > 0


def test_two_opt_local_search(test_setup):
    G, sim, problem, obj = test_setup
    route = ["n0", "n1", "n3", "n2", "n0"]
    improved = two_opt_route(route, G)
    assert improved[0] == "n0"
    assert improved[-1] == "n0"
    assert len(improved) == len(route)


def test_qpso_deterministic_seed(test_setup):
    """Regression test: Same fixed seed must produce identical fitness trajectory."""
    G, sim, problem, obj = test_setup
    config = SwarmConfig(
        swarm_size=20,
        T_max=30,
        beta_max=1.2,
        beta_min=0.5,
        enable_2opt=True,
        opt2_frequency=5,
        seed=100,
    )

    sim1 = TrafficSimulator(G, base_seed=42)
    swarm1 = Swarm(config=config, problem=problem, G=G, sim=sim1, obj=obj)
    res1 = swarm1.run()

    sim2 = TrafficSimulator(G, base_seed=42)
    swarm2 = Swarm(config=config, problem=problem, G=G, sim=sim2, obj=obj)
    res2 = swarm2.run()

    assert res1.final_fitness == pytest.approx(res2.final_fitness, rel=1e-6)
    assert len(res1.convergence_history) == len(res2.convergence_history)
    for p1, p2 in zip(res1.convergence_history, res2.convergence_history):
        assert p1["best_fitness"] == pytest.approx(p2["best_fitness"], rel=1e-6)
