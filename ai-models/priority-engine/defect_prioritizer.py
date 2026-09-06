"""
defect_prioritizer.py
─────────────────────────────────────────────────────────────────────────────
DefectPrioritizer: Core intelligence module for defect ranking and triage.
Extracts 10 domain features, computes weighted priority scores (0-100),
assigns P1-P4 triage categories, generates human-readable explanations,
and manages joblib-serialized ML model inference.
─────────────────────────────────────────────────────────────────────────────
"""

import os
import sys
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import joblib
import numpy as np
import pandas as pd

# Support both package imports and standalone imports
try:
    from shared.logger import get_logger
    from shared.models import DefectRecord, DefectSeverity
    from shared.utils import coerce_iso_date
except ImportError:
    # Adjust sys.path to resolve shared when run directly
    shared_path = str(Path(__file__).resolve().parent.parent)
    if shared_path not in sys.path:
        sys.path.insert(0, shared_path)
    from shared.logger import get_logger
    from shared.models import DefectRecord, DefectSeverity
    from shared.utils import coerce_iso_date

logger = get_logger("defect_prioritizer")

CONFIG_PATH = Path(__file__).resolve().parent / "config.json"


class DefectPrioritizer:
    """
    Automates railway track & asset defect prioritization using a multi-factor
    weighted formula and an optional trained ML model.
    """

    FEATURE_KEYS = [
        "safety_severity",
        "traffic_density",
        "overdue_days",
        "failure_probability",
        "asset_criticality",
        "redundancy_factor",
        "defect_age",
        "inspection_source_weight",
        "department_weight",
        "location_criticality",
    ]

    def __init__(self, config_path: Optional[Union[str, Path]] = None):
        self.config_path = Path(config_path) if config_path else CONFIG_PATH
        self.config: Dict[str, Any] = self._load_config()
        self.feature_weights: Dict[str, float] = self.config.get("feature_weights", {})
        self.thresholds: Dict[str, Any] = self.config.get("priority_thresholds", {})
        self.ref_weights: Dict[str, Any] = self.config.get("reference_weights", {})
        self.model: Optional[Any] = None
        self.model_metadata: Dict[str, Any] = {}

    def _load_config(self) -> Dict[str, Any]:
        """Loads configuration from config.json with graceful defaults."""
        if self.config_path.exists():
            try:
                with open(self.config_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Error loading config from {self.config_path}: {e}")
        return {
            "feature_weights": {
                "safety_severity": 0.22,
                "traffic_density": 0.14,
                "overdue_days": 0.12,
                "failure_probability": 0.12,
                "asset_criticality": 0.10,
                "redundancy_factor": 0.08,
                "defect_age": 0.06,
                "inspection_source_weight": 0.06,
                "department_weight": 0.05,
                "location_criticality": 0.05,
            },
            "priority_thresholds": {
                "P1": {"min_score": 85, "max_score": 100, "category": "P1", "label": "Critical / Immediate Intervention"},
                "P2": {"min_score": 70, "max_score": 84, "category": "P2", "label": "High Priority / Planned Window"},
                "P3": {"min_score": 50, "max_score": 69, "category": "P3", "label": "Medium Priority / Rolling Corridor"},
                "P4": {"min_score": 0, "max_score": 49, "category": "P4", "label": "Low / Routine Inspection"},
            },
        }

    # ─────────────────────────────────────────────────────────────────────────
    # Feature Extraction
    # ─────────────────────────────────────────────────────────────────────────
    def extract_features(self, defect: Union[Dict[str, Any], DefectRecord]) -> Dict[str, float]:
        """
        Extracts and normalizes the 10 domain features (0.0 to 100.0) from a defect entity.
        """
        data: Dict[str, Any] = defect.to_dict() if hasattr(defect, "to_dict") else dict(defect)
        now = datetime.now(timezone.utc)

        # 1. Safety Severity (0 - 100)
        sev_str = str(data.get("severity", "MEDIUM")).upper()
        sev_map = self.ref_weights.get("safety_severity", {
            "CRITICAL": 100.0, "HIGH": 75.0, "MEDIUM": 45.0, "LOW": 20.0
        })
        safety_severity = float(data.get("safety_severity", sev_map.get(sev_str, 50.0)))

        # 2. Traffic Density (0 - 100)
        # Normalizes trains per day (0 to 150+ trains/day) or GMT (Gross Million Tonnes)
        trains_per_day = float(data.get("trains_per_day") or data.get("traffic_density") or 60.0)
        traffic_density = min(100.0, (trains_per_day / 120.0) * 100.0)

        # 3. Overdue Days (0 - 100)
        sla_deadline = coerce_iso_date(data.get("sla_deadline"))
        overdue_days_count = 0.0
        if sla_deadline:
            delta_seconds = (now - sla_deadline).total_seconds()
            if delta_seconds > 0:
                overdue_days_count = delta_seconds / 86400.0
        else:
            overdue_days_count = float(data.get("overdue_days", 0.0))
        # 14 days overdue reaches 100 scale
        overdue_days_score = min(100.0, (overdue_days_count / 14.0) * 100.0) if overdue_days_count > 0 else 0.0

        # 4. Failure Probability (0 - 100)
        fail_prob = data.get("failure_probability") or data.get("predicted_failure_risk")
        if fail_prob is not None:
            failure_probability = float(fail_prob) * 100.0 if float(fail_prob) <= 1.0 else float(fail_prob)
        else:
            # Estimate from track quality index (TQI) or default
            tqi = data.get("track_quality_index")
            if tqi is not None:
                # Lower TQI (e.g. <40) corresponds to higher failure probability
                failure_probability = max(10.0, min(95.0, (80.0 - float(tqi)) * 1.5))
            else:
                failure_probability = 40.0

        # 5. Asset Criticality (0 - 100)
        # Mainline points/crossings, major bridges, tunnels are highest criticality
        asset_type = str(data.get("asset_type", "")).upper()
        if any(term in asset_type for term in ["SWITCH", "CROSSING", "POINT", "TURNOUT"]):
            asset_crit = 95.0
        elif any(term in asset_type for term in ["BRIDGE", "GIRDER", "VIADUCT", "TUNNEL"]):
            asset_crit = 90.0
        elif any(term in asset_type for term in ["RAIL", "WELD", "OHE_CATENARY"]):
            asset_crit = 80.0
        elif any(term in asset_type for term in ["SLEEPER", "BALLAST"]):
            asset_crit = 60.0
        else:
            asset_crit = float(data.get("asset_criticality", 65.0))
        asset_criticality = min(100.0, asset_crit)

        # 6. Redundancy Factor (0 - 100)
        # 100 = single line / zero redundancy (fatal bottleneck); 20 = quadruple track
        tracks = int(data.get("track_count") or data.get("tracks") or 2)
        if tracks == 1:
            redundancy_factor = 100.0
        elif tracks == 2:
            redundancy_factor = 60.0
        elif tracks >= 4:
            redundancy_factor = 25.0
        else:
            redundancy_factor = float(data.get("redundancy_factor", 50.0))

        # 7. Defect Age (0 - 100)
        detected_at = coerce_iso_date(data.get("detected_at"))
        if detected_at:
            age_days = max(0.0, (now - detected_at).total_seconds() / 86400.0)
        else:
            age_days = float(data.get("defect_age", 3.0))
        # 30 days defect age approaches 100 score
        defect_age = min(100.0, (age_days / 30.0) * 100.0)

        # 8. Inspection Source Weight (0 - 100)
        source = str(data.get("source", "MANUAL")).upper()
        source_map = self.ref_weights.get("inspection_sources", {
            "USFD": 100.0, "TRC": 92.0, "OMS": 85.0, "ITMS": 88.0,
            "PATROL": 80.0, "DRONE": 70.0, "MANUAL": 65.0,
        })
        inspection_source_weight = float(data.get("inspection_source_weight", source_map.get(source, 65.0)))

        # 9. Department Weight (0 - 100)
        dept = str(data.get("department", "CIVIL")).upper()
        dept_map = self.ref_weights.get("departments", {
            "CIVIL": 95.0, "TRD_OHE": 90.0, "SIGNALLING": 88.0, "ROLLING_STOCK": 80.0,
        })
        department_weight = float(data.get("department_weight", dept_map.get(dept, 75.0)))

        # 10. Location Criticality (0 - 100)
        # Approaches to junctions, ghat sections, speed restriction zones
        speed_rest = data.get("speed_restriction_kmh")
        has_speed_restriction = speed_rest is not None and float(speed_rest) < 80.0
        is_junction = bool(data.get("is_junction_approach") or "JN" in str(data.get("section_id", "")).upper())
        is_ghat = bool(data.get("is_ghat_section", False))

        loc_crit = 50.0
        if is_junction:
            loc_crit += 25.0
        if has_speed_restriction:
            loc_crit += 15.0
        if is_ghat:
            loc_crit += 20.0
        location_criticality = min(100.0, float(data.get("location_criticality", loc_crit)))

        return {
            "safety_severity": round(safety_severity, 2),
            "traffic_density": round(traffic_density, 2),
            "overdue_days": round(overdue_days_score, 2),
            "failure_probability": round(failure_probability, 2),
            "asset_criticality": round(asset_criticality, 2),
            "redundancy_factor": round(redundancy_factor, 2),
            "defect_age": round(defect_age, 2),
            "inspection_source_weight": round(inspection_source_weight, 2),
            "department_weight": round(department_weight, 2),
            "location_criticality": round(location_criticality, 2),
        }

    # ─────────────────────────────────────────────────────────────────────────
    # Score Calculation & Triage
    # ─────────────────────────────────────────────────────────────────────────
    def calculate_priority_score(self, features: Dict[str, float]) -> float:
        """
        Computes composite priority score (0.0 to 100.0) using weighted linear combination.
        """
        total_weight = sum(self.feature_weights.values())
        if total_weight <= 0:
            total_weight = 1.0

        score = 0.0
        for feat_name, weight in self.feature_weights.items():
            val = features.get(feat_name, 50.0)
            score += val * weight

        normalized_score = score / total_weight
        return round(float(np.clip(normalized_score, 0.0, 100.0)), 2)

    def categorize_priority(self, score: float) -> Tuple[str, str]:
        """
        Maps a priority score (0-100) into Indian Railways triage tier:
        - P1: 85 - 100 (Critical / Immediate Action)
        - P2: 70 - 84  (High Priority)
        - P3: 50 - 69  (Medium Priority)
        - P4: 0 - 49   (Low / Routine Maintenance)
        """
        if score >= 85.0:
            return "P1", self.thresholds.get("P1", {}).get("label", "Critical / Immediate Intervention")
        elif score >= 70.0:
            return "P2", self.thresholds.get("P2", {}).get("label", "High Priority / Planned Window")
        elif score >= 50.0:
            return "P3", self.thresholds.get("P3", {}).get("label", "Medium Priority / Rolling Corridor")
        else:
            return "P4", self.thresholds.get("P4", {}).get("label", "Low / Routine Inspection")

    # ─────────────────────────────────────────────────────────────────────────
    # Explainability
    # ─────────────────────────────────────────────────────────────────────────
    def generate_explanation(
        self,
        features: Dict[str, float],
        score: float,
        category: str,
        defect_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Generates structured, human-readable explainability report explaining why
        a defect received its priority score and tier.
        """
        # Calculate weighted contributions
        contributions: List[Dict[str, Any]] = []
        for feat, val in features.items():
            weight = self.feature_weights.get(feat, 0.1)
            weighted_contrib = val * weight
            contributions.append({
                "feature": feat,
                "raw_value": val,
                "weight": weight,
                "weighted_points": round(weighted_contrib, 2),
            })

        # Sort features by highest impact
        contributions.sort(key=lambda x: x["weighted_points"], reverse=True)

        # Build natural language narrative highlights
        highlights: List[str] = []
        if features.get("safety_severity", 0) >= 80.0:
            highlights.append("High safety severity defect posing potential derailment or electrification risk.")
        if features.get("overdue_days", 0) >= 50.0:
            highlights.append("Past mandatory rectification SLA deadline; escalating daily penalty applied.")
        if features.get("redundancy_factor", 0) >= 80.0:
            highlights.append("Section operates with single-line or constrained redundancy; zero diversion capacity.")
        if features.get("traffic_density", 0) >= 75.0:
            highlights.append("Located on dense high-speed or heavy freight corridor (>90 trains/day).")
        if features.get("inspection_source_weight", 0) >= 90.0:
            highlights.append("Instrument-verified by USFD / TRC track recording car with high instrument confidence.")

        if not highlights:
            highlights.append("Standard routine defect within normal maintenance tolerance windows.")

        # Action recommendation
        sla_hours = self.thresholds.get(category, {}).get("sla_hours", 72)
        action_rec = (
            f"Classified as {category}. Mandates action within {sla_hours} hours. "
            f"Requires coordinated block window with {features.get('department_weight', 80):.0f}% department weight."
        )

        return {
            "summary": f"{category} priority ({score}/100): " + " ".join(highlights[:2]),
            "score": score,
            "category": category,
            "sla_hours": sla_hours,
            "top_drivers": contributions[:3],
            "feature_breakdown": contributions,
            "highlights": highlights,
            "recommended_action": action_rec,
        }

    # ─────────────────────────────────────────────────────────────────────────
    # Prioritization Pipeline
    # ─────────────────────────────────────────────────────────────────────────
    def prioritize(self, defect: Union[Dict[str, Any], DefectRecord]) -> Dict[str, Any]:
        """
        Prioritizes an individual defect, returning features, score, category, and explanation.
        """
        data = defect.to_dict() if hasattr(defect, "to_dict") else dict(defect)
        defect_id = data.get("defect_id", "UNKNOWN_DEFECT")

        features = self.extract_features(data)

        # Use trained ML model if loaded, else fallback to formula
        if self.model is not None:
            try:
                score = self.predict_with_model(features)
            except Exception as err:
                logger.warning(f"Model prediction failed for {defect_id} ({err}); using formula.")
                score = self.calculate_priority_score(features)
        else:
            score = self.calculate_priority_score(features)

        category, label = self.categorize_priority(score)
        explanation = self.generate_explanation(features, score, category, data)

        return {
            "defect_id": defect_id,
            "section_id": data.get("section_id", ""),
            "department": data.get("department", ""),
            "priority_score": score,
            "priority_category": category,
            "priority_label": label,
            "features": features,
            "explanation": explanation,
            "evaluated_at": datetime.now(timezone.utc).isoformat(),
        }

    def prioritize_batch(
        self,
        defects: Union[List[Dict[str, Any]], List[DefectRecord], pd.DataFrame],
        sort_by_priority: bool = True,
    ) -> List[Dict[str, Any]]:
        """
        Processes a collection of defects and ranks them by descending priority score.
        """
        items: List[Dict[str, Any]] = []
        if isinstance(defects, pd.DataFrame):
            items = defects.to_dict(orient="records")
        else:
            for item in defects:
                items.append(item.to_dict() if hasattr(item, "to_dict") else dict(item))

        results = [self.prioritize(item) for item in items]

        if sort_by_priority:
            results.sort(key=lambda x: x["priority_score"], reverse=True)

        logger.info(f"Prioritized batch of {len(results)} defects.")
        return results

    # ─────────────────────────────────────────────────────────────────────────
    # Model Persistence (joblib)
    # ─────────────────────────────────────────────────────────────────────────
    def save_model(self, file_path: Union[str, Path], metadata: Optional[Dict[str, Any]] = None) -> str:
        """Saves current trained model and preprocessing pipeline to disk using joblib."""
        if self.model is None:
            raise ValueError("No trained model to save.")

        target_path = Path(file_path)
        target_path.parent.mkdir(parents=True, exist_ok=True)

        payload = {
            "model": self.model,
            "feature_keys": self.FEATURE_KEYS,
            "feature_weights": self.feature_weights,
            "metadata": metadata or self.model_metadata,
            "saved_at": datetime.now(timezone.utc).isoformat(),
        }
        joblib.dump(payload, target_path)
        logger.info(f"Priority model successfully saved to {target_path}")
        return str(target_path)

    def load_model(self, file_path: Union[str, Path]) -> None:
        """Loads serialized model artifact from disk using joblib."""
        target_path = Path(file_path)
        if not target_path.exists():
            raise FileNotFoundError(f"Model artifact not found at {target_path}")

        payload = joblib.load(target_path)
        if isinstance(payload, dict) and "model" in payload:
            self.model = payload["model"]
            self.model_metadata = payload.get("metadata", {})
            if "feature_weights" in payload:
                self.feature_weights = payload["feature_weights"]
        else:
            self.model = payload
            self.model_metadata = {}

        logger.info(f"Priority model loaded successfully from {target_path}")

    def predict_with_model(self, features: Dict[str, float]) -> float:
        """Uses loaded scikit-learn or XGBoost estimator to output a priority score."""
        if self.model is None:
            raise RuntimeError("Cannot predict: no model loaded.")

        feature_vector = pd.DataFrame([[features[k] for k in self.FEATURE_KEYS]], columns=self.FEATURE_KEYS)

        if hasattr(self.model, "predict_proba"):
            # If classifier over P1-P4 (classes [P4, P3, P2, P1]), compute expected value
            proba = self.model.predict_proba(feature_vector)[0]
            # Class anchors: P4->25, P3->60, P2->77, P1->92
            class_anchors = [25.0, 60.0, 77.0, 92.0]
            if len(proba) == len(class_anchors):
                score = float(np.dot(proba, class_anchors))
            else:
                score = self.calculate_priority_score(features)
        elif hasattr(self.model, "predict"):
            pred = self.model.predict(feature_vector)[0]
            score = float(pred)
        else:
            score = self.calculate_priority_score(features)

        return round(float(np.clip(score, 0.0, 100.0)), 2)
