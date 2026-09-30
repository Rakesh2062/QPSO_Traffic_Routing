"""
Graph management API endpoints.

Handles graph uploads (GeoJSON / CSV), synthetic graph generation, and graph queries.
"""

from __future__ import annotations

import csv
import io
import json
import logging
import uuid
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
import networkx as nx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.schemas import GraphDetail, GraphGenerateRequest, GraphSummary
from backend.app.engine.graph_model import (
    build_graph_from_json,
    generate_synthetic_graph,
    graph_to_json,
    validate_graph_connectivity,
)
from backend.db.session import get_db
from backend.models.graph import Graph

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/graphs", tags=["graphs"])


@router.get("", response_model=list[GraphSummary])
async def list_graphs(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
) -> list[Graph]:
    """List all available road networks/graphs with metadata."""
    stmt = (
        select(Graph)
        .order_by(Graph.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/{graph_id}", response_model=GraphDetail)
async def get_graph(
    graph_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> Graph:
    """Retrieve full graph JSON data and metadata for visualization."""
    stmt = select(Graph).where(Graph.id == graph_id)
    result = await db.execute(stmt)
    graph = result.scalar_one_or_none()
    if not graph:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Graph with id {graph_id} not found",
        )
    return graph


@router.post("/generate", response_model=GraphSummary, status_code=status.HTTP_201_CREATED)
async def generate_graph_endpoint(
    req: GraphGenerateRequest,
    db: AsyncSession = Depends(get_db),
) -> Graph:
    """Generate a synthetic benchmark graph (grid, Erdős–Rényi, or Barabási–Albert)."""
    try:
        G = generate_synthetic_graph(
            topology=req.topology,
            n_nodes=req.node_count,
            p=req.edge_probability,
            seed=req.seed,
        )
        validate_graph_connectivity(G)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )

    graph_data = graph_to_json(G)
    graph_record = Graph(
        name=req.name,
        source_type="generated",
        node_count=G.number_of_nodes(),
        edge_count=G.number_of_edges(),
        has_coordinates=True,
        graph_data=graph_data,
        metadata_={"topology": req.topology, "seed": req.seed},
    )
    db.add(graph_record)
    await db.commit()
    await db.refresh(graph_record)

    logger.info("Generated synthetic graph %s (nodes=%d, edges=%d)", graph_record.id, graph_record.node_count, graph_record.edge_count)
    return graph_record


@router.post("/upload", response_model=GraphSummary, status_code=status.HTTP_201_CREATED)
async def upload_graph(
    name: str = Query(..., min_length=1, max_length=255),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
) -> Graph:
    """
    Upload a graph in GeoJSON or CSV edge-list format.
    Validates strong connectivity before saving.
    """
    contents = await file.read()
    filename = file.filename or ""

    G = nx.DiGraph()

    try:
        if filename.endswith(".json") or filename.endswith(".geojson"):
            data = json.loads(contents.decode("utf-8"))
            if "nodes" in data and "edges" in data:
                # Direct graph json format
                G = build_graph_from_json(data)
            elif data.get("type") == "FeatureCollection":
                # GeoJSON LineString / Point features
                for feature in data.get("features", []):
                    geom = feature.get("geometry", {})
                    props = feature.get("properties", {})
                    if geom.get("type") == "Point":
                        coords = geom.get("coordinates", [0, 0])
                        nid = str(props.get("id") or props.get("name") or len(G.nodes))
                        G.add_node(nid, x=coords[0], y=coords[1], demand=props.get("demand", 1.0))
                    elif geom.get("type") == "LineString":
                        u = str(props.get("source") or props.get("from"))
                        v = str(props.get("target") or props.get("to"))
                        length = float(props.get("length", 1.0))
                        speed = float(props.get("speed_limit", 40.0))
                        G.add_edge(u, v, length=length, speed_limit=speed)
            else:
                raise ValueError("Unsupported JSON graph structure")
        elif filename.endswith(".csv"):
            # CSV edge list: source,target,length,speed_limit
            text_stream = io.StringIO(contents.decode("utf-8"))
            reader = csv.DictReader(text_stream)
            for row in reader:
                u = row["source"].strip()
                v = row["target"].strip()
                length = float(row.get("length", 1.0))
                speed = float(row.get("speed_limit", 40.0))
                G.add_edge(u, v, length=length, speed_limit=speed)
                if u not in G.nodes:
                    G.add_node(u, demand=1.0)
                if v not in G.nodes:
                    G.add_node(v, demand=1.0)
        else:
            raise ValueError("Supported file types are .json, .geojson, .csv")

        validate_graph_connectivity(G)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid or disconnected graph uploaded: {exc}",
        )

    graph_data = graph_to_json(G)
    has_coords = any("x" in d and "y" in d for _, d in G.nodes(data=True))

    graph_record = Graph(
        name=name,
        source_type="uploaded",
        node_count=G.number_of_nodes(),
        edge_count=G.number_of_edges(),
        has_coordinates=has_coords,
        graph_data=graph_data,
        metadata_={"filename": filename},
    )
    db.add(graph_record)
    await db.commit()
    await db.refresh(graph_record)

    logger.info("Uploaded graph %s from %s (nodes=%d, edges=%d)", graph_record.id, filename, graph_record.node_count, graph_record.edge_count)
    return graph_record
