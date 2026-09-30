"""
Background task worker dispatcher.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from typing import Any

from backend.app.jobs.runner import execute_scenario_job

logger = logging.getLogger(__name__)


def dispatch_scenario_task(scenario_id: uuid.UUID | str) -> None:
    """
    Launch asynchronous optimization job.
    Called from FastAPI background tasks.
    """
    asyncio.create_task(execute_scenario_job(scenario_id))
