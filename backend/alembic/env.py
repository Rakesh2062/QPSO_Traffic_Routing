"""
Alembic env.py — async version using SQLAlchemy 2.0 + asyncpg.

Key design choices:
  - DATABASE_URL is read from .env via python-dotenv; the sync psycopg2
    fallback URL is derived automatically for Alembic's DDL operations.
  - All ORM models are imported via `backend.models` so autogenerate can
    detect table additions/removals/column changes.
  - PostGIS Geometry columns are rendered correctly because GeoAlchemy2
    registers its type decorator on import (handled by model imports below).
"""

import asyncio
import os
import re
from logging.config import fileConfig

from alembic import context
from dotenv import load_dotenv
from sqlalchemy import engine_from_config, pool
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine

# ── 1. Load .env ─────────────────────────────────────────────────────────────
load_dotenv()

# ── 2. Alembic config object (gives access to alembic.ini values) ─────────
config = context.config

# ── 3. Set up Python logging from alembic.ini ─────────────────────────────
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# ── 4. Import all models so their metadata is registered ─────────────────
import backend.models  # noqa: F401 — side-effect import to register tables
from backend.db.base import Base

target_metadata = Base.metadata

# ── 5. Resolve database URLs ──────────────────────────────────────────────
RAW_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/qpso_routing",
)

# Normalize for asyncpg (requires postgresql+asyncpg://)
if RAW_URL.startswith("postgres://"):
    ASYNC_URL = RAW_URL.replace("postgres://", "postgresql+asyncpg://", 1)
elif RAW_URL.startswith("postgresql://"):
    ASYNC_URL = RAW_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
else:
    ASYNC_URL = RAW_URL

# Sync driver for alembic sync operations
SYNC_URL = re.sub(r"^postgresql\+asyncpg", "postgresql+psycopg2", ASYNC_URL)

# Override alembic.ini's sqlalchemy.url so it doesn't need a hardcoded value.
config.set_main_option("sqlalchemy.url", SYNC_URL)


# ── 6. Offline migrations (generate SQL script without a live DB) ─────────
def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode — no DB connection required."""
    context.configure(
        url=SYNC_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        include_schemas=True,
    )
    with context.begin_transaction():
        context.run_migrations()


# ── 7. Online migrations (connect and apply directly) ────────────────────
def do_run_migrations(connection):
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        include_schemas=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """Run migrations against a live database using the async engine."""
    connectable = create_async_engine(
        ASYNC_URL,
        poolclass=pool.NullPool,
        connect_args={"statement_cache_size": 0, "prepared_statement_cache_size": 0},
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


# ── 8. Entry point ────────────────────────────────────────────────────────
if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
