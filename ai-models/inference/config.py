"""
config.py
─────────────────────────────────────────────────────────────────────────────
API Configuration for Indian Railways AI Inference Microservices.
Configures server network host/port, CORS security headers, rate limiting,
API prefix, and environment overrides.
─────────────────────────────────────────────────────────────────────────────
"""

import os
from dataclasses import dataclass, field
from typing import List


@dataclass
class APIConfig:
    """Configuration container for FastAPI inference server."""

    host: str = os.getenv("API_HOST", "0.0.0.0")
    port: int = int(os.getenv("API_PORT", 5001))
    debug: bool = os.getenv("DEBUG", "false").lower() in ("true", "1", "yes")

    # API Metadata
    title: str = "Indian Railways AI Maintenance Platform API"
    description: str = (
        "RESTful inference API for defect priority scoring, train traffic density "
        "forecasting, corridor slot discovery, and multi-department block optimization."
    )
    version: str = "1.0.0"
    api_prefix: str = "/api/v1"

    # CORS Settings
    cors_origins: List[str] = field(
        default_factory=lambda: os.getenv("CORS_ORIGINS", "*").split(",")
    )
    cors_allow_credentials: bool = True
    cors_allow_methods: List[str] = field(default_factory=lambda: ["*"])
    cors_allow_headers: List[str] = field(default_factory=lambda: ["*"])

    # Rate Limiting & Timeouts
    rate_limit_per_minute: int = int(os.getenv("RATE_LIMIT_PER_MINUTE", 120))
    request_timeout_seconds: int = int(os.getenv("REQUEST_TIMEOUT_SECONDS", 30))


# Global API config instance
api_config = APIConfig()
