"""
QPSO Particle data class.

Holds the mutable state for one particle in the swarm.
The Swarm class owns all particles and updates them in batch via NumPy.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np


@dataclass
class Particle:
    """
    State for a single QPSO particle.

    Attributes
    ----------
    position     : current continuous position vector X ∈ ℝ^n
    pbest        : personal best position seen so far
    pbest_fitness: fitness value at pbest
    """

    position: np.ndarray
    pbest: np.ndarray
    pbest_fitness: float = float("inf")

    # ── Cached decoded output (set by Swarm after fitness evaluation) ─────────
    routes: list[list[str]] = field(default_factory=list, repr=False)
    n_violations: int = 0

    @classmethod
    def random_init(
        cls,
        n_customers: int,
        n_vehicles: int,
        rng: np.random.Generator,
    ) -> "Particle":
        """
        Initialise with a random position ∈ [0, n_vehicles).
        This covers the full encoding range for all vehicle assignments.
        """
        position = rng.uniform(0.0, float(n_vehicles), size=n_customers)
        return cls(position=position, pbest=position.copy())

    def update_pbest(self, fitness: float) -> bool:
        """Update personal best if current fitness is lower.  Returns True if updated."""
        if fitness < self.pbest_fitness:
            self.pbest = self.position.copy()
            self.pbest_fitness = fitness
            return True
        return False
