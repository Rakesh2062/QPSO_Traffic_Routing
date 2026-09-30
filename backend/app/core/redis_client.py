"""
Redis async client factory, key helpers, caching, and pub/sub utilities.

Adheres strictly to the Redis specifications in redis.md:
  1. Pub/Sub: Channel naming `job_progress:{scenario_id}:{algorithm}`
  2. Status Cache: `job_status:{scenario_id}` (TTL: 3600s)
  3. Cancellation Flag: `job_cancel:{scenario_id}`
  4. Rate Limiting: `rate_limit:{user_id or ip}:{window}`
  5. Baseline Cache: `benchmark_cache:{graph_id}:{algorithm}:{params_hash}` (TTL: 86400s)
"""

from __future__ import annotations

import hashlib
import json
import logging
from typing import Any, AsyncGenerator

import redis.asyncio as aioredis

from backend.app.core.config import settings

logger = logging.getLogger(__name__)

# ── Shared async connection pool ──────────────────────────────────────────────
_async_pool: aioredis.Redis | None = None


def init_redis_pool() -> None:
    """Call once at FastAPI startup to initialize the shared Redis connection pool."""
    global _async_pool
    _async_pool = aioredis.from_url(
        settings.redis_url,
        encoding="utf-8",
        decode_responses=True,
        max_connections=50,
    )
    logger.info("Redis async pool initialised at %s", settings.redis_url)


async def close_redis_pool() -> None:
    """Call once at FastAPI shutdown."""
    global _async_pool
    if _async_pool:
        await _async_pool.aclose()
        _async_pool = None
        logger.info("Redis async pool closed")


async def get_redis() -> AsyncGenerator[aioredis.Redis, None]:
    """FastAPI dependency — yields the shared async Redis client."""
    global _async_pool
    if _async_pool is None:
        init_redis_pool()
    yield _async_pool


def get_async_redis_client() -> aioredis.Redis:
    """Get standalone or shared async Redis client for tasks and runners."""
    global _async_pool
    if _async_pool is not None:
        return _async_pool
    return aioredis.from_url(
        settings.redis_url,
        encoding="utf-8",
        decode_responses=True,
    )


# ── Key & Channel Namespaces ──────────────────────────────────────────────────

def progress_channel(scenario_id: str, algorithm: str) -> str:
    """Channel for algorithm progress: job_progress:{scenario_id}:{algorithm}"""
    return f"job_progress:{scenario_id}:{algorithm}"


def progress_pattern(scenario_id: str) -> str:
    """Pattern to subscribe to all algorithms of a scenario: job_progress:{scenario_id}:*"""
    return f"job_progress:{scenario_id}:*"


def status_key(scenario_id: str) -> str:
    """Key for scenario status cache: job_status:{scenario_id}"""
    return f"job_status:{scenario_id}"


def cancel_key(scenario_id: str) -> str:
    """Key for job cancellation flag: job_cancel:{scenario_id}"""
    return f"job_cancel:{scenario_id}"


def rate_limit_key(identifier: str, window: str) -> str:
    """Key for rate limiting: rate_limit:{identifier}:{window}"""
    return f"rate_limit:{identifier}:{window}"


def benchmark_cache_key(graph_id: str, algorithm: str, params: dict[str, Any]) -> str:
    """Key for baseline comparison result cache: benchmark_cache:{graph_id}:{algorithm}:{params_hash}"""
    params_str = json.dumps(params, sort_keys=True)
    params_hash = hashlib.sha256(params_str.encode("utf-8")).hexdigest()[:16]
    return f"benchmark_cache:{graph_id}:{algorithm}:{params_hash}"


# ── High-Level Async Cache & Control Operations ───────────────────────────────

async def cache_job_status(
    redis: aioredis.Redis,
    scenario_id: str,
    data: dict[str, Any],
    ttl: int = 3600,
) -> None:
    """Cache scenario status in Redis with 1-hour TTL."""
    try:
        key = status_key(scenario_id)
        await redis.set(key, json.dumps(data, default=str), ex=ttl)
    except Exception as exc:
        logger.debug("Redis status cache write failed for %s: %s", scenario_id, exc)


async def get_cached_job_status(
    redis: aioredis.Redis,
    scenario_id: str,
) -> dict[str, Any] | None:
    """Retrieve cached scenario status if available."""
    try:
        key = status_key(scenario_id)
        raw = await redis.get(key)
        if raw:
            return json.loads(raw)
    except Exception as exc:
        logger.debug("Redis status cache read failed for %s: %s", scenario_id, exc)
    return None


async def set_cancel_flag(redis: aioredis.Redis, scenario_id: str) -> None:
    """Set the cancellation flag for an optimization job."""
    try:
        key = cancel_key(scenario_id)
        await redis.set(key, "1", ex=settings.cancel_flag_ttl)
    except Exception as exc:
        logger.warning("Failed to set cancel flag in Redis for %s: %s", scenario_id, exc)


async def is_job_cancelled(redis: aioredis.Redis, scenario_id: str) -> bool:
    """Check if the cancellation flag is active."""
    try:
        key = cancel_key(scenario_id)
        return bool(await redis.exists(key))
    except Exception:
        return False


async def clear_cancel_flag(redis: aioredis.Redis, scenario_id: str) -> None:
    """Clear the cancellation flag on completion."""
    try:
        key = cancel_key(scenario_id)
        await redis.delete(key)
    except Exception:
        pass


async def check_rate_limit(
    redis: aioredis.Redis,
    identifier: str,
    max_requests: int = 30,
    window_seconds: int = 60,
) -> bool:
    """
    Fixed-window rate limiter.
    Returns True if request is ALLOWED, False if rate limit EXCEEDED.
    """
    try:
        window_bucket = int(__import__("time").time() // window_seconds)
        key = rate_limit_key(identifier, str(window_bucket))
        current = await redis.incr(key)
        if current == 1:
            await redis.expire(key, window_seconds + 5)
        return current <= max_requests
    except Exception as exc:
        logger.debug("Rate limit check failed (failing open): %s", exc)
        return True


async def get_cached_benchmark(
    redis: aioredis.Redis,
    graph_id: str,
    algorithm: str,
    params: dict[str, Any],
) -> dict[str, Any] | None:
    """Fetch cached baseline comparison result to avoid re-running expensive runs."""
    try:
        key = benchmark_cache_key(graph_id, algorithm, params)
        raw = await redis.get(key)
        if raw:
            return json.loads(raw)
    except Exception as exc:
        logger.debug("Benchmark cache read error: %s", exc)
    return None


async def cache_benchmark_result(
    redis: aioredis.Redis,
    graph_id: str,
    algorithm: str,
    params: dict[str, Any],
    result: dict[str, Any],
    ttl: int = 86400,
) -> None:
    """Store baseline comparison result for 24h."""
    try:
        key = benchmark_cache_key(graph_id, algorithm, params)
        await redis.set(key, json.dumps(result, default=str), ex=ttl)
    except Exception as exc:
        logger.debug("Benchmark cache write error: %s", exc)
