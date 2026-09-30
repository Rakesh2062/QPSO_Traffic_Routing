"""
Tests for graph generation, connectivity validation, and dynamic traffic simulation.
"""

import pytest
import networkx as nx

from backend.app.engine.graph_model import (
    build_graph_from_json,
    generate_synthetic_graph,
    graph_to_json,
    validate_graph_connectivity,
    TrafficSimulator,
)


def test_generate_synthetic_grid():
    G = generate_synthetic_graph("grid", n_nodes=16, seed=42)
    assert G.number_of_nodes() == 16
    assert G.number_of_edges() > 0
    assert nx.is_strongly_connected(G)
    validate_graph_connectivity(G)


def test_generate_synthetic_erdos_renyi():
    G = generate_synthetic_graph("erdos_renyi", n_nodes=20, p=0.4, seed=42)
    assert G.number_of_nodes() == 20
    assert nx.is_strongly_connected(G)


def test_graph_serialization_roundtrip():
    G = generate_synthetic_graph("grid", n_nodes=9, seed=123)
    data = graph_to_json(G)
    assert "nodes" in data
    assert "edges" in data
    assert len(data["nodes"]) == 9

    G_rebuilt = build_graph_from_json(data)
    assert G_rebuilt.number_of_nodes() == G.number_of_nodes()
    assert G_rebuilt.number_of_edges() == G.number_of_edges()


def test_traffic_simulator_dynamic_weights():
    G = generate_synthetic_graph("grid", n_nodes=9, seed=42)
    sim = TrafficSimulator(G, base_seed=42)

    edges = list(G.edges())
    u, v = edges[0]

    # Congestion factor varies across time of day (t in minutes)
    factor_morning_rush = sim.congestion_factor(u, v, t=510)   # 8:30 AM
    factor_midnight = sim.congestion_factor(u, v, t=120)       # 2:00 AM

    assert factor_morning_rush >= 1.0
    assert factor_midnight >= 1.0
    # Rush hour should typically have higher or equal congestion than midnight
    assert factor_morning_rush >= factor_midnight
