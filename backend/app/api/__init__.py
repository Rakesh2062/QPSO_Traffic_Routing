from backend.app.api.benchmark import router as benchmark_router
from backend.app.api.graphs import router as graphs_router
from backend.app.api.scenarios import router as scenarios_router
from backend.app.api.ws import router as ws_router

__all__ = [
    "graphs_router",
    "scenarios_router",
    "ws_router",
    "benchmark_router",
]
