"""
delay_predictor.py
─────────────────────────────────────────────────────────────────────────────
DelayPredictor: Models train delays and cascade delay propagation across sections.
Evaluates the probability of block overrun, train regulation requirements,
and block preemption risk from delayed high-priority passenger services.
─────────────────────────────────────────────────────────────────────────────
"""

from typing import Any, Dict, List, Optional
import numpy as np

from shared.logger import get_logger

logger = get_logger("delay_predictor")


class DelayPredictor:
    """
    Simulates knock-on delay propagation and forecasts the operational impact
    of maintenance track occupations on Indian Railways train punctuality.
    """

    # Multipliers by train category reflect IR punctuality monitoring priorities
    CATEGORY_PUNCTUALITY_WEIGHTS = {
        "VANDE_BHARAT": 5.0,
        "RAJDHANI_SHATABDI": 4.5,
        "SUPERFAST_EXPRESS": 3.0,
        "MAIL_EXPRESS": 2.2,
        "SUBURBAN_EMU": 4.0,
        "PASSENGER_ORDINARY": 1.5,
        "FREIGHT_CONTAINER": 1.2,
        "FREIGHT_BULK": 1.0,
    }

    def __init__(self, cascade_depth: int = 5, base_delay_per_conflict_min: float = 20.0):
        self.cascade_depth = cascade_depth
        self.base_delay_per_conflict_min = base_delay_per_conflict_min

    def estimate_train_delay(
        self,
        train_type: str,
        section_density_pct: float = 75.0,
        weather_factor: float = 1.0,
        has_speed_restriction: bool = False,
    ) -> float:
        """
        Estimates expected intrinsic arrival delay (minutes) for a train entering a section.
        """
        category_norm = train_type.upper().replace(" ", "_")
        weight = self.CATEGORY_PUNCTUALITY_WEIGHTS.get(category_norm, 2.0)

        # Baseline delay in Indian Railways operations
        base = 5.0 + (section_density_pct / 100.0) * 12.0
        if has_speed_restriction:
            base += 8.0

        # High priority trains get dispatch priority; lower priority trains absorbed in sidings
        if weight >= 4.0:
            expected_delay = base * 0.4 * weather_factor
        else:
            expected_delay = base * 1.2 * weather_factor

        return round(float(np.clip(expected_delay, 0.0, 180.0)), 1)

    def simulate_cascade_propagation(
        self,
        conflicting_trains: List[Dict[str, Any]],
        block_duration_minutes: int,
    ) -> Dict[str, Any]:
        """
        Simulates cascade ripple effect if conflicting trains are halted or regulated
        during a maintenance block.

        :param conflicting_trains: List of train dicts that overlap or queue behind block
        :param block_duration_minutes: Duration of track possession
        :return: Cascade analysis with total delayed trains, cumulative delay, and breakdown
        """
        if not conflicting_trains:
            return {
                "total_trains_delayed": 0,
                "cumulative_delay_minutes": 0.0,
                "weighted_punctuality_loss": 0.0,
                "cascade_trains": [],
                "preemption_risk_score": 0.0,
            }

        cumulative_delay = 0.0
        weighted_loss = 0.0
        train_delay_records: List[Dict[str, Any]] = []

        # Sort conflicting trains chronologically
        sorted_conflicts = sorted(
            conflicting_trains,
            key=lambda x: x.get("scheduled_time", x.get("entry_time", ""))
        )

        current_absorbed_delay = min(block_duration_minutes, 45.0)  # max regulation wait
        decay_factor = 0.65  # subsequent trains absorb part of delay in headway

        for i, train in enumerate(sorted_conflicts[: self.cascade_depth]):
            t_no = str(train.get("train_number", f"T_{i+1}"))
            t_type = str(train.get("train_type", "PASSENGER")).upper()
            punct_weight = self.CATEGORY_PUNCTUALITY_WEIGHTS.get(t_type, 2.0)

            # Individual train direct delay
            delay_mins = round(current_absorbed_delay * (decay_factor ** i), 1)
            cumulative_delay += delay_mins
            weighted_loss += delay_mins * punct_weight

            train_delay_records.append({
                "train_number": t_no,
                "train_type": t_type,
                "estimated_delay_minutes": delay_mins,
                "punctuality_weight": punct_weight,
                "regulation_location": "Preceding Junction Siding" if delay_mins > 20 else "Intermediate Loop",
            })

        # Calculate probability of block preemption by train control
        # High priority trains scheduled during or shortly after the block increase preemption risk
        premium_count = sum(
            1 for t in sorted_conflicts
            if self.CATEGORY_PUNCTUALITY_WEIGHTS.get(str(t.get("train_type", "")).upper(), 1.0) >= 4.0
        )
        preemption_risk = min(100.0, (premium_count * 35.0) + (len(sorted_conflicts) * 10.0))

        return {
            "total_trains_delayed": len(train_delay_records),
            "cumulative_delay_minutes": round(cumulative_delay, 1),
            "weighted_punctuality_loss": round(weighted_loss, 1),
            "cascade_trains": train_delay_records,
            "preemption_risk_score": round(preemption_risk, 1),
        }
