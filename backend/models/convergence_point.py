"""
ORM model: convergence_points

Optional split table for storing per-iteration convergence history when
T_max is large (> ~5 000 iterations). When used, algorithm_runs.convergence_history
should be left NULL and this table queried instead.

Composite index on (algorithm_run_id, iteration) supports:
  - Time-series queries for the convergence chart
  - Efficient slicing (e.g. every Nth iteration)
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db.base import Base


class ConvergencePoint(Base):
    """Single (iteration, best_fitness) data point for one algorithm run."""

    __tablename__ = "convergence_points"

    __table_args__ = (
        Index(
            "ix_convergence_points_run_iteration",
            "algorithm_run_id",
            "iteration",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    algorithm_run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("algorithm_runs.id", ondelete="CASCADE"),
        nullable=False,
    )
    iteration: Mapped[int] = mapped_column(Integer, nullable=False)
    best_fitness: Mapped[float] = mapped_column(Float, nullable=False)
    elapsed_ms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # ── relationships ────────────────────────────────────────────────────────
    algorithm_run: Mapped["AlgorithmRun"] = relationship(  # noqa: F821
        "AlgorithmRun", back_populates="convergence_points"
    )

    def __repr__(self) -> str:
        return (
            f"<ConvergencePoint run={self.algorithm_run_id} "
            f"iter={self.iteration} fitness={self.best_fitness}>"
        )
