"""
app.py
─────────────────────────────────────────────────────────────────────────────
Indian Railways AI Maintenance Platform - Inference Microservice Application
Unified FastAPI application mounting:
  - Priority API (/api/v1/prioritize/defect, /batch, /model-info, /retrain)
  - Traffic API (/api/v1/traffic/occupancy, /slots, /best-slots, /forecast)
  - Optimizer API (/api/v1/optimize/schedule, /bundle, /constraints, /validate)
  - Health & Diagnostics API (/api/v1/health, /models, /database)
─────────────────────────────────────────────────────────────────────────────
"""

import sys
from pathlib import Path
import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Ensure workspace root and ai-models directory are in Python path
MODULE_DIR = Path(__file__).resolve().parent
AI_MODELS_DIR = MODULE_DIR.parent
if str(AI_MODELS_DIR) not in sys.path:
    sys.path.insert(0, str(AI_MODELS_DIR))

from inference.config import api_config
from inference.priority_api import router as priority_router
from inference.traffic_api import router as traffic_router
from inference.optimizer_api import router as optimizer_router
from inference.health_api import router as health_router
from shared.logger import get_logger

logger = get_logger("inference_app")

# Initialize FastAPI App
app = FastAPI(
    title=api_config.title,
    description=api_config.description,
    version=api_config.version,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url=f"{api_config.api_prefix}/openapi.json",
)

# Configure CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=api_config.cors_origins,
    allow_credentials=api_config.cors_allow_credentials,
    allow_methods=api_config.cors_allow_methods,
    allow_headers=api_config.cors_allow_headers,
)

# Register Subsystem Routers
app.include_router(priority_router)
app.include_router(traffic_router)
app.include_router(optimizer_router)
app.include_router(health_router)


@app.get("/", summary="Root API Gateway Index")
async def root_index():
    return {
        "service": "Indian Railways AI Maintenance Platform - Inference Microservice",
        "version": api_config.version,
        "documentation": "/docs",
        "endpoints": {
            "priority": [
                "POST /api/v1/prioritize/defect",
                "POST /api/v1/prioritize/batch",
                "GET  /api/v1/priority/model-info",
                "POST /api/v1/priority/retrain",
            ],
            "traffic": [
                "GET  /api/v1/traffic/occupancy/{section_id}",
                "GET  /api/v1/traffic/slots/{section_id}",
                "GET  /api/v1/traffic/best-slots/{section_id}/{duration}",
                "GET  /api/v1/traffic/forecast/{section_id}/{date}",
            ],
            "optimizer": [
                "POST /api/v1/optimize/schedule",
                "POST /api/v1/optimize/bundle",
                "GET  /api/v1/optimize/constraints",
                "POST /api/v1/optimize/validate",
            ],
            "health": [
                "GET  /api/v1/health",
                "GET  /api/v1/health/models",
                "GET  /api/v1/health/database",
            ],
        },
        "status": "ONLINE",
    }


if __name__ == "__main__":
    logger.info(f"Starting Indian Railways AI inference server on {api_config.host}:{api_config.port}...")
    if api_config.debug:
        uvicorn.run(
            "app:app",
            host=api_config.host,
            port=api_config.port,
            reload=True,
            app_dir=str(MODULE_DIR),
        )
    else:
        uvicorn.run(
            app,
            host=api_config.host,
            port=api_config.port,
        )
