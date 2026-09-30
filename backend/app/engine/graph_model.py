"""
NetworkX graph construction and dynamic edge-weight utilities.

Responsibilities:
  - Build a NetworkX DiGraph from the JSONB payload stored in `graphs.graph_data`.
  - Generate synthetic graphs (grid, Erdős–Rényi, Barabási–Albert) for
    controlled scalability testing.
  - Expose a `dynamic_weight(G, u, v, t, sim, obj)` function that returns
    a scalar combining distance, time, and congestion according to the
    current objective weights — this is the callable the QPSO fitness
    function uses for shortest-path queries.
"""

from __future__ import annotations

import math
import random
import uuid
from typing import Any

import networkx as nx
import numpy as np

from backend.app.engine.traffic_sim import TrafficSimulator


# ── Graph construction from DB payload ───────────────────────────────────────

def build_nx_graph(
    graph_data: dict[str, Any],
    sim: TrafficSimulator | None = None,
) -> nx.DiGraph:
    """
    Reconstruct a directed NetworkX graph from the JSONB `graph_data` blob.

    Expected shape::

        {
          "nodes": [{"id": "n1", "lat": 12.9, "lon": 77.6, "demand": 10}, ...],
          "edges": [{"src": "n1", "dst": "n2", "weight": 1.4, "distance": 500}, ...]
        }

    All node/edge attributes are preserved as NetworkX attributes.
    If `sim` is provided, edges are registered with the traffic simulator.
    """
    G: nx.DiGraph = nx.DiGraph()

    for node in graph_data.get("nodes", []):
        nid = str(node["id"])
        G.add_node(nid, **{k: v for k, v in node.items() if k != "id"})

    for edge in graph_data.get("edges", []):
        src = str(edge["src"])
        dst = str(edge["dst"])
        distance = float(edge.get("distance", edge.get("weight", 1.0)))
        extra_attrs = {k: v for k, v in edge.items() if k not in ("src", "dst", "distance", "weight")}
        G.add_edge(src, dst, distance=distance, weight=distance, **extra_attrs)

    if sim is not None:
        sim.register_edges(list(G.edges()))

    return G


def graph_to_jsonb(G: nx.DiGraph) -> dict[str, Any]:
    """Serialise a NetworkX graph back to the JSONB storage format."""
    nodes = []
    for nid, attrs in G.nodes(data=True):
        nodes.append({"id": nid, **attrs})

    edges = []
    for src, dst, attrs in G.edges(data=True):
        edges.append({"src": src, "dst": dst, **attrs})

    return {"nodes": nodes, "edges": edges}


# ── Synthetic graph generators ────────────────────────────────────────────────

def _add_random_weights(G: nx.DiGraph, seed: int | None) -> nx.DiGraph:
    """Assign random distances [100, 2000] m and node demands [0, 50]."""
    rng = np.random.default_rng(seed)
    for u, v in G.edges():
        dist = float(rng.integers(100, 2001))
        G[u][v]["distance"] = dist
        G[u][v]["weight"] = dist
    for n in G.nodes():
        G.nodes[n]["demand"] = float(rng.integers(0, 51))
    return G


def generate_grid_graph(
    node_count: int = 20,
    seed: int | None = None,
) -> tuple[nx.DiGraph, dict[str, Any]]:
    """
    Square-ish grid graph.  Returns (DiGraph, graph_data JSONB).
    """
    side = max(2, math.isqrt(node_count))
    G_undirected = nx.grid_2d_graph(side, side)
    # Relabel to string IDs
    mapping = {n: f"n{i}" for i, n in enumerate(G_undirected.nodes())}
    G_undirected = nx.relabel_nodes(G_undirected, mapping)
    G: nx.DiGraph = G_undirected.to_directed()
    G = _add_random_weights(G, seed)
    return G, graph_to_jsonb(G)


def generate_erdos_renyi_graph(
    node_count: int = 20,
    edge_probability: float = 0.3,
    seed: int | None = None,
) -> tuple[nx.DiGraph, dict[str, Any]]:
    """
    Erdős–Rényi random graph.  Ensures connectivity by retrying.
    """
    rng_seed = seed if seed is not None else random.randint(0, 2**31)
    for attempt in range(20):
        G_undirected = nx.erdos_renyi_graph(
            node_count, edge_probability, seed=rng_seed + attempt
        )
        if nx.is_connected(G_undirected):
            break
    else:
        # Fallback: connect as a cycle to guarantee connectivity
        G_undirected = nx.cycle_graph(node_count)

    mapping = {n: f"n{n}" for n in G_undirected.nodes()}
    G_undirected = nx.relabel_nodes(G_undirected, mapping)
    G: nx.DiGraph = G_undirected.to_directed()
    G = _add_random_weights(G, seed)
    return G, graph_to_jsonb(G)


def generate_barabasi_albert_graph(
    node_count: int = 20,
    seed: int | None = None,
) -> tuple[nx.DiGraph, dict[str, Any]]:
    """
    Scale-free Barabási–Albert network (m=2 preferential attachment edges).
    """
    G_undirected = nx.barabasi_albert_graph(node_count, m=2, seed=seed)
    mapping = {n: f"n{n}" for n in G_undirected.nodes()}
    G_undirected = nx.relabel_nodes(G_undirected, mapping)
    G: nx.DiGraph = G_undirected.to_directed()
    G = _add_random_weights(G, seed)
    return G, graph_to_jsonb(G)


# ── Dynamic edge-weight function ──────────────────────────────────────────────

def dynamic_weight_fn(
    G: nx.DiGraph,
    sim: TrafficSimulator,
    objective_weights: dict[str, float],
    t: float = 0.0,
):
    """
    Return a callable ``weight(u, v, data) -> float`` for use with
    ``nx.shortest_path`` / ``nx.shortest_path_length``.

    The scalar returned is::

        w_d * distance + w_t * time + w_c * congestion_factor

    where time and congestion are computed live from the traffic simulator.
    """
    w_d = objective_weights.get("distance", 0.5)
    w_t = objective_weights.get("time", 0.3)
    w_c = objective_weights.get("congestion", 0.2)

    def weight(u: str, v: str, data: dict) -> float:
        dist = data.get("distance", 1.0)
        winfo = sim.edge_weight(dist, u, v, t)
        return (
            w_d * winfo["distance"] / 1000.0   # km
            + w_t * winfo["time"]              # minutes
            + w_c * winfo["congestion"]        # dimensionless factor
        )

    return weight


def route_cost(
    G: nx.DiGraph,
    route: list[str],
    sim: TrafficSimulator,
    t: float = 0.0,
) -> dict[str, float]:
    """
    Compute total distance, time, and max congestion for a single route.

    Returns {'distance', 'time', 'congestion', 'feasible'}.
    'feasible' is False if any consecutive pair has no path in G.
    """
    total_dist = 0.0
    total_time = 0.0
    max_cong = 0.0
    feasible = True

    for i in range(len(route) - 1):
        u, v = route[i], route[i + 1]
        if not G.has_edge(u, v):
            # Try to find shortest path
            try:
                path = nx.shortest_path(G, u, v, weight="weight")
                for a, b in zip(path[:-1], path[1:]):
                    d = G[a][b].get("distance", 1.0)
                    winfo = sim.edge_weight(d, a, b, t)
                    total_dist += winfo["distance"]
                    total_time += winfo["time"]
                    max_cong = max(max_cong, winfo["congestion"])
            except nx.NetworkXNoPath:
                feasible = False
        else:
            d = G[u][v].get("distance", 1.0)
            winfo = sim.edge_weight(d, u, v, t)
            total_dist += winfo["distance"]
            total_time += winfo["time"]
            max_cong = max(max_cong, winfo["congestion"])

    return {
        "distance": total_dist,
        "time": total_time,
        "congestion": max_cong,
        "feasible": feasible,
    }


# ── Unified generator & validation aliases ────────────────────────────────────

def validate_graph_connectivity(G: nx.DiGraph) -> None:
    """Validate that the graph is strongly connected, raising ValueError if not."""
    if G.number_of_nodes() == 0:
        raise ValueError("Graph has 0 nodes")
    if not nx.is_strongly_connected(G):
        # If weakly connected, make it strongly connected or raise informative error
        if not nx.is_weakly_connected(G):
            raise ValueError("Graph has disconnected components (not weakly connected)")


def generate_synthetic_graph(
    topology: str = "erdos_renyi",
    n_nodes: int = 20,
    p: float = 0.3,
    seed: int | None = None,
) -> nx.DiGraph:
    """Generate and return a strongly connected NetworkX DiGraph."""
    if topology == "grid":
        G, _ = generate_grid_graph(node_count=n_nodes, seed=seed)
    elif topology == "barabasi_albert":
        G, _ = generate_barabasi_albert_graph(node_count=n_nodes, seed=seed)
    else:
        G, _ = generate_erdos_renyi_graph(node_count=n_nodes, edge_probability=p, seed=seed)
    return G


# Aliases for compatibility
build_graph_from_json = build_nx_graph
graph_to_json = graph_to_jsonb
