"""
Inference module for Indian Railways AI Maintenance Platform.
Exports FastAPI application, configuration, and API routers.
"""

from inference import _bootstrap
from inference.config import APIConfig, api_config
from inference.priority_api import router as priority_router
from inference.traffic_api import router as traffic_router
from inference.optimizer_api import router as optimizer_router
from inference.health_api import router as health_router

__all__ = [
    "APIConfig",
    "api_config",
    "priority_router",
    "traffic_router",
    "optimizer_router",
    "health_router",
]
