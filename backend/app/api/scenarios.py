"""
Scenario & optimization job management API endpoints.

Handles job creation with rate limiting, status polling with Redis caching (1h TTL),
result retrieval, cancellation flags, preset parameters, and result CSV exports.
"""

from __future__ import annotations

import csv
import io
import logging
import uuid
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response, status
import redis.asyncio as aioredis
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.core.config import settings
from backend.app.core.redis_client import (
    check_rate_limit,
    get_cached_job_status,
    get_redis,
    set_cancel_flag,
)
from backend.app.db.schemas import (
    AlgorithmParams,
    AlgorithmResult,
    ConvergencePoint,
    Preset,
    ScenarioCreate,
    ScenarioCreateResponse,
    ScenarioResults,
    ScenarioStatusResponse,
    StopSummary,
)
from backend.app.jobs.runner import execute_scenario_job
from backend.db.session import get_db
from backend.models.algorithm_run import AlgorithmRun
from backend.models.graph import Graph
from backend.models.scenario import Scenario

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/scenarios", tags=["scenarios"])


@router.post("", response_model=ScenarioCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_scenario(
    payload: ScenarioCreate,
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
) -> ScenarioCreateResponse:
    """
    Create and queue a new optimization job.
    Includes rate limiting per client IP (30 jobs per minute).
    """
    client_ip = request.client.host if request.client else "unknown"
    allowed = await check_rate_limit(redis, identifier=client_ip, max_requests=30, window_seconds=60)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded: maximum 30 job requests per minute. Please try again shortly.",
        )

    # Verify graph exists
    stmt = select(Graph).where(Graph.id == payload.graph_id)
    result = await db.execute(stmt)
    graph = result.scalar_one_or_none()
    if not graph:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Graph {payload.graph_id} not found",
        )

    # Check depot exists in graph
    graph_nodes = [n["id"] for n in graph.graph_data.get("nodes", [])]
    if payload.depot_node_id not in graph_nodes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Depot node '{payload.depot_node_id}' does not exist in graph {payload.graph_id}",
        )

    scenario = Scenario(
        graph_id=payload.graph_id,
        name=payload.name or f"Run on {graph.name}",
        num_vehicles=payload.num_vehicles,
        vehicle_capacity=payload.vehicle_capacity,
        depot_node_id=payload.depot_node_id,
        objective_weights=payload.objective_weights.model_dump(),
        algorithm_params=payload.algorithm_params.model_dump(by_alias=True),
        baselines_selected=payload.baselines_selected,
        status="queued",
    )
    db.add(scenario)
    await db.commit()
    await db.refresh(scenario)

    # Schedule background execution
    background_tasks.add_task(execute_scenario_job, scenario.id)
    logger.info("Queued scenario job %s", scenario.id)

    return ScenarioCreateResponse(job_id=scenario.id)


@router.get("/{scenario_id}", response_model=ScenarioStatusResponse)
async def get_scenario_status(
    scenario_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
) -> Any:
    """
    Check execution status of a scenario job.
    Checks short-lived Redis cache first to avoid hammering PostgreSQL on frequent status polls.
    """
    str_id = str(scenario_id)
    cached = await get_cached_job_status(redis, str_id)
    if cached and "status" in cached:
        # Cache hit
        return {
            "id": scenario_id,
            "status": cached.get("status"),
            "created_at": cached.get("created_at") or cached.get("started_at"),
            "started_at": cached.get("started_at"),
            "completed_at": cached.get("completed_at"),
            "error_message": cached.get("error"),
            "graph_id": cached.get("graph_id") or uuid.uuid4(),
            "name": cached.get("name"),
        }

    # Cache miss: query PostgreSQL
    stmt = select(Scenario).where(Scenario.id == scenario_id)
    result = await db.execute(stmt)
    scenario = result.scalar_one_or_none()
    if not scenario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scenario with id {scenario_id} not found",
        )
    return scenario


@router.get("/{scenario_id}/results", response_model=ScenarioResults)
async def get_scenario_results(
    scenario_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> ScenarioResults:
    """Retrieve full comparative results for all executed algorithms on this scenario."""
    stmt = (
        select(Scenario)
        .where(Scenario.id == scenario_id)
        .options(selectinload(Scenario.algorithm_runs))
    )
    result = await db.execute(stmt)
    scenario = result.scalar_one_or_none()
    if not scenario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scenario with id {scenario_id} not found",
        )

    algorithms_dict: dict[str, AlgorithmResult] = {}
    convergence_history_dict: dict[str, list[ConvergencePoint]] = {}

    for run in scenario.algorithm_runs:
        routes_summary = []
        if run.routes and isinstance(run.routes, list):
            routes_summary = [StopSummary(**r) for r in run.routes]

        algorithms_dict[run.algorithm] = AlgorithmResult(
            algorithm=run.algorithm,
            final_fitness=run.final_fitness,
            total_distance=run.total_distance,
            total_time=run.total_time,
            congestion_penalty=run.congestion_penalty,
            constraint_violations=run.constraint_violations,
            wall_clock_ms=run.wall_clock_ms,
            iterations_run=run.iterations_run,
            converged_at_iter=run.converged_at_iter,
            routes=routes_summary,
            status=run.status,
        )

        history_pts = []
        if run.convergence_history:
            for pt in run.convergence_history:
                history_pts.append(
                    ConvergencePoint(
                        iteration=pt.get("iteration", 0),
                        best_fitness=pt.get("best_fitness", 0.0),
                        elapsed_ms=pt.get("elapsed_ms"),
                    )
                )
        convergence_history_dict[run.algorithm] = history_pts

    return ScenarioResults(
        scenario_id=scenario.id,
        algorithms=algorithms_dict,
        convergence_history=convergence_history_dict,
    )


@router.post("/{scenario_id}/cancel", status_code=status.HTTP_200_OK)
async def cancel_scenario(
    scenario_id: uuid.UUID,
    redis: aioredis.Redis = Depends(get_redis),
) -> dict[str, str]:
    """Request cancellation of a running optimization job by setting job_cancel:{scenario_id}."""
    str_id = str(scenario_id)
    await set_cancel_flag(redis, str_id)
    logger.info("Cancellation flag set in Redis for job %s", str_id)
    return {"message": f"Cancellation requested for job {scenario_id}"}


@router.get("/presets/all", response_model=list[Preset])
async def get_presets() -> list[Preset]:
    """Preset hyperparameter configurations for UI quick-selection."""
    return [
        Preset(
            name="fast",
            label="Fast / Interactive",
            description="Quick 50-iteration run for rapid testing and low latency",
            algorithm_params=AlgorithmParams(
                swarm_size=20,
                T_max=50,
                beta_max=1.2,
                beta_min=0.6,
                enable_2opt=True,
                opt2_frequency=5,
            ),
        ),
        Preset(
            name="balanced",
            label="Balanced (Recommended)",
            description="Standard balanced tradeoff between convergence depth and runtime",
            algorithm_params=AlgorithmParams(
                swarm_size=50,
                T_max=200,
                beta_max=1.5,
                beta_min=0.5,
                enable_2opt=True,
                opt2_frequency=10,
            ),
        ),
        Preset(
            name="thorough",
            label="Thorough Benchmarking",
            description="High-precision 100-particle swarm for research-grade optimization",
            algorithm_params=AlgorithmParams(
                swarm_size=100,
                T_max=500,
                beta_max=1.8,
                beta_min=0.4,
                enable_2opt=True,
                opt2_frequency=15,
            ),
        ),
    ]


@router.get("/{scenario_id}/export.csv")
async def export_scenario_csv(
    scenario_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> Response:
    """Export algorithm benchmark results as a downloadable CSV."""
    stmt = (
        select(Scenario)
        .where(Scenario.id == scenario_id)
        .options(selectinload(Scenario.algorithm_runs))
    )
    result = await db.execute(stmt)
    scenario = result.scalar_one_or_none()
    if not scenario:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scenario not found",
        )

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "scenario_id",
        "algorithm",
        "final_fitness",
        "total_distance",
        "total_time",
        "congestion_penalty",
        "constraint_violations",
        "wall_clock_ms",
        "iterations_run",
        "converged_at_iter",
        "status",
    ])

    for run in scenario.algorithm_runs:
        writer.writerow([
            str(scenario.id),
            run.algorithm,
            run.final_fitness,
            run.total_distance,
            run.total_time,
            run.congestion_penalty,
            run.constraint_violations,
            run.wall_clock_ms,
            run.iterations_run,
            run.converged_at_iter,
            run.status,
        ])

    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="scenario_{scenario_id}_results.csv"'},
    )
