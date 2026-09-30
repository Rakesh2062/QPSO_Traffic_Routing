"""
ORM model: graphs

Stores a serialised NetworkX graph (node list + weighted edge list) as JSONB
and an optional PostGIS bounding-box polygon for geo-referenced networks.
"""

import uuid
from datetime import datetime

from geoalchemy2 import Geometry
from sqlalchemy import (
    Boolean,
    DateTime,
    Enum,
    Integer,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.db.base import Base

# ── Enum type (shared with Alembic DDL) ─────────────────────────────────────
SourceTypeEnum = Enum(
    "uploaded",
    "generated",
    "osm_import",
    name="source_type_enum",
)


class Graph(Base):
    """
    One row = one road/graph network.

    graph_data JSONB shape:
        {
          "nodes": [{"id": "n1", "lat": 12.9, "lon": 77.6}, ...],
          "edges": [{"src": "n1", "dst": "n2", "weight": 1.4, "distance": 500}, ...]
        }
    """

    __tablename__ = "graphs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    source_type: Mapped[str] = mapped_column(SourceTypeEnum, nullable=False)
    node_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    edge_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    has_coordinates: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    # Full NetworkX graph serialised to JSON
    graph_data: Mapped[dict] = mapped_column(JSONB, nullable=False)
    # PostGIS bounding box — nullable when has_coordinates is False
    bounding_box: Mapped[object | None] = mapped_column(
        Geometry("POLYGON", srid=4326), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    # Generator params (e.g. num_nodes, seed) when source_type='generated'
    metadata_: Mapped[dict | None] = mapped_column(
        "metadata", JSONB, nullable=True
    )

    # ── relationships ────────────────────────────────────────────────────────
    scenarios: Mapped[list["Scenario"]] = relationship(  # noqa: F821
        "Scenario", back_populates="graph", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return (
            f"<Graph id={self.id} name={self.name!r} "
            f"nodes={self.node_count} edges={self.edge_count}>"
        )
