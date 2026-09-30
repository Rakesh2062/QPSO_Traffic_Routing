"""
SQLAlchemy async engine + session factory.

Usage (FastAPI dependency):
    async with get_session() as session:
        result = await session.execute(...)

Environment variables (loaded from .env by python-dotenv):
    DATABASE_URL — full async URL, e.g.
        postgresql+asyncpg://user:pass@localhost:5432/qpso_routing
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

import os

load_dotenv()

RAW_DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/qpso_routing",
)

if RAW_DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = RAW_DATABASE_URL.replace("postgres://", "postgresql+asyncpg://", 1)
elif RAW_DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = RAW_DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://", 1)
else:
    DATABASE_URL = RAW_DATABASE_URL

engine = create_async_engine(
    DATABASE_URL,
    echo=False,          # set True for SQL debug logging
    pool_size=10,
    max_overflow=20,
    connect_args={
        "statement_cache_size": 0,
        "prepared_statement_cache_size": 0,
    },
)

AsyncSessionFactory = async_sessionmaker(
    bind=engine,
    expire_on_commit=False,
    class_=AsyncSession,
)


@asynccontextmanager
async def get_session() -> AsyncGenerator[AsyncSession, None]:
    """Yield an async session, rolling back on error and closing on exit."""
    async with AsyncSessionFactory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    FastAPI dependency — use with ``Depends(get_db)`` in route handlers.

    Example::

        @router.get("/items")
        async def list_items(db: AsyncSession = Depends(get_db)):
            ...
    """
    async with AsyncSessionFactory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
