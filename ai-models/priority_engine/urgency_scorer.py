"""
urgency_scorer.py
─────────────────────────────────────────────────────────────────────────────
UrgencyScorer: Dynamic real-time urgency engine for railway track maintenance.
Calculates time-decay SLA countdown penalties, ambient weather hazards
(heat kink / cold fracture / monsoon waterlogging), train axle fatigue cycles,
and generates structured human-readable explainability for Section Controllers.
─────────────────────────────────────────────────────────────────────────────
"""

import math
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple, Union

from shared.logger import get_logger
from shared.utils import coerce_iso_date
from defect_prioritizer import DefectPrioritizer

logger = get_logger("urgency_scorer")


class UrgencyScorer:
    """
    Computes real-time dynamic urgency score (0 - 100) reflecting instantaneous
    risk escalation due to SLA expiration, weather spikes, and axle-load cycles.
    """

    def __init__(self, prioritizer: Optional[DefectPrioritizer] = None):
        self.prioritizer = prioritizer or DefectPrioritizer()

    # ─────────────────────────────────────────────────────────────────────────
    # Environmental & Operational Factor Calculations
    # ─────────────────────────────────────────────────────────────────────────
    def compute_sla_pressure(
        self,
        detected_at: Optional[datetime],
        sla_deadline: Optional[datetime],
        severity: str = "MEDIUM",
    ) -> Tuple[float, Dict[str, Any]]:
        """
        Calculates time-decay urgency from SLA countdown.
        Returns pressure score (0-100) and context details.
        """
        now = datetime.now(timezone.utc)
        if not detected_at:
            detected_at = now - timedelta(hours=6)
        if not sla_deadline:
            # Default SLA windows
            sla_hours = {"CRITICAL": 24, "HIGH": 72, "MEDIUM": 168, "LOW": 720}.get(severity, 72)
            sla_deadline = detected_at + timedelta(hours=sla_hours)

        total_window_seconds = max(3600.0, (sla_deadline - detected_at).total_seconds())
        remaining_seconds = (sla_deadline - now).total_seconds()
        hours_remaining = remaining_seconds / 3600.0

        if remaining_seconds <= 0:
            # Overdue: Exponential escalation capped at 100
            overdue_hours = abs(remaining_seconds) / 3600.0
            # 24 hours overdue on critical hits maximum pressure
            escalation = min(100.0, 75.0 + (overdue_hours / 24.0) * 25.0)
            return escalation, {
                "status": "OVERDUE",
                "hours_remaining": round(hours_remaining, 1),
                "overdue_hours": round(overdue_hours, 1),
                "penalty_factor": round(escalation / 50.0, 2),
            }

        # Approaching deadline: Sigmoidal escalation as remaining time shrinks
        elapsed_ratio = (total_window_seconds - remaining_seconds) / total_window_seconds
        if elapsed_ratio > 0.85:
            pressure = 70.0 + (elapsed_ratio - 0.85) * 100.0
        elif elapsed_ratio > 0.50:
            pressure = 40.0 + (elapsed_ratio - 0.50) * 85.0
        else:
            pressure = elapsed_ratio * 80.0

        return round(float(min(90.0, pressure)), 2), {
            "status": "WITHIN_SLA",
            "hours_remaining": round(hours_remaining, 1),
            "elapsed_percentage": round(elapsed_ratio * 100.0, 1),
        }

    def compute_weather_hazard(
        self,
        ambient_temp_c: Optional[float] = None,
        rail_temp_c: Optional[float] = None,
        rainfall_mm_h: Optional[float] = None,
        asset_type: str = "RAIL",
    ) -> Tuple[float, List[str]]:
        """
        Evaluates weather-induced track instability:
        - Rail Temp > 60°C: Severe track buckling / sun kink hazard
        - Rail Temp < 5°C: Tensile stress & brittle rail fracture hazard
        - Rainfall > 25 mm/h: Ballast washout & earth slip risk
        """
        hazard_score = 0.0
        hazards: List[str] = []

        eff_rail_temp = rail_temp_c
        if eff_rail_temp is None and ambient_temp_c is not None:
            # Rail temperature under direct sun typically ambient + 15°C to 20°C
            eff_rail_temp = ambient_temp_c + 18.0

        if eff_rail_temp is not None:
            if eff_rail_temp >= 62.0:
                hazard_score += 45.0
                hazards.append(f"Extreme rail temperature ({eff_rail_temp:.1f}°C): High risk of track buckling (sun kink).")
            elif eff_rail_temp >= 55.0:
                hazard_score += 25.0
                hazards.append(f"Elevated rail temperature ({eff_rail_temp:.1f}°C): Pre-buckling warning range.")
            elif eff_rail_temp <= 2.0:
                hazard_score += 40.0
                hazards.append(f"Near-freezing rail temperature ({eff_rail_temp:.1f}°C): Brittle fracture hazard on welds.")
            elif eff_rail_temp <= 8.0:
                hazard_score += 20.0
                hazards.append(f"Cold rail conditions ({eff_rail_temp:.1f}°C): Elevated tensile stress.")

        if rainfall_mm_h is not None:
            if rainfall_mm_h >= 30.0:
                hazard_score += 45.0
                hazards.append(f"Torrential rainfall ({rainfall_mm_h} mm/h): Active risk of track formation washout.")
            elif rainfall_mm_h >= 15.0:
                hazard_score += 20.0
                hazards.append(f"Moderate monsoon downpour ({rainfall_mm_h} mm/h): Softening track foundation.")

        return round(float(min(100.0, hazard_score)), 2), hazards

    def compute_traffic_stress(
        self,
        trains_per_day: float = 60.0,
        has_speed_restriction: bool = False,
        premium_trains_upcoming: int = 0,
    ) -> float:
        """
        Calculates traffic dynamic stress index (0-100).
        """
        base = min(60.0, (trains_per_day / 120.0) * 60.0)
        if has_speed_restriction:
            base += 20.0  # Speed restriction causes congestion and braking stress
        if premium_trains_upcoming > 0:
            base += min(20.0, premium_trains_upcoming * 7.0)
        return round(float(min(100.0, base)), 2)

    # ─────────────────────────────────────────────────────────────────────────
    # Composite Urgency Calculation & Explainability
    # ─────────────────────────────────────────────────────────────────────────
    def calculate_urgency(
        self,
        defect: Dict[str, Any],
        realtime_context: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Combines static priority score with real-time operational context to
        produce the instantaneous urgency score and actionable explanation.
        """
        context = realtime_context or {}
        now = datetime.now(timezone.utc)

        # 1. Base Priority
        base_eval = self.prioritizer.prioritize(defect)
        base_priority = base_eval["priority_score"]
        base_category = base_eval["priority_category"]

        # 2. SLA Pressure
        detected_at = coerce_iso_date(defect.get("detected_at"))
        sla_deadline = coerce_iso_date(defect.get("sla_deadline"))
        severity = defect.get("severity", "MEDIUM")
        sla_score, sla_details = self.compute_sla_pressure(detected_at, sla_deadline, severity)

        # 3. Weather Hazard
        weather_score, weather_hazards = self.compute_weather_hazard(
            ambient_temp_c=context.get("ambient_temp_c"),
            rail_temp_c=context.get("rail_temp_c"),
            rainfall_mm_h=context.get("rainfall_mm_h"),
            asset_type=defect.get("asset_type", "RAIL"),
        )

        # 4. Traffic Stress
        traffic_stress = self.compute_traffic_stress(
            trains_per_day=float(defect.get("trains_per_day", 60.0)),
            has_speed_restriction=(defect.get("speed_restriction_kmh") is not None),
            premium_trains_upcoming=int(context.get("premium_trains_upcoming", 0)),
        )

        # 5. Composite Real-time Urgency
        # Weights: Base Priority (45%), SLA Pressure (30%), Weather Hazard (15%), Traffic Stress (10%)
        composite_urgency = (
            base_priority * 0.45
            + sla_score * 0.30
            + weather_score * 0.15
            + traffic_stress * 0.10
        )
        urgency_score = round(float(min(100.0, composite_urgency)), 2)

        # Determine Urgency Level
        if urgency_score >= 85.0:
            urgency_level = "CRITICAL_URGENT"
            recommended_window = "Immediate emergency or shadow block required within 6 hours"
        elif urgency_score >= 70.0:
            urgency_level = "HIGH_URGENCY"
            recommended_window = "Schedule in first upcoming block window within 24 hours"
        elif urgency_score >= 50.0:
            urgency_level = "ELEVATED"
            recommended_window = "Standard planned corridor window within 72 hours"
        else:
            urgency_level = "ROUTINE"
            recommended_window = "Routine scheduled maintenance"

        # Generate Explainability Rationale
        factors: List[str] = []
        if sla_details["status"] == "OVERDUE":
            factors.append(f"DEFECT IS OVERDUE by {sla_details['overdue_hours']} hours past SLA target.")
        elif sla_details.get("hours_remaining", 100) < 12:
            factors.append(f"Imminent SLA breach: Only {sla_details['hours_remaining']}h remaining.")

        if weather_hazards:
            factors.extend(weather_hazards)

        if traffic_stress > 70.0:
            factors.append(f"High traffic section stress with upcoming premium trains.")

        if not factors:
            factors.append(f"Nominal operating conditions. Priority driven by static asset classification ({base_category}).")

        explanation = {
            "summary": f"{urgency_level} ({urgency_score}/100): " + " ".join(factors[:2]),
            "urgency_score": urgency_score,
            "urgency_level": urgency_level,
            "recommended_window": recommended_window,
            "components": {
                "base_priority": base_priority,
                "sla_pressure": sla_score,
                "weather_hazard": weather_score,
                "traffic_stress": traffic_stress,
            },
            "sla_context": sla_details,
            "driving_factors": factors,
        }

        return {
            "defect_id": defect.get("defect_id", "UNKNOWN"),
            "section_id": defect.get("section_id", ""),
            "urgency_score": urgency_score,
            "urgency_level": urgency_level,
            "base_priority_category": base_category,
            "explanation": explanation,
            "timestamp": now.isoformat(),
        }
