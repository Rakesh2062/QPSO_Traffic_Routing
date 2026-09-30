"""initial_schema

Revision ID: 00189e1bdb99
Revises:
Create Date: 2026-09-28

Creates tables in dependency order:
  1. graphs
  2. scenarios (FK → graphs)
  3. algorithm_runs (FK → scenarios)
  4. convergence_points (FK → algorithm_runs)

PostGIS extension and the geoalchemy2 Geometry column are included.
Run `CREATE EXTENSION IF NOT EXISTS postgis;` once on the DB before
applying this migration if PostGIS isn't already active.
"""

from typing import Sequence, Union

import sqlalchemy as sa
import geoalchemy2
from alembic import op
from sqlalchemy.dialects import postgresql

# ── Alembic metadata ─────────────────────────────────────────────────────────
revision: str = "00189e1bdb99"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Ensure PostGIS is available ───────────────────────────────────────────
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")

    # ── Enum types ────────────────────────────────────────────────────────────
    source_type_enum = postgresql.ENUM(
        "uploaded", "generated", "osm_import",
        name="source_type_enum", create_type=True,
    )
    scenario_status_enum = postgresql.ENUM(
        "queued", "running", "completed", "failed", "cancelled",
        name="scenario_status_enum", create_type=True,
    )
    algorithm_enum = postgresql.ENUM(
        "qpso", "classical_pso", "ga", "aco", "ortools_exact",
        name="algorithm_enum", create_type=True,
    )
    run_status_enum = postgresql.ENUM(
        "running", "completed", "failed",
        name="run_status_enum", create_type=True,
    )

    # ── 1. graphs ─────────────────────────────────────────────────────────────
    op.create_table(
        "graphs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("source_type", source_type_enum, nullable=False),
        sa.Column("node_count", sa.Integer(), nullable=True),
        sa.Column("edge_count", sa.Integer(), nullable=True),
        sa.Column("has_coordinates", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("graph_data", postgresql.JSONB(), nullable=False),
        sa.Column(
            "bounding_box",
            geoalchemy2.types.Geometry(geometry_type="POLYGON", srid=4326),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("metadata", postgresql.JSONB(), nullable=True),
    )

    # ── 2. scenarios ──────────────────────────────────────────────────────────
    op.create_table(
        "scenarios",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "graph_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("graphs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(), nullable=True),
        sa.Column("num_vehicles", sa.Integer(), nullable=False),
        sa.Column("vehicle_capacity", sa.Float(), nullable=False),
        sa.Column("depot_node_id", sa.String(), nullable=False),
        sa.Column("objective_weights", postgresql.JSONB(), nullable=False),
        sa.Column("algorithm_params", postgresql.JSONB(), nullable=False),
        sa.Column(
            "baselines_selected",
            postgresql.ARRAY(sa.String()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "status",
            scenario_status_enum,
            nullable=False,
            server_default="queued",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
    )
    op.create_index("ix_scenarios_status", "scenarios", ["status"])
    op.create_index("ix_scenarios_graph_id", "scenarios", ["graph_id"])

    # ── 3. algorithm_runs ─────────────────────────────────────────────────────
    op.create_table(
        "algorithm_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "scenario_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("scenarios.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("algorithm", algorithm_enum, nullable=False),
        sa.Column("seed", sa.Integer(), nullable=False),
        sa.Column("final_fitness", sa.Float(), nullable=True),
        sa.Column("total_distance", sa.Float(), nullable=True),
        sa.Column("total_time", sa.Float(), nullable=True),
        sa.Column("congestion_penalty", sa.Float(), nullable=True),
        sa.Column("constraint_violations", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("wall_clock_ms", sa.Integer(), nullable=True),
        sa.Column("iterations_run", sa.Integer(), nullable=True),
        sa.Column("converged_at_iter", sa.Integer(), nullable=True),
        sa.Column("routes", postgresql.JSONB(), nullable=True),
        sa.Column("convergence_history", postgresql.JSONB(), nullable=True),
        sa.Column(
            "status",
            run_status_enum,
            nullable=False,
            server_default="running",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_algorithm_runs_scenario_id", "algorithm_runs", ["scenario_id"]
    )
    op.create_index(
        "ix_algorithm_runs_scenario_algorithm",
        "algorithm_runs",
        ["scenario_id", "algorithm"],
    )

    # ── 4. convergence_points ─────────────────────────────────────────────────
    op.create_table(
        "convergence_points",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "algorithm_run_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("algorithm_runs.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("iteration", sa.Integer(), nullable=False),
        sa.Column("best_fitness", sa.Float(), nullable=False),
        sa.Column("elapsed_ms", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_convergence_points_run_iteration",
        "convergence_points",
        ["algorithm_run_id", "iteration"],
    )


def downgrade() -> None:
    # Drop in reverse dependency order
    op.drop_index("ix_convergence_points_run_iteration", table_name="convergence_points")
    op.drop_table("convergence_points")

    op.drop_index("ix_algorithm_runs_scenario_algorithm", table_name="algorithm_runs")
    op.drop_index("ix_algorithm_runs_scenario_id", table_name="algorithm_runs")
    op.drop_table("algorithm_runs")

    op.drop_index("ix_scenarios_graph_id", table_name="scenarios")
    op.drop_index("ix_scenarios_status", table_name="scenarios")
    op.drop_table("scenarios")

    op.drop_table("graphs")

    # Drop enum types
    op.execute("DROP TYPE IF EXISTS run_status_enum")
    op.execute("DROP TYPE IF EXISTS algorithm_enum")
    op.execute("DROP TYPE IF EXISTS scenario_status_enum")
    op.execute("DROP TYPE IF EXISTS source_type_enum")
