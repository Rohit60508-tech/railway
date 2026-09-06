"""
settings.py
─────────────────────────────────────────────────────────────────────────────
Backend configuration for Indian Railways platform:
Database URLs, AI service endpoints, and Python interpreter paths.
─────────────────────────────────────────────────────────────────────────────
"""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
WORKSPACE_DIR = BASE_DIR.parent
AI_MODELS_DIR = WORKSPACE_DIR / "ai-models"

# AI Inference Service Configuration
AI_SERVICE_URL = os.getenv("AI_SERVICE_URL", "http://127.0.0.1:5000")
AI_PORT = int(os.getenv("API_PORT", 5000))
PYTHON_PATH = os.getenv("PYTHON_PATH", "python")

# Database & Broker Settings
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://ir_app:password@localhost:5432/ir_maintenance")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_SERVERS", "localhost:9092")

# Endpoints mapping
AI_ENDPOINTS = {
    "health": f"{AI_SERVICE_URL}/api/v1/health",
    "priority_defect": f"{AI_SERVICE_URL}/api/v1/prioritize/defect",
    "priority_batch": f"{AI_SERVICE_URL}/api/v1/prioritize/batch",
    "priority_model_info": f"{AI_SERVICE_URL}/api/v1/priority/model-info",
    "traffic_occupancy": f"{AI_SERVICE_URL}/api/v1/traffic/occupancy",
    "traffic_slots": f"{AI_SERVICE_URL}/api/v1/traffic/slots",
    "traffic_best_slots": f"{AI_SERVICE_URL}/api/v1/traffic/best-slots",
    "traffic_forecast": f"{AI_SERVICE_URL}/api/v1/traffic/forecast",
    "optimizer_schedule": f"{AI_SERVICE_URL}/api/v1/optimize/schedule",
    "optimizer_bundle": f"{AI_SERVICE_URL}/api/v1/optimize/bundle",
    "optimizer_constraints": f"{AI_SERVICE_URL}/api/v1/optimize/constraints",
    "optimizer_validate": f"{AI_SERVICE_URL}/api/v1/optimize/validate",
}
