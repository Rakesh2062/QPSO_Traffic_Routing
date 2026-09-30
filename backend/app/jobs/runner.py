"""
Optimization job runner and orchestrator.

Executes QPSO and requested baselines for a given scenario, streams iteration
progress to Redis pub/sub channel job_progress:{scenario_id}:{algorithm},
maintains the 1-hour job status cache in Redis, checks job_cancel:{scenario_id},
and persists final metrics and routes into PostgreSQL.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from backend.app.benchmarking.metrics import calculate_convergence_speed
from backend.app.core.config import settings
from backend.app.core.redis_client import (
    cache_job_status,
    clear_cancel_flag,
    get_async_redis_client,
    is_job_cancelled,
    progress_channel,
)
from backend.app.db.schemas import ProgressMessage, StopSummary
from backend.app.engine.baselines.ant_colony import run_ant_colony
from backend.app.engine.baselines.classical_pso import run_classical_pso
from backend.app.engine.baselines.exact_ortools import run_ortools
from backend.app.engine.baselines.genetic import run_genetic_algorithm
from backend.app.engine.graph_model import build_graph_from_json, TrafficSimulator
from backend.app.engine.qpso.encoding import VRPProblem
from backend.app.engine.qpso.swarm import Swarm, SwarmConfig
from backend.db.session import AsyncSessionFactory
from backend.models.algorithm_run import AlgorithmRun
from backend.models.convergence_point import ConvergencePoint
from backend.models.graph import Graph
from backend.models.scenario import Scenario

logger = logging.getLogger(__name__)


def _format_routes_to_dto(routes: list[list[str]], G: Any) -> list[dict[str, Any]]:
    """Convert raw routes into RouteDTO/StopSummary dicts with metrics per vehicle."""
    dto_list: list[dict[str, Any]] = []
    for vid, r in enumerate(routes):
        dist = 0.0
        t_time = 0.0
        route_load = 0.0
        for i in range(len(r) - 1):
            u, v = r[i], r[i + 1]
            if G.has_edge(u, v):
                edge_data = G[u][v]
                d = edge_data.get("distance", edge_data.get("length", 1.0))
                speed = edge_data.get("speed_limit", 40.0)
                dist += d
                t_time += (d / max(speed, 1.0)) * 60.0
            else:
                dist += 1.0
                t_time += 1.0

        for node in r:
            if node in G.nodes:
                route_load += float(G.nodes[node].get("demand", 0.0))

        dto_list.append({
            "vehicle_id": vid,
            "stops": r,
            "distance": round(dist, 2),
            "time": round(t_time, 2),
            "load": round(route_load, 2),
        })
    return dto_list


async def execute_scenario_job(scenario_id: uuid.UUID | str) -> None:
    """
    Main entry point for scenario execution.
    Orchestrates QPSO and selected baselines with Redis pub/sub streaming and status caching.
    """
    if isinstance(scenario_id, str):
        scenario_id = uuid.UUID(scenario_id)

    str_job_id = str(scenario_id)
    logger.info("[%s] Optimization job execution started", str_job_id)

    redis = get_async_redis_client()

    async with AsyncSessionFactory() as session:
        # Load scenario and graph
        stmt = (
            select(Scenario)
            .where(Scenario.id == scenario_id)
            .options(selectinload(Scenario.graph))
        )
        res = await session.execute(stmt)
        scenario: Scenario | None = res.scalar_one_or_none()

        if not scenario:
            logger.error("[%s] Scenario not found in database", str_job_id)
            return

        graph_record: Graph = scenario.graph
        if not graph_record:
            scenario.status = "failed"
            scenario.error_message = "Associated graph record not found"
            await session.commit()
            await cache_job_status(redis, str_job_id, {"status": "failed", "error": scenario.error_message})
            return

        scenario.status = "running"
        scenario.started_at = datetime.now(timezone.utc)
        await session.commit()

        # Update Redis status cache
        await cache_job_status(
            redis,
            str_job_id,
            {
                "id": str_job_id,
                "status": "running",
                "graph_id": str(scenario.graph_id),
                "started_at": scenario.started_at.isoformat(),
                "num_vehicles": scenario.num_vehicles,
            },
        )

        # Reconstruct Graph, Simulator, and Problem
        try:
            G = build_graph_from_json(graph_record.graph_data)
            sim = TrafficSimulator(G, base_seed=42)

            customers = [n for n in G.nodes if n != scenario.depot_node_id]
            demands = {n: float(G.nodes[n].get("demand", 1.0)) for n in customers}

            problem = VRPProblem(
                depot_node_id=scenario.depot_node_id,
                customers=customers,
                demands=demands,
                vehicle_capacity=scenario.vehicle_capacity,
                n_vehicles=scenario.num_vehicles,
            )
        except Exception as exc:
            logger.exception("[%s] Failed to construct VRP problem: %s", str_job_id, exc)
            scenario.status = "failed"
            scenario.error_message = f"Problem construction failed: {exc}"
            await session.commit()
            await cache_job_status(redis, str_job_id, {"status": "failed", "error": scenario.error_message})
            return

        obj_weights = scenario.objective_weights
        alg_params = scenario.algorithm_params
        seed = 42

        # Sync wrapper for swarm cancel check
        def check_cancelled_sync() -> bool:
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    return loop.run_until_complete(is_job_cancelled(redis, str_job_id))
            except Exception:
                pass
            return False

        async def publish_progress(
            algorithm: str,
            iteration: int,
            best_fit: float,
            elapsed: int,
            current_routes: list[list[str]] | None = None,
            done: bool = False,
            include_route: bool = False,
        ) -> None:
            try:
                # Include full routes only periodically (~every 10 msgs or when done) to optimize network bandwidth
                formatted_routes = None
                if (include_route or done) and current_routes:
                    raw_formatted = _format_routes_to_dto(current_routes, G)
                    formatted_routes = [StopSummary(**r) for r in raw_formatted]

                payload = {
                    "job_id": str_job_id,
                    "algorithm": algorithm,
                    "iteration": iteration,
                    "best_fitness": round(best_fit, 4) if best_fit is not None else 0.0,
                    "elapsed_ms": elapsed,
                    "current_best_route": [r.model_dump() for r in formatted_routes] if formatted_routes else None,
                    "done": done,
                }

                # 1. Publish to Redis pub/sub channel: job_progress:{scenario_id}:{algorithm}
                chan = progress_channel(str_job_id, algorithm)
                await redis.publish(chan, json.dumps(payload))

                # 2. Update 1-hour status cache in Redis
                await cache_job_status(
                    redis,
                    str_job_id,
                    {
                        "id": str_job_id,
                        "status": "running" if not done else "completed",
                        "algorithm": algorithm,
                        "current_iteration": iteration,
                        "best_fitness": round(best_fit, 4) if best_fit is not None else 0.0,
                        "elapsed_ms": elapsed,
                        "done": done,
                    },
                )
            except Exception as exc:
                logger.debug("[%s] Redis progress publish failed: %s", str_job_id, exc)

        # ── 1. Run QPSO ───────────────────────────────────────────────────────
        qpso_config = SwarmConfig(
            swarm_size=alg_params.get("swarm_size", settings.default_swarm_size),
            T_max=alg_params.get("T_max", settings.default_t_max),
            beta_max=alg_params.get("beta_max", settings.default_beta_max),
            beta_min=alg_params.get("beta_min", settings.default_beta_min),
            enable_2opt=alg_params.get("enable_2opt", settings.default_enable_2opt),
            opt2_frequency=alg_params.get("2opt_frequency", settings.default_2opt_frequency),
            seed=seed,
        )

        msg_count = 0

        def qpso_progress_cb(it: int, fit: float, el: int, r: list[list[str]]) -> None:
            nonlocal msg_count
            msg_count += 1
            if it % settings.progress_publish_every == 0:
                include_rt = (msg_count % 10 == 0)
                asyncio.create_task(
                    publish_progress("qpso", it, fit, el, r, done=False, include_route=include_rt)
                )

        swarm = Swarm(
            config=qpso_config,
            problem=problem,
            G=G,
            sim=sim,
            obj=obj_weights,
            progress_fn=qpso_progress_cb,
            cancel_fn=check_cancelled_sync,
        )

        qpso_res = swarm.run()
        await publish_progress(
            "qpso",
            qpso_res.iterations_run,
            qpso_res.final_fitness,
            qpso_res.wall_clock_ms,
            qpso_res.routes,
            done=True,
            include_route=True,
        )

        # Save QPSO run to database
        formatted_qpso_routes = _format_routes_to_dto(qpso_res.routes, G)
        conv_speed_qpso = calculate_convergence_speed(
            [{"iteration": p.iteration, "best_fitness": p.best_fitness} for p in qpso_res.convergence_history],
            qpso_res.final_fitness,
        )

        qpso_db_run = AlgorithmRun(
            scenario_id=scenario.id,
            algorithm="qpso",
            seed=seed,
            final_fitness=qpso_res.final_fitness,
            total_distance=qpso_res.total_distance,
            total_time=qpso_res.total_time,
            congestion_penalty=qpso_res.congestion_penalty,
            constraint_violations=qpso_res.n_violations,
            wall_clock_ms=qpso_res.wall_clock_ms,
            iterations_run=qpso_res.iterations_run,
            converged_at_iter=conv_speed_qpso,
            routes=formatted_qpso_routes,
            convergence_history=[
                {"iteration": p.iteration, "best_fitness": p.best_fitness, "elapsed_ms": p.elapsed_ms}
                for p in qpso_res.convergence_history
            ],
            status="completed" if qpso_res.status == "completed" else "failed",
        )
        session.add(qpso_db_run)
        await session.flush()

        # ── 2. Run Baselines ─────────────────────────────────────────────────
        baselines = scenario.baselines_selected or []

        for b_name in baselines:
            if await is_job_cancelled(redis, str_job_id):
                logger.info("[%s] Job cancelled before baseline %s", str_job_id, b_name)
                break

            b_res: dict[str, Any] = {}
            if b_name == "classical_pso":
                b_res = run_classical_pso(
                    problem, G, sim, obj_weights,
                    swarm_size=qpso_config.swarm_size,
                    T_max=qpso_config.T_max,
                    seed=seed,
                    cancel_fn=check_cancelled_sync,
                )
            elif b_name == "ga":
                b_res = run_genetic_algorithm(
                    problem, G, sim, obj_weights,
                    pop_size=qpso_config.swarm_size,
                    T_max=qpso_config.T_max,
                    seed=seed,
                    cancel_fn=check_cancelled_sync,
                )
            elif b_name == "aco":
                b_res = run_ant_colony(
                    problem, G, sim, obj_weights,
                    pop_size=qpso_config.swarm_size,
                    T_max=qpso_config.T_max,
                    seed=seed,
                    cancel_fn=check_cancelled_sync,
                )
            elif b_name in ("ortools", "ortools_exact"):
                b_res = run_ortools(
                    problem, G, sim, obj_weights,
                    max_nodes_cap=settings.ortools_max_nodes,
                )

            if b_res:
                b_routes = b_res.get("routes", [])
                formatted_b_routes = _format_routes_to_dto(b_routes, G)
                b_history = b_res.get("convergence_history", [])
                conv_speed_b = calculate_convergence_speed(b_history, b_res.get("final_fitness"))

                b_db_run = AlgorithmRun(
                    scenario_id=scenario.id,
                    algorithm=b_name if b_name != "ortools" else "ortools_exact",
                    seed=seed,
                    final_fitness=b_res.get("final_fitness"),
                    total_distance=b_res.get("total_distance"),
                    total_time=b_res.get("total_time"),
                    congestion_penalty=b_res.get("congestion_penalty"),
                    constraint_violations=b_res.get("n_violations", 0),
                    wall_clock_ms=b_res.get("wall_clock_ms"),
                    iterations_run=b_res.get("iterations_run"),
                    converged_at_iter=conv_speed_b,
                    routes=formatted_b_routes,
                    convergence_history=b_history,
                    status=b_res.get("status", "completed"),
                )
                session.add(b_db_run)
                await publish_progress(
                    b_name,
                    b_res.get("iterations_run", 1),
                    b_res.get("final_fitness") or 0.0,
                    b_res.get("wall_clock_ms", 0),
                    b_routes,
                    done=True,
                    include_route=True,
                )

        # ── Finalise Scenario ────────────────────────────────────────────────
        is_cancelled = await is_job_cancelled(redis, str_job_id)
        if is_cancelled:
            scenario.status = "cancelled"
        else:
            scenario.status = "completed"
        scenario.completed_at = datetime.now(timezone.utc)
        await session.commit()

        # Update final Redis cache state and cleanup cancel flag
        await cache_job_status(
            redis,
            str_job_id,
            {
                "id": str_job_id,
                "status": scenario.status,
                "completed_at": scenario.completed_at.isoformat(),
            },
            ttl=3600,
        )
        await clear_cancel_flag(redis, str_job_id)

        logger.info("[%s] Optimization job execution completed with status=%s", str_job_id, scenario.status)
