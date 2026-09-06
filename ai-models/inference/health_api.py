"""
health_api.py
─────────────────────────────────────────────────────────────────────────────
System health, diagnostic telemetry, and readiness endpoints:
  - GET /api/v1/health          : Aggregated platform health status
  - GET /api/v1/health/models   : ML model readiness & artifact availability
  - GET /api/v1/health/database : PostgreSQL connection pool & latency diagnostics
─────────────────────────────────────────────────────────────────────────────
"""

import sys
import time
from pathlib import Path
from typing import Any, Dict
from datetime import datetime, timezone

from fastapi import APIRouter

# Resolve paths and bootstrap hyphenated packages
MODULE_DIR = Path(__file__).resolve().parent
AI_MODELS_DIR = MODULE_DIR.parent
if str(AI_MODELS_DIR) not in sys.path:
    sys.path.insert(0, str(AI_MODELS_DIR))
try:
    from inference import _bootstrap
except ImportError:
    import _bootstrap

from shared.logger import get_logger
from shared.database_connector import db_pool, PSYCOPG2_AVAILABLE
from priority_engine.model_loader import model_loader
from block_optimizer.constraint_solver import ORTOOLS_AVAILABLE

logger = get_logger("health_api")
router = APIRouter(tags=["Health & Diagnostics"])

STARTUP_TIMESTAMP = datetime.now(timezone.utc)


@router.get("/api/v1/health", summary="Overall System Health")
async def get_overall_health() -> Dict[str, Any]:
    """
    Aggregates database connectivity, ML model availability, and solver readiness.
    """
    now = datetime.now(timezone.utc)
    uptime_sec = int((now - STARTUP_TIMESTAMP).total_seconds())

    # Check models
    priority_hc = model_loader.health_check()
    models_healthy = priority_hc.get("status") in ("HEALTHY", "DEGRADED")

    # Check DB
    db_status = "CONNECTED" if (db_pool._pool is not None) else "OFFLINE_FALLBACK"

    overall_status = "HEALTHY" if models_healthy else "DEGRADED"

    return {
        "status": overall_status,
        "service": "indian-railways-ai-inference",
        "uptime_seconds": uptime_sec,
        "components": {
            "priority_model": priority_hc.get("status"),
            "database": db_status,
            "or_tools_solver": "AVAILABLE" if ORTOOLS_AVAILABLE else "HEURISTIC_FALLBACK",
        },
        "timestamp": now.isoformat(),
    }


@router.get("/api/v1/health/models", summary="Model Health Status")
async def get_model_health() -> Dict[str, Any]:
    """
    Returns granular diagnostic metrics for all deployed ML and optimization models.
    """
    now = datetime.now(timezone.utc)

    # 1. Priority Model
    prio_meta = model_loader.get_metadata()
    prio_hc = model_loader.health_check()

    # 2. Traffic Delay Model
    traffic_pkl = AI_MODELS_DIR / "traffic-predictor" / "models" / "traffic_model.pkl"
    traffic_joblib = AI_MODELS_DIR / "traffic-predictor" / "artifacts" / "traffic_forecaster.joblib"
    traffic_ready = traffic_pkl.exists() or traffic_joblib.exists()

    # 3. Block Optimizer Solver
    solver_status = "HEALTHY" if ORTOOLS_AVAILABLE else "DEGRADED_FALLBACK"

    return {
        "status": "HEALTHY" if (prio_hc.get("status") == "HEALTHY" and traffic_ready) else "DEGRADED",
        "models": {
            "priority_classifier": {
                "status": prio_hc.get("status"),
                "is_ml_active": prio_meta.get("is_loaded"),
                "model_type": prio_meta.get("model_type"),
                "artifact_path": prio_meta.get("model_path"),
            },
            "traffic_delay_regressor": {
                "status": "HEALTHY" if traffic_ready else "FORMULA_FALLBACK",
                "artifact_present": traffic_ready,
                "artifact_path": str(traffic_pkl if traffic_pkl.exists() else traffic_joblib),
            },
            "block_constraint_solver": {
                "status": solver_status,
                "engine": "Google OR-Tools CP-SAT" if ORTOOLS_AVAILABLE else "Greedy Heuristic Fallback",
                "ortools_installed": ORTOOLS_AVAILABLE,
            },
        },
        "timestamp": now.isoformat(),
    }


@router.get("/api/v1/health/database", summary="Database Connection Diagnostics")
async def get_database_health() -> Dict[str, Any]:
    """
    Tests PostgreSQL pool availability, measures roundtrip latency, and returns pool metrics.
    """
    now = datetime.now(timezone.utc)
    config = db_pool.config

    db_details = {
        "host": config.host,
        "port": config.port,
        "dbname": config.dbname,
        "psycopg2_driver": PSYCOPG2_AVAILABLE,
        "min_pool_connections": config.min_conn,
        "max_pool_connections": config.max_conn,
    }

    start_time = time.time()
    try:
        if not PSYCOPG2_AVAILABLE:
            raise RuntimeError("psycopg2 is not installed.")

        # Attempt roundtrip probe query
        probe_df = db_pool.execute_query("SELECT 1 as ping;")
        latency_ms = round((time.time() - start_time) * 1000.0, 2)
        connected = not probe_df.empty

        return {
            "status": "CONNECTED" if connected else "UNAVAILABLE",
            "latency_ms": latency_ms,
            "database_config": db_details,
            "timestamp": now.isoformat(),
        }
    except Exception as e:
        return {
            "status": "DISCONNECTED",
            "message": "Operating in resilient offline mode with synthetic RDSO data.",
            "error": str(e),
            "database_config": db_details,
            "timestamp": now.isoformat(),
        }
