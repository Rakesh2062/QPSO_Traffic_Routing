"""
Synthetic traffic congestion generator.

Produces a time-varying congestion multiplier for each edge so that
weight(u, v, t) = base_weight * congestion_factor(u, v, t).

The model is deliberately simple:
  - Each edge gets a random "base congestion" drawn once at graph-load time.
  - A sinusoidal daily cycle models rush-hour peaks.
  - A small Gaussian noise term adds per-query variability.

None of this reflects real traffic; it exists only to make the routing
problem time-dependent for algorithmic interest.  Replace this module with
a real GTFS/historical-data loader when real data becomes available.
"""

from __future__ import annotations

import math
import random
from typing import Any, Dict, Tuple

import numpy as np

EdgeKey = Tuple[str, str]   # (u_id, v_id)


class TrafficSimulator:
    """
    Holds per-edge base congestion values and provides congestion_factor(u, v, t).

    Parameters
    ----------
    G : nx.DiGraph | None
        Optional graph whose edges are automatically registered.
    seed : int
        RNG seed for reproducibility.
    base_seed : int | None
        Alias for seed.
    noise_std : float
        Standard deviation of per-query Gaussian noise on the congestion factor.
    """

    def __init__(
        self,
        G: Any | None = None,
        seed: int = 42,
        base_seed: int | None = None,
        noise_std: float = 0.05,
    ) -> None:
        actual_seed = base_seed if base_seed is not None else seed
        self.seed = actual_seed
        self.noise_std = noise_std
        self._base: Dict[EdgeKey, float] = {}
        self._rng = np.random.default_rng(self.seed)

        if G is not None and hasattr(G, "edges"):
            self.register_edges(list(G.edges()))

    def reset(self, seed: int | None = None) -> None:
        """Reset the internal RNG to initial or new seed."""
        if seed is not None:
            self.seed = seed
        self._rng = np.random.default_rng(self.seed)

    # ── public API ────────────────────────────────────────────────────────────

    def register_edges(self, edges: list[tuple[str, str]]) -> None:
        """
        Assign a stable base congestion to each edge.
        Call once after the NetworkX graph is built.
        """
        for u, v in edges:
            key: EdgeKey = (u, v)
            if key not in self._base:
                # Base congestion in [0.5, 2.0]
                self._base[key] = float(self._rng.uniform(0.5, 2.0))
                # Undirected: symmetric
                self._base[(v, u)] = self._base[key]

    def congestion_factor(self, u: str, v: str, t: float = 0.0) -> float:
        """
        Return the congestion multiplier for edge (u, v) at time t (seconds
        since midnight, or any monotonic clock value).

        Formula:
            base * daily_cycle(t) + noise
        where daily_cycle peaks at t=8h and t=17h (rush hours).
        """
        base = self._base.get((u, v), 1.0)

        # Sinusoidal rush-hour model — two peaks per day
        hour = (t % 86_400) / 3600.0  # convert seconds to hours
        cycle = (
            1.0
            + 0.4 * math.sin(math.pi * (hour - 8.0) / 4.5) ** 2   # morning peak
            + 0.3 * math.sin(math.pi * (hour - 17.0) / 3.0) ** 2  # evening peak
        )
        noise = float(self._rng.normal(0.0, self.noise_std))
        return max(0.5, base * cycle + noise)

    def edge_weight(
        self,
        base_distance: float,
        u: str,
        v: str,
        t: float = 0.0,
        speed_kmh: float = 50.0,
    ) -> dict[str, float]:
        """
        Return a dict with 'distance', 'time', 'congestion' keys for one edge.

        distance : base_distance (metres or graph units, unchanged)
        time     : travel time in minutes, adjusted for congestion
        congestion : raw congestion factor (> 1 means heavier traffic)
        """
        cf = self.congestion_factor(u, v, t)
        # time = distance / (speed / congestion) in minutes
        time_min = (base_distance / 1000.0) / (speed_kmh / cf) * 60.0
        return {
            "distance": base_distance,
            "time": time_min,
            "congestion": cf,
        }
