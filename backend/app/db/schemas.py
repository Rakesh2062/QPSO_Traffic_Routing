"""
Pydantic v2 request/response schemas.

Field names are kept identical to the DB columns and the frontend TypeScript
types to avoid a translation layer.  Every schema that appears in an API
response has a Config with from_attributes=True so SQLAlchemy ORM objects
can be passed directly to model_validate().
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator


# ── Shared value types ────────────────────────────────────────────────────────

class ObjectiveWeights(BaseModel):
    distance: float = Field(0.5, ge=0.0, le=1.0)
    time: float = Field(0.3, ge=0.0, le=1.0)
    congestion: float = Field(0.2, ge=0.0, le=1.0)

    @model_validator(mode="after")
    def weights_sum_to_one(self) -> "ObjectiveWeights":
        total = self.distance + self.time + self.congestion
        if abs(total - 1.0) > 1e-6:
            raise ValueError(
                f"objective_weights must sum to 1.0, got {total:.4f}"
            )
        return self


class AlgorithmParams(BaseModel):
    swarm_size: int = Field(50, ge=5, le=500)
    T_max: int = Field(200, ge=10, le=10_000)
    beta_max: float = Field(1.5, gt=0.0)
    beta_min: float = Field(0.5, gt=0.0)
    enable_2opt: bool = True
    opt2_frequency: int = Field(10, ge=1, alias="2opt_frequency")

    model_config = {"populate_by_name": True}

    @model_validator(mode="after")
    def beta_ordering(self) -> "AlgorithmParams":
        if self.beta_min >= self.beta_max:
            raise ValueError("beta_min must be < beta_max")
        return self


# ── Graph schemas ─────────────────────────────────────────────────────────────

class GraphGenerateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    topology: Literal["grid", "erdos_renyi", "barabasi_albert"] = "erdos_renyi"
    node_count: int = Field(20, ge=4, le=500)
    edge_probability: float = Field(0.3, ge=0.1, le=1.0)  # for Erdős–Rényi
    seed: int | None = None


class GraphSummary(BaseModel):
    id: uuid.UUID
    name: str
    source_type: str
    node_count: int | None
    edge_count: int | None
    has_coordinates: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class GraphDetail(GraphSummary):
    graph_data: dict[str, Any]
    metadata_: dict[str, Any] | None = Field(None, alias="metadata")

    model_config = {"from_attributes": True, "populate_by_name": True}


# ── Scenario schemas ──────────────────────────────────────────────────────────

VALID_BASELINES = {"classical_pso", "ga", "aco", "ortools"}


class ScenarioCreate(BaseModel):
    graph_id: uuid.UUID
    name: str | None = Field(None, max_length=255)
    num_vehicles: int = Field(..., ge=1, le=100)
    vehicle_capacity: float = Field(..., gt=0.0)
    depot_node_id: str
    objective_weights: ObjectiveWeights = Field(default_factory=ObjectiveWeights)
    algorithm_params: AlgorithmParams = Field(default_factory=AlgorithmParams)
    baselines_selected: list[str] = Field(default_factory=list)
    seed: int | None = None  # forwarded to QPSO + baselines for reproducibility

    @model_validator(mode="after")
    def validate_baselines(self) -> "ScenarioCreate":
        invalid = set(self.baselines_selected) - VALID_BASELINES
        if invalid:
            raise ValueError(f"Unknown baselines: {invalid}. Valid: {VALID_BASELINES}")
        return self


class ScenarioStatusResponse(BaseModel):
    id: uuid.UUID
    status: str
    created_at: datetime
    started_at: datetime | None
    completed_at: datetime | None
    error_message: str | None
    graph_id: uuid.UUID
    name: str | None

    model_config = {"from_attributes": True}


class ScenarioCreateResponse(BaseModel):
    job_id: uuid.UUID  # matches frontend contract: { job_id }


# ── Algorithm run / results schemas ──────────────────────────────────────────

class StopSummary(BaseModel):
    """Single vehicle route."""
    vehicle_id: int
    stops: list[str]           # node IDs including depot at start/end
    distance: float
    time: float
    load: float


class AlgorithmResult(BaseModel):
    algorithm: str
    final_fitness: float | None
    total_distance: float | None
    total_time: float | None
    congestion_penalty: float | None
    constraint_violations: int
    wall_clock_ms: int | None
    iterations_run: int | None
    converged_at_iter: int | None
    routes: list[StopSummary] | None
    status: str

    model_config = {"from_attributes": True}


class ConvergencePoint(BaseModel):
    iteration: int
    best_fitness: float
    elapsed_ms: int | None = None


class ScenarioResults(BaseModel):
    scenario_id: uuid.UUID
    algorithms: dict[str, AlgorithmResult]   # keyed by algorithm name
    convergence_history: dict[str, list[ConvergencePoint]]  # keyed by algorithm


# ── WebSocket progress message ────────────────────────────────────────────────

class ProgressMessage(BaseModel):
    """Published to Redis pub/sub and forwarded over WebSocket."""
    job_id: str
    algorithm: str
    iteration: int
    best_fitness: float
    elapsed_ms: int
    current_best_route: list[StopSummary] | None = None
    done: bool = False        # True on the final message for this algorithm


# ── Benchmark ────────────────────────────────────────────────────────────────

class BenchmarkEntry(BaseModel):
    scenario_id: uuid.UUID
    scenario_name: str | None
    graph_id: uuid.UUID
    algorithm: str
    final_fitness: float | None
    wall_clock_ms: int | None
    constraint_violations: int
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Preset ───────────────────────────────────────────────────────────────────

class Preset(BaseModel):
    name: str
    label: str
    description: str
    algorithm_params: AlgorithmParams
