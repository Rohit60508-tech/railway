"""
slot_scorer.py
─────────────────────────────────────────────────────────────────────────────
SlotScorer: Evaluates and ranks candidate corridor time slots for maintenance
bundles and tasks. Synthesizes traffic disruption, duration fit, slack buffers,
diurnal time preferences, and crew shift ergonomics.
─────────────────────────────────────────────────────────────────────────────
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Union
import numpy as np

try:
    from shared.logger import get_logger
    from shared.utils import coerce_iso_date
except ImportError:
    shared_path = str(Path(__file__).resolve().parent.parent)
    if shared_path not in sys.path:
        sys.path.insert(0, shared_path)
    from shared.logger import get_logger
    from shared.utils import coerce_iso_date

logger = get_logger("slot_scorer")

CONFIG_PATH = Path(__file__).resolve().parent / "config.json"


class SlotScorer:
    """
    Ranks candidate track maintenance time slots from highest suitability (100)
    to least desirable (0).
    """

    def __init__(self, config_path: Optional[Union[str, Path]] = None):
        self.config_path = Path(config_path) if config_path else CONFIG_PATH
        self.config = self._load_config()
        self.constraint_weights = self.config.get("constraint_weights", {
            "priority_coverage": 0.40,
            "traffic_disruption_penalty": 0.35,
            "multi_dept_bundling_bonus": 0.15,
            "crew_utilization": 0.10,
        })

    def _load_config(self) -> Dict[str, Any]:
        """Loads configuration from config.json with fallback defaults."""
        if self.config_path.exists():
            try:
                with open(self.config_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Error loading slot_scorer config: {e}")
        return {}

    def score_slot_for_bundle(
        self,
        slot: Dict[str, Any],
        bundle: Dict[str, Any],
        gang_shift_info: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Scores how well a specific time slot fits a candidate maintenance bundle.
        Higher score (0 - 100) denotes a better match.
        """
        s_start = coerce_iso_date(slot.get("slot_start") or slot.get("start_time")) or datetime.now(timezone.utc)
        s_end = coerce_iso_date(slot.get("slot_end") or slot.get("end_time")) or s_start
        slot_duration = int(slot.get("duration_minutes", (s_end - s_start).total_seconds() / 60.0))
        required_duration = int(bundle.get("required_duration_minutes", 120))

        # 1. Duration Fit Component (0 to 100)
        # Perfect fit or slight positive slack (15-30 mins) gets 100; deficit penalized heavily
        if slot_duration < required_duration:
            duration_score = max(0.0, 50.0 - (required_duration - slot_duration) * 2.0)
        else:
            slack = slot_duration - required_duration
            duration_score = max(70.0, 100.0 - slack * 0.5)

        # 2. Traffic Disruption Inverse (0 to 100, where 100 = 0 disruption)
        disruption_score = float(slot.get("disruption_score", slot.get("traffic_impact", {}).get("impact_score", 40.0)))
        traffic_suitability = max(0.0, 100.0 - disruption_score)

        # 3. Diurnal & Time Preference (0 to 100)
        hour = s_start.hour
        if 23 <= hour or hour <= 5:
            time_pref_score = 95.0  # Deep night shadow window
        elif 12 <= hour <= 15:
            time_pref_score = 80.0  # Afternoon lull
        elif (7 <= hour <= 10) or (17 <= hour <= 20):
            time_pref_score = 30.0  # Peak commuter hours
        else:
            time_pref_score = 65.0  # Normal daytime

        # 4. Multi-Department Bundling Synergy (0 to 100)
        bundling_score = float(bundle.get("bundling_score", 60.0))

        # 5. Crew Shift Ergonomics (0 to 100)
        crew_score = 80.0
        if gang_shift_info:
            is_avail = gang_shift_info.get("is_available", True)
            crew_score = 100.0 if is_avail else 20.0

        # Weighted composite calculation
        composite = (
            traffic_suitability * 0.35
            + duration_score * 0.25
            + time_pref_score * 0.20
            + bundling_score * 0.10
            + crew_score * 0.10
        )
        final_score = round(float(np.clip(composite, 0.0, 100.0)), 2)

        return {
            "slot_start": s_start.isoformat(),
            "slot_end": s_end.isoformat(),
            "slot_duration_minutes": slot_duration,
            "required_duration_minutes": required_duration,
            "suitability_score": final_score,
            "traffic_suitability": round(traffic_suitability, 2),
            "duration_score": round(duration_score, 2),
            "time_preference_score": round(time_pref_score, 2),
            "bundling_synergy": round(bundling_score, 2),
            "crew_ergonomics_score": round(crew_score, 2),
            "is_feasible": (slot_duration >= required_duration and traffic_suitability >= 20.0),
        }

    def rank_slots_for_bundle(
        self,
        candidate_slots: List[Dict[str, Any]],
        bundle: Dict[str, Any],
        top_k: int = 5,
    ) -> List[Dict[str, Any]]:
        """Ranks candidate slots for a given bundle in descending suitability order."""
        scored = [self.score_slot_for_bundle(s, bundle) for s in candidate_slots]
        # Sort descending by suitability score
        scored.sort(key=lambda x: x["suitability_score"], reverse=True)
        return scored[:top_k]
