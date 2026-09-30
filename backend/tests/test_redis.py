"""
Tests for Redis key conventions, caching functions, and rate limiting logic.
"""

import pytest

from backend.app.core.redis_client import (
    benchmark_cache_key,
    cancel_key,
    progress_channel,
    progress_pattern,
    rate_limit_key,
    status_key,
)


def test_redis_key_conventions():
    job_id = "test-job-123"
    algo = "qpso"

    assert progress_channel(job_id, algo) == "job_progress:test-job-123:qpso"
    assert progress_pattern(job_id) == "job_progress:test-job-123:*"
    assert status_key(job_id) == "job_status:test-job-123"
    assert cancel_key(job_id) == "job_cancel:test-job-123"
    assert rate_limit_key("127.0.0.1", "1000") == "rate_limit:127.0.0.1:1000"


def test_benchmark_cache_key_deterministic():
    graph_id = "graph-456"
    algo = "classical_pso"
    params1 = {"swarm_size": 50, "T_max": 200}
    params2 = {"T_max": 200, "swarm_size": 50}  # different key order

    key1 = benchmark_cache_key(graph_id, algo, params1)
    key2 = benchmark_cache_key(graph_id, algo, params2)

    assert key1 == key2
    assert key1.startswith("benchmark_cache:graph-456:classical_pso:")
