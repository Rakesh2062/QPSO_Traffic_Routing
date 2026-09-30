"""
ORM model: algorithm_runs

One row = one algorithm execution for a given scenario.
A scenario with 3 baselines selected generates 4 rows (QPSO + 3 baselines).

routes JSONB shape (mirrors frontend RouteDTO):
    [
      {
        "vehicle_id": 0,
        "stops": ["depot", "n3", "n7", "depot"],
        "distance": 42.1,
        "time": 18.5,
        "load": 320.0
      },
      ...
    ]

convergence_history JSONB shape (kept here for small T_max runs; prefer
ConvergencePoint table for T_max > 5000):
    [{"iteration": 1, "best_fitness": 0.87}, ...]
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Index,
    Integer,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db.base import Base

# ── Enum types ───────────────────────────────────────────────────────────────
AlgorithmEnum = Enum(
    "qpso",
    "classical_pso",
    "ga",
    "aco",
    "ortools_exact",
    name="algorithm_enum",
)

RunStatusEnum = Enum(
    "running",
    "completed",
    "failed",
    name="run_status_enum",
)


class AlgorithmRun(Base):
    """Result + metadata for a single algorithm execution."""

    __tablename__ = "algorithm_runs"

    # ── Composite indexes defined at the table level ─────────────────────────
    __table_args__ = (
        Index("ix_algorithm_runs_scenario_id", "scenario_id"),
        Index("ix_algorithm_runs_scenario_algorithm", "scenario_id", "algorithm"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    scenario_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("scenarios.id", ondelete="CASCADE"),
        nullable=False,
    )
    algorithm: Mapped[str] = mapped_column(AlgorithmEnum, nullable=False)
    seed: Mapped[int] = mapped_column(Integer, nullable=False)

    # ── Result metrics (nullable until run completes) ─────────────────────────
    final_fitness: Mapped[float | None] = mapped_column(Float, nullable=True)
    total_distance: Mapped[float | None] = mapped_column(Float, nullable=True)
    total_time: Mapped[float | None] = mapped_column(Float, nullable=True)
    congestion_penalty: Mapped[float | None] = mapped_column(Float, nullable=True)
    constraint_violations: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )

    # ── Execution metadata ────────────────────────────────────────────────────
    wall_clock_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    iterations_run: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # iteration index at which fitness came within X% of its final value
    converged_at_iter: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # ── Payload fields ────────────────────────────────────────────────────────
    routes: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # Inline history for short runs; use convergence_points table for long runs
    convergence_history: Mapped[list | None] = mapped_column(JSONB, nullable=True)

    status: Mapped[str] = mapped_column(
        RunStatusEnum, nullable=False, default="running"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # ── relationships ────────────────────────────────────────────────────────
    scenario: Mapped["Scenario"] = relationship(  # noqa: F821
        "Scenario", back_populates="algorithm_runs"
    )
    convergence_points: Mapped[list["ConvergencePoint"]] = relationship(  # noqa: F821
        "ConvergencePoint",
        back_populates="algorithm_run",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return (
            f"<AlgorithmRun id={self.id} algo={self.algorithm} "
            f"status={self.status} fitness={self.final_fitness}>"
        )
