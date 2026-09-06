"""
config.py
─────────────────────────────────────────────────────────────────────────────
AIConfig: Central configuration orchestrator for Indian Railways AI models.
Loads system-wide settings from global_config.json, exposes service-specific
configurations (priority, traffic, optimizer), and maintains defaults for
timezones, logging levels, and database batching.
─────────────────────────────────────────────────────────────────────────────
"""

import os
from pathlib import Path
from typing import Any, Dict, Optional, Union

from .utils import load_json_config
from .logger import get_logger

logger = get_logger("ai_config")

DEFAULT_GLOBAL_CONFIG_PATH = Path(__file__).resolve().parent / "global_config.json"
ROOT_AI_MODELS_DIR = Path(__file__).resolve().parent.parent


class AIConfig:
    """
    Central configuration loader and provider across all Indian Railways AI models.
    """

    def __init__(self, config_path: Optional[Union[str, Path]] = None):
        self.config_path = Path(config_path) if config_path else DEFAULT_GLOBAL_CONFIG_PATH
        self.raw_config: Dict[str, Any] = {}

        # Default system parameters
        self.default_timezone: str = "Asia/Kolkata"
        self.log_level: str = "INFO"
        self.database_batch_size: int = 1000

        self.load_config()

    def load_config(self) -> None:
        """Loads configuration from global_config.json and applies environment overrides."""
        self.raw_config = load_json_config(self.config_path)
        system_cfg = self.raw_config.get("system", {})
        def _get_val(key: str, default: Any) -> Any:
            if key in self.raw_config:
                return self.raw_config[key]
            return system_cfg.get(key, default)

        self.default_timezone = os.getenv("DEFAULT_TIMEZONE", _get_val("default_timezone", "Asia/Kolkata"))
        self.log_level = os.getenv("LOG_LEVEL", _get_val("log_level", "INFO")).upper()
        self.database_batch_size = int(
            os.getenv("DATABASE_BATCH_SIZE", _get_val("database_batch_size", 1000))
        )
        logger.debug(f"AIConfig loaded. Timezone={self.default_timezone}, BatchSize={self.database_batch_size}")

    def get_priority_config(self) -> Dict[str, Any]:
        """
        Retrieves priority engine configuration, loading from priority-engine/config.json
        if available or using the section from global_config.json.
        """
        local_path = ROOT_AI_MODELS_DIR / "priority-engine" / "config.json"
        if local_path.exists():
            cfg = load_json_config(local_path)
            if cfg:
                return cfg

        services = self.raw_config.get("services", {})
        return services.get("priority_engine", {})

    def get_traffic_config(self) -> Dict[str, Any]:
        """
        Retrieves traffic predictor configuration, loading from traffic-predictor/config.json
        if available or using the section from global_config.json.
        """
        local_path = ROOT_AI_MODELS_DIR / "traffic-predictor" / "config.json"
        if local_path.exists():
            cfg = load_json_config(local_path)
            if cfg:
                return cfg

        services = self.raw_config.get("services", {})
        return services.get("traffic_predictor", {})

    def get_optimizer_config(self) -> Dict[str, Any]:
        """
        Retrieves block optimizer configuration, loading from block-optimizer/config.json
        if available or using the section from global_config.json.
        """
        local_path = ROOT_AI_MODELS_DIR / "block-optimizer" / "config.json"
        if local_path.exists():
            cfg = load_json_config(local_path)
            if cfg:
                return cfg

        services = self.raw_config.get("services", {})
        return services.get("block_optimizer", {})


# Global singleton instance
ai_config = AIConfig()
