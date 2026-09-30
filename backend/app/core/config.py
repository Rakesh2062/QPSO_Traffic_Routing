"""
Application configuration — all values read from environment / .env file.
Never hardcode credentials; always use these settings objects.
"""

from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ── Database ──────────────────────────────────────────────────────────────
    database_url: str = (
        "postgresql+asyncpg://postgres:postgres@localhost:5432/qpso_routing"
    )

    # ── Redis ─────────────────────────────────────────────────────────────────
    redis_url: str = "redis://localhost:6379"

    # ── Job execution ─────────────────────────────────────────────────────────
    # Max number of concurrent optimization jobs
    max_worker_processes: int = 2
    # Publish progress every N iterations to reduce Redis traffic
    progress_publish_every: int = 5
    # Cancel-flag TTL in seconds (auto-cleanup)
    cancel_flag_ttl: int = 3600

    # ── OR-Tools safety cap ───────────────────────────────────────────────────
    ortools_max_nodes: int = 50

    # ── QPSO defaults (overridden per-scenario via algorithm_params JSONB) ───
    default_swarm_size: int = 50
    default_t_max: int = 200
    default_beta_max: float = 1.5
    default_beta_min: float = 0.5
    default_enable_2opt: bool = True
    default_2opt_frequency: int = 10

    # ── CORS ──────────────────────────────────────────────────────────────────
    cors_origins: list[str] = ["http://localhost:3000"]

    # ── Env ──────────────────────────────────────────────────────────────────
    environment: Literal["development", "production", "test"] = "development"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()


# Module-level singleton for convenience import
settings = get_settings()
