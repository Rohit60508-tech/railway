"""
model_loader.py
─────────────────────────────────────────────────────────────────────────────
ModelLoader: Manages lifecycle, cached loading, health checks, and thread-safe
inference execution for the defect priority machine learning model.
Provides automated fallback to the formula-based prioritizer if the artifact
is missing or loading fails.
─────────────────────────────────────────────────────────────────────────────
"""

import os
import sys
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

try:
    from shared.logger import get_logger
    from shared.models import DefectRecord
except ImportError:
    shared_path = str(Path(__file__).resolve().parent.parent)
    if shared_path not in sys.path:
        sys.path.insert(0, shared_path)
    from shared.logger import get_logger
    from shared.models import DefectRecord

from defect_prioritizer import DefectPrioritizer

logger = get_logger("model_loader")


class ModelLoader:
    """
    Singleton-friendly loader providing hot-reload capability, cached model
    in-memory storage, and robust error recovery.
    """

    _instance: Optional["ModelLoader"] = None
    _lock = threading.Lock()

    def __init__(self, model_path: Optional[Union[str, Path]] = None, config_path: Optional[Union[str, Path]] = None):
        self.prioritizer = DefectPrioritizer(config_path)
        default_rel_path = self.prioritizer.config.get("artifact_path", "artifacts/defect_priority_model.joblib")
        self.model_path = Path(model_path) if model_path else Path(__file__).resolve().parent / default_rel_path
        self._is_loaded = False
        self._load_lock = threading.Lock()

        # Attempt initial load upon instantiation
        self.load()

    @classmethod
    def get_instance(cls, model_path: Optional[Union[str, Path]] = None) -> "ModelLoader":
        """Thread-safe singleton accessor."""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls(model_path=model_path)
        return cls._instance

    def load(self) -> bool:
        """
        Loads or reloads the serialized model into memory.
        Returns True if loaded, False if fallback mode is active.
        """
        with self._load_lock:
            if not self.model_path.exists():
                logger.warning(
                    f"Model artifact not found at {self.model_path}. "
                    f"Prioritizer running in deterministic formula fallback mode."
                )
                self._is_loaded = False
                return False

            try:
                self.prioritizer.load_model(self.model_path)
                self._is_loaded = True
                logger.info(
                    f"Defect priority model successfully loaded into memory from {self.model_path}."
                )
                return True
            except Exception as err:
                logger.error(f"Failed to deserialize model artifact from {self.model_path}: {err}")
                self._is_loaded = False
                return False

    def reload(self) -> bool:
        """Forces reload of model from disk (useful after background retrain)."""
        logger.info(f"Reloading model from {self.model_path}...")
        return self.load()

    def is_loaded(self) -> bool:
        """Returns whether a trained ML model artifact is actively loaded."""
        return self._is_loaded and self.prioritizer.model is not None

    def get_metadata(self) -> Dict[str, Any]:
        """Returns loaded model metadata or fallback status."""
        return {
            "is_loaded": self.is_loaded(),
            "model_path": str(self.model_path),
            "model_metadata": self.prioritizer.model_metadata,
            "feature_keys": self.prioritizer.FEATURE_KEYS,
            "feature_weights": self.prioritizer.feature_weights,
            "model_type": (
                type(self.prioritizer.model).__name__
                if self.prioritizer.model is not None
                else "FormulaBasedPrioritizer"
            ),
        }

    def predict_priority(self, defect: Union[Dict[str, Any], DefectRecord]) -> Dict[str, Any]:
        """
        Executes prioritization for an individual defect.
        """
        return self.prioritizer.prioritize(defect)

    def predict_batch(
        self,
        defects: Union[List[Dict[str, Any]], List[DefectRecord]],
        sort_by_priority: bool = True,
    ) -> List[Dict[str, Any]]:
        """
        Executes batch prioritization and ranking for multiple defects.
        """
        return self.prioritizer.prioritize_batch(defects, sort_by_priority=sort_by_priority)

    def health_check(self) -> Dict[str, Any]:
        """
        Self-test executing an inference roundtrip to verify readiness.
        """
        test_defect = {
            "defect_id": "HEALTHCHECK_DEFECT",
            "section_id": "NDLS-CNB-UP",
            "severity": "CRITICAL",
            "source": "USFD",
            "asset_type": "RAIL_THERMIT_WELD",
            "department": "CIVIL",
            "track_count": 1,
            "trains_per_day": 120,
        }
        try:
            result = self.predict_priority(test_defect)
            status = "HEALTHY" if result.get("priority_score", 0) > 0 else "DEGRADED"
            return {
                "status": status,
                "engine": "priority-engine",
                "ml_model_active": self.is_loaded(),
                "test_score": result.get("priority_score"),
                "test_category": result.get("priority_category"),
            }
        except Exception as e:
            return {
                "status": "UNHEALTHY",
                "engine": "priority-engine",
                "error": str(e),
            }


# Singleton accessor
model_loader = ModelLoader.get_instance()
