"""
FastAPI Main Application Entry Point.

Initializes middleware, routers, lifespan events (Redis connection pool, DB initialization),
and health check routes.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
import logging
from typing import Any, AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.api import benchmark_router, graphs_router, scenarios_router, ws_router
from backend.app.core.config import settings
from backend.app.core.redis_client import close_redis_pool, init_redis_pool
from backend.db.base import Base
from backend.db.session import engine

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
)
logger = logging.getLogger("qpso_backend")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application startup & shutdown lifespan management."""
    logger.info("Initializing QPSO Traffic Routing Backend...")
    
    # 1. Initialize Redis pool
    try:
        init_redis_pool()
    except Exception as exc:
        logger.warning("Redis initialization warning (will retry on demand): %s", exc)

    # 2. Ensure database tables exist for development
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database schema verified and tables ready.")
    except Exception as exc:
        logger.warning("Database schema check warning: %s", exc)

    logger.info("QPSO Traffic Routing Backend ready to accept requests.")
    yield

    # Shutdown
    logger.info("Shutting down backend...")
    await close_redis_pool()
    await engine.dispose()
    logger.info("Backend shutdown complete.")


app = FastAPI(
    title="QPSO Traffic Routing Optimization API",
    description=(
        "Quantum-Behaved Particle Swarm Optimization (QPSO) platform for dynamic "
        "Vehicle Routing (VRP) with time-dependent congestion and comparative baselines "
        "(Classical PSO, Genetic Algorithm, Ant Colony, OR-Tools)."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins + ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(graphs_router)
app.include_router(scenarios_router)
app.include_router(ws_router)
app.include_router(benchmark_router)


@app.get("/health", tags=["system"])
@app.get("/db-health", tags=["system"])
async def health_check() -> dict[str, Any]:
    """Health check endpoint actively verifying Database and Redis connectivity."""
    db_status = "unknown"
    redis_status = "unknown"

    # 1. Check PostgreSQL Database
    try:
        async with engine.connect() as conn:
            from sqlalchemy import text
            await conn.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as exc:
        db_status = f"error: {exc}"

    # 2. Check Redis
    try:
        from backend.app.core.redis_client import get_async_redis_client
        r = get_async_redis_client()
        if await r.ping():
            redis_status = "connected"
    except Exception as exc:
        redis_status = f"error: {exc}"

    return {
        "status": "ok" if db_status == "connected" and redis_status == "connected" else "degraded",
        "database": db_status,
        "redis": redis_status,
        "environment": settings.environment,
    }


@app.get("/", tags=["system"])
async def root() -> dict[str, str]:
    """API overview & links."""
    return {
        "title": "QPSO Traffic Routing Platform API",
        "docs": "/docs",
        "health": "/health",
        "db_health": "/db-health",
    }
