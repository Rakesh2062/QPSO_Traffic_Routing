"""
Benchmarking summary & comparative analytics endpoints.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.benchmarking.metrics import aggregate_seed_runs, compute_relative_improvement
from backend.db.session import get_db
from backend.models.algorithm_run import AlgorithmRun
from backend.models.scenario import Scenario

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/benchmark", tags=["benchmark"])


@router.get("")
async def get_benchmark_summary(
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """
    Get aggregated benchmark comparison across historical algorithm runs.
    Calculates statistical distributions (mean ± std dev, best, worst, speed)
    and QPSO percentage improvement over baselines.
    """
    stmt = (
        select(AlgorithmRun)
        .order_by(AlgorithmRun.created_at.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    runs = list(result.scalars().all())

    # Group runs by algorithm
    grouped: dict[str, list[dict[str, Any]]] = {}
    for r in runs:
        if r.algorithm not in grouped:
            grouped[r.algorithm] = []
        grouped[r.algorithm].append({
            "status": r.status,
            "final_fitness": r.final_fitness,
            "wall_clock_ms": r.wall_clock_ms,
            "n_violations": r.constraint_violations,
            "total_distance": r.total_distance,
            "total_time": r.total_time,
        })

    # Compute stats for each algorithm
    stats_by_algo: dict[str, Any] = {}
    for algo, algo_runs in grouped.items():
        stats_by_algo[algo] = aggregate_seed_runs(algo_runs)

    # Compute QPSO improvements if available
    comparisons: dict[str, Any] = {}
    qpso_stats = stats_by_algo.get("qpso")
    if qpso_stats and qpso_stats.get("fitness"):
        qpso_mean_fit = qpso_stats["fitness"]["mean"]
        for algo, st in stats_by_algo.items():
            if algo != "qpso" and st.get("fitness"):
                base_mean_fit = st["fitness"]["mean"]
                improvement = compute_relative_improvement(base_mean_fit, qpso_mean_fit)
                comparisons[f"qpso_vs_{algo}"] = {
                    "baseline_mean_fitness": base_mean_fit,
                    "qpso_mean_fitness": qpso_mean_fit,
                    "percentage_improvement": improvement,
                }

    return {
        "total_runs_analyzed": len(runs),
        "algorithms": stats_by_algo,
        "comparisons": comparisons,
    }
