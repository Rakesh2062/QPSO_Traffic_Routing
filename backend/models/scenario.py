"""
ORM model: scenarios

One scenario = one optimisation job: a graph + VRP parameters + which
algorithms to run. A single scenario produces one algorithm_run row per
selected algorithm.
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db.base import Base

# ── Enum types ───────────────────────────────────────────────────────────────
ScenarioStatusEnum = Enum(
    "queued",
    "running",
    "completed",
    "failed",
    "cancelled",
    name="scenario_status_enum",
)


class Scenario(Base):
    """
    VRP optimisation job.

    algorithm_params JSONB shape:
        {
          "swarm_size": 50,
          "T_max": 200,
          "beta_max": 1.5,
          "beta_min": 0.5,
          "enable_2opt": true,
          "2opt_frequency": 10
        }

    objective_weights JSONB shape:
        {"distance": 0.5, "time": 0.3, "congestion": 0.2}

    baselines_selected is a VARCHAR[] holding any subset of:
        ['classical_pso', 'ga', 'aco', 'ortools']
    """

    __tablename__ = "scenarios"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    graph_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("graphs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str | None] = mapped_column(String, nullable=True)
    num_vehicles: Mapped[int] = mapped_column(Integer, nullable=False)
    vehicle_capacity: Mapped[float] = mapped_column(Float, nullable=False)
    depot_node_id: Mapped[str] = mapped_column(String, nullable=False)
    objective_weights: Mapped[dict] = mapped_column(JSONB, nullable=False)
    algorithm_params: Mapped[dict] = mapped_column(JSONB, nullable=False)
    baselines_selected: Mapped[list[str]] = mapped_column(
        ARRAY(String), nullable=False, default=list
    )
    status: Mapped[str] = mapped_column(
        ScenarioStatusEnum, nullable=False, default="queued", index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # ── relationships ────────────────────────────────────────────────────────
    graph: Mapped["Graph"] = relationship(  # noqa: F821
        "Graph", back_populates="scenarios"
    )
    algorithm_runs: Mapped[list["AlgorithmRun"]] = relationship(  # noqa: F821
        "AlgorithmRun", back_populates="scenario", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return (
            f"<Scenario id={self.id} name={self.name!r} status={self.status}>"
        )
