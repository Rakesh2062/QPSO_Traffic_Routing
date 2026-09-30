"""
WebSocket endpoint for real-time optimization progress streaming.

Subscribes to Redis pub/sub channels for all algorithms executing under a scenario
(QPSO + baselines selected) and forwards live iteration metrics & routes to connected clients.
"""

from __future__ import annotations

import asyncio
import json
import logging
import uuid

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import redis.asyncio as aioredis
from sqlalchemy import select

from backend.app.core.config import settings
from backend.app.core.redis_client import progress_channel, progress_pattern
from backend.db.session import AsyncSessionFactory
from backend.models.scenario import Scenario

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ws", tags=["websocket"])


@router.websocket("/scenarios/{job_id}")
async def scenario_progress_ws(websocket: WebSocket, job_id: str) -> None:
    """
    Stream live iteration progress for a scenario job over WebSocket.
    Fan-in handler for multi-algorithm channels (QPSO + GA + Classical PSO + ACO + OR-Tools).
    """
    await websocket.accept()
    logger.info("WebSocket client connected for job %s", job_id)

    # 1. Lookup running algorithms for this scenario from the DB
    active_algorithms = ["qpso"]
    try:
        uuid_obj = uuid.UUID(job_id)
        async with AsyncSessionFactory() as session:
            stmt = select(Scenario.baselines_selected).where(Scenario.id == uuid_obj)
            res = await session.execute(stmt)
            baselines = res.scalar_one_or_none()
            if baselines and isinstance(baselines, list):
                for b in baselines:
                    if b not in active_algorithms:
                        active_algorithms.append(b)
    except Exception as exc:
        logger.debug("Scenario algorithm lookup info (using pattern fallback): %s", exc)

    redis_sub: aioredis.Redis | None = None
    pubsub: aioredis.client.PubSub | None = None

    try:
        redis_sub = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
        )
        pubsub = redis_sub.pubsub()

        # 2. Subscribe to all corresponding Redis channels in parallel
        channels = [progress_channel(job_id, algo) for algo in active_algorithms]
        pattern = progress_pattern(job_id)
        
        # Subscribe to both explicit channels and pattern to ensure zero dropped messages
        await pubsub.subscribe(*channels)
        await pubsub.psubscribe(pattern)
        logger.info(
            "Subscribed to Redis channels %s & pattern %s for job %s",
            channels,
            pattern,
            job_id,
        )

        while True:
            # Poll for messages with small timeout to detect disconnections
            message = await pubsub.get_message(ignore_subscribe_messages=True, timeout=0.5)
            if message and message.get("type") in ("message", "pmessage"):
                raw_channel = str(message.get("channel", ""))
                data = message.get("data")
                if data:
                    try:
                        parsed = json.loads(data) if isinstance(data, str) else data
                        if isinstance(parsed, dict):
                            # 3. Ensure message is tagged with the algorithm source
                            if "algorithm" not in parsed or not parsed["algorithm"]:
                                # Extract from channel name `job_progress:{job_id}:{algorithm}`
                                parts = raw_channel.split(":")
                                parsed["algorithm"] = parts[-1] if len(parts) >= 3 else "qpso"

                            await websocket.send_json(parsed)
                    except Exception as exc:
                        logger.error("Error sending progress data over websocket: %s", exc)

            # Check for client keep-alive/ping messages
            try:
                client_msg = await asyncio.wait_for(websocket.receive_text(), timeout=0.01)
                if client_msg == "ping":
                    await websocket.send_text("pong")
            except asyncio.TimeoutError:
                pass

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected for job %s", job_id)
    except Exception as exc:
        logger.warning("WebSocket streaming error for job %s: %s", job_id, exc)
    finally:
        if pubsub:
            try:
                await pubsub.punsubscribe()
                await pubsub.unsubscribe()
                await pubsub.aclose()
            except Exception:
                pass
        if redis_sub:
            try:
                await redis_sub.aclose()
            except Exception:
                pass
        logger.info("Cleaned up Redis subscription for job %s", job_id)
