"""
QPSO Swarm — implements the Quantum PSO update equations.

Reference:
    Sun, J., Feng, B., & Xu, W. (2004). Particle swarm optimization with
    particles having quantum behavior. IEEE CEC 2004.

Update equations (per particle i, per dimension d):
    mbest_d    = (1/M) * Σ pbest[i][d]          # mean best position
    phi        ~ Uniform(0, 1)
    p_d        = phi * pbest[i][d] + (1−phi) * gbest[d]   # local attractor
    u          ~ Uniform(0, 1)
    sign       ∈ {+1, −1} equiprobably
    X_new[d]   = p_d + sign * beta * |mbest_d − X[i][d]| * ln(1/u)

Beta annealing (linear decay):
    beta(t) = beta_max − (beta_max − beta_min) * t / T_max

Convergence criterion:
    The iteration where best_fitness first falls within 1% of the final
    best_fitness is recorded as `converged_at_iter`.

Progress callback:
    A callable progress_fn(iteration, best_fitness, elapsed_ms, routes) is
    called every `publish_every` iterations.  This publishes to Redis inside
    subprocess workers without coupling the swarm logic to I/O.
"""

from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Any, Callable

import networkx as nx
import numpy as np

from backend.app.engine.graph_model import TrafficSimulator
from backend.app.engine.qpso.encoding import VRPProblem, encode
from backend.app.engine.qpso.fitness import evaluate
from backend.app.engine.qpso.local_search import two_opt_all_routes
from backend.app.engine.qpso.particle import Particle

logger = logging.getLogger(__name__)

ProgressCallback = Callable[[int, float, int, list[list[str]]], None]


@dataclass
class SwarmConfig:
    swarm_size: int = 50
    T_max: int = 200
    beta_max: float = 1.5
    beta_min: float = 0.5
    enable_2opt: bool = True
    opt2_frequency: int = 10
    seed: int = 42
    publish_every: int = 5
    top_k_2opt: int = 3        # apply 2-opt to the top-k particles


@dataclass
class SwarmResult:
    final_fitness: float
    total_distance: float
    total_time: float
    congestion_penalty: float
    constraint_violations: int
    wall_clock_ms: int
    iterations_run: int
    converged_at_iter: int | None
    routes: list[list[str]]
    convergence_history: list[dict[str, Any]]  # [{iteration, best_fitness, elapsed_ms}]


class Swarm:
    """
    QPSO swarm that optimises a VRP instance.

    Parameters
    ----------
    config   : SwarmConfig
    problem  : VRPProblem (customers, depot, demands, capacity, n_vehicles)
    G        : NetworkX DiGraph for route cost evaluation
    sim      : TrafficSimulator for dynamic edge weights
    obj      : objective weights dict {distance, time, congestion}
    progress_fn : optional callback called every `publish_every` iterations
    cancel_fn   : optional callable returning True if the run should stop
    """

    def __init__(
        self,
        config: SwarmConfig,
        problem: VRPProblem,
        G: nx.DiGraph,
        sim: TrafficSimulator,
        obj: dict[str, float],
        progress_fn: ProgressCallback | None = None,
        cancel_fn: Callable[[], bool] | None = None,
    ) -> None:
        self.config = config
        self.problem = problem
        self.G = G
        self.sim = sim
        self.obj = obj
        self.progress_fn = progress_fn
        self.cancel_fn = cancel_fn

        self._rng = np.random.default_rng(config.seed)

        # Initialise particles
        self.particles: list[Particle] = [
            Particle.random_init(problem.n_customers, problem.n_vehicles, self._rng)
            for _ in range(config.swarm_size)
        ]

        # Global best
        self.gbest: np.ndarray = self.particles[0].position.copy()
        self.gbest_fitness: float = float("inf")
        self.gbest_routes: list[list[str]] = []
        self.gbest_violations: int = 0

    # ── Public entry point ────────────────────────────────────────────────────

    def run(self) -> SwarmResult:
        """Execute the full QPSO loop and return the result."""
        cfg = self.config
        start_ms = int(time.time() * 1000)
        convergence_history: list[dict[str, Any]] = []
        converged_at_iter: int | None = None

        # ── Evaluate initial population ───────────────────────────────────────
        self._evaluate_all(t=0.0)

        for iteration in range(1, cfg.T_max + 1):
            t = float(iteration)  # proxy for wall-clock time in traffic sim

            # ── Compute beta (linear annealing) ───────────────────────────────
            beta = cfg.beta_max - (cfg.beta_max - cfg.beta_min) * iteration / cfg.T_max

            # ── Compute mean best position ────────────────────────────────────
            pbests = np.stack([p.pbest for p in self.particles])  # (M, n)
            mbest = pbests.mean(axis=0)                           # (n,)

            # ── Update each particle ──────────────────────────────────────────
            for particle in self.particles:
                self._update_particle(particle, mbest, beta)

            # ── Evaluate updated positions ────────────────────────────────────
            self._evaluate_all(t=t)

            # ── Optional 2-opt on top-k particles ────────────────────────────
            if cfg.enable_2opt and iteration % cfg.opt2_frequency == 0:
                self._apply_2opt_top_k(t=t)

            # ── Track convergence ─────────────────────────────────────────────
            elapsed_ms = int(time.time() * 1000) - start_ms
            convergence_history.append(
                {
                    "iteration": iteration,
                    "best_fitness": self.gbest_fitness,
                    "elapsed_ms": elapsed_ms,
                }
            )

            # Record converged_at_iter (within 1% of final) on the fly
            # (updated each iteration; at end of loop this is the first time
            #  it was within 1% of the *current* best — recomputed post-run)

            # ── Progress callback ─────────────────────────────────────────────
            if self.progress_fn and iteration % cfg.publish_every == 0:
                self.progress_fn(
                    iteration,
                    self.gbest_fitness,
                    elapsed_ms,
                    self.gbest_routes,
                )

            # ── Cancellation check ────────────────────────────────────────────
            if self.cancel_fn and self.cancel_fn():
                logger.info("QPSO cancelled at iteration %d", iteration)
                break

        # ── Compute converged_at_iter from full history ───────────────────────
        if convergence_history:
            final_f = convergence_history[-1]["best_fitness"]
            threshold = final_f * 1.01
            for point in convergence_history:
                if point["best_fitness"] <= threshold:
                    converged_at_iter = point["iteration"]
                    break

        wall_ms = int(time.time() * 1000) - start_ms

        # ── Derive per-route cost for the result ─────────────────────────────
        from backend.app.engine.graph_model import route_cost
        total_dist = total_time = total_cong = 0.0
        for route in self.gbest_routes:
            if len(route) > 2:
                rc = route_cost(self.G, route, self.sim, t=0.0)
                total_dist += rc["distance"]
                total_time += rc["time"]
                total_cong += rc["congestion"]

        return SwarmResult(
            final_fitness=self.gbest_fitness,
            total_distance=total_dist,
            total_time=total_time,
            congestion_penalty=total_cong,
            constraint_violations=self.gbest_violations,
            wall_clock_ms=wall_ms,
            iterations_run=len(convergence_history),
            converged_at_iter=converged_at_iter,
            routes=self.gbest_routes,
            convergence_history=convergence_history,
        )

    # ── Private helpers ───────────────────────────────────────────────────────

    def _evaluate_all(self, t: float) -> None:
        for particle in self.particles:
            fitness, routes, violations = evaluate(
                particle.position, self.problem, self.G, self.sim, self.obj, t
            )
            particle.routes = routes
            particle.n_violations = violations

            if particle.update_pbest(fitness):
                if fitness < self.gbest_fitness:
                    self.gbest = particle.pbest.copy()
                    self.gbest_fitness = fitness
                    self.gbest_routes = routes
                    self.gbest_violations = violations

    def _update_particle(
        self,
        particle: Particle,
        mbest: np.ndarray,
        beta: float,
    ) -> None:
        """Apply the QPSO position update equation."""
        n = len(particle.position)
        phi = self._rng.uniform(0.0, 1.0, size=n)
        # Local attractor p = phi*pbest + (1−phi)*gbest
        p = phi * particle.pbest + (1.0 - phi) * self.gbest

        u = self._rng.uniform(0.0, 1.0, size=n)
        # Sign: +1 or −1 with equal probability
        sign = self._rng.choice([-1.0, 1.0], size=n)

        # X_new = p ± beta * |mbest − X| * ln(1/u)
        particle.position = p + sign * beta * np.abs(mbest - particle.position) * np.log(1.0 / (u + 1e-12))

        # Clamp to valid encoding range [0, n_vehicles)
        n_v = float(self.problem.n_vehicles)
        particle.position = np.clip(particle.position, 0.0, n_v - 1e-9)

    def _apply_2opt_top_k(self, t: float) -> None:
        """Apply 2-opt to the top-k particles by pbest_fitness."""
        ranked = sorted(self.particles, key=lambda p: p.pbest_fitness)
        for particle in ranked[: self.config.top_k_2opt]:
            improved_routes = two_opt_all_routes(particle.routes, self.G, self.sim, t)
            # Re-encode improved routes back to position space
            particle.position = encode(improved_routes, self.problem)
            # Re-evaluate
            fitness, routes, violations = evaluate(
                particle.position, self.problem, self.G, self.sim, self.obj, t
            )
            particle.routes = routes
            particle.n_violations = violations
            if particle.update_pbest(fitness):
                if fitness < self.gbest_fitness:
                    self.gbest = particle.pbest.copy()
                    self.gbest_fitness = fitness
                    self.gbest_routes = routes
                    self.gbest_violations = violations
