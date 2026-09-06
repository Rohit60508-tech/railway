"""
traffic_analyzer.py
─────────────────────────────────────────────────────────────────────────────
TrafficAnalyzer: Core traffic analytics and block impact engine for Indian Railways.
Computes section occupancy, detects timetable conflicts, evaluates cascade delays,
discretizes corridor slots at 15-minute granularity, and predicts the top 10
optimal maintenance windows with complete operational explainability.
─────────────────────────────────────────────────────────────────────────────
"""

import os
import sys
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import numpy as np
import pandas as pd

# Support both package imports and standalone imports
try:
    from shared.logger import get_logger
    from shared.database_connector import db_pool
    from shared.utils import coerce_iso_date
except ImportError:
    shared_path = str(Path(__file__).resolve().parent.parent)
    if shared_path not in sys.path:
        sys.path.insert(0, shared_path)
    from shared.logger import get_logger
    from shared.database_connector import db_pool
    from shared.utils import coerce_iso_date

from corridor_availability import CorridorAvailabilityCalculator
from delay_predictor import DelayPredictor
from forecast_engine import ForecastEngine

logger = get_logger("traffic_analyzer")

CONFIG_PATH = Path(__file__).resolve().parent / "config.json"


class TrafficAnalyzer:
    """
    Evaluates railway section occupancy, detects train conflicts, scores traffic
    disruption, and discovers the optimal maintenance block windows.
    """

    def __init__(self, config_path: Optional[Union[str, Path]] = None):
        self.config_path = Path(config_path) if config_path else CONFIG_PATH
        self.config = self._load_config()

        self.granularity_min = int(self.config.get("time_slot_granularity_minutes", 15))
        self.search_horizon_days = int(self.config.get("search_horizon_days", 7))
        self.max_conflicts = int(self.config.get("max_conflicts_allowed", 2))
        self.impact_weights = self.config.get("traffic_impact_weights", {})
        self.time_prefs = self.config.get("time_preferences", {})
        self.feasibility_thresholds = self.config.get("feasibility_thresholds", {})

        # Internal helper subcomponents
        self.corridor_calc = CorridorAvailabilityCalculator(
            granularity_minutes=self.granularity_min,
            min_headway_buffer_minutes=15,
            clearing_time_minutes=10,
        )
        self.delay_pred = DelayPredictor()
        self.forecast_eng = ForecastEngine()

        self._timetable_cache: Dict[str, List[Dict[str, Any]]] = {}

    def _load_config(self) -> Dict[str, Any]:
        """Loads configuration from config.json with robust fallback defaults."""
        if self.config_path.exists():
            try:
                with open(self.config_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Error loading traffic-predictor config: {e}")
        return {
            "time_slot_granularity_minutes": 15,
            "search_horizon_days": 7,
            "max_conflicts_allowed": 2,
            "traffic_impact_weights": {
                "passenger_express": 3.5,
                "passenger_ordinary": 2.0,
                "freight_goods": 1.2,
                "suburban_emu": 4.0,
                "train_count_weight": 0.35,
                "delay_minutes_weight": 0.35,
                "punctuality_loss_weight": 0.30,
            },
            "time_preferences": {
                "night_bonus": 0.25,
                "evening_bonus": 0.10,
                "day_penalty": 0.35,
                "preferred_night_start_hour": 23,
                "preferred_night_end_hour": 5,
                "afternoon_lull_start_hour": 12,
                "afternoon_lull_end_hour": 15,
            },
        }

    # ─────────────────────────────────────────────────────────────────────────
    # Timetable & Goods Forecast Ingestion
    # ─────────────────────────────────────────────────────────────────────────
    def load_timetable_from_db(
        self,
        section_id: str,
        start_time: datetime,
        end_time: datetime,
    ) -> List[Dict[str, Any]]:
        """
        Loads train schedule movements for a section from PostgreSQL.
        Falls back to generating realistic synthetic timetable if DB is offline.
        """
        s_dt = coerce_iso_date(start_time) or datetime.now(timezone.utc)
        e_dt = coerce_iso_date(end_time) or (s_dt + timedelta(days=2))
        cache_key = f"{section_id}_{s_dt.strftime('%Y%m%d%H%M')}_{e_dt.strftime('%Y%m%d%H%M')}"
        if cache_key in self._timetable_cache:
            return self._timetable_cache[cache_key]

        query = """
            SELECT 
                train_number, train_name, train_type, origin, destination,
                entry_time, exit_time, direction, is_regular
            FROM train_timetables
            WHERE section_id = %s
              AND entry_time <= %s
              AND exit_time >= %s
            ORDER BY entry_time ASC;
        """
        try:
            records = db_pool.execute_query(query, (section_id, e_dt.isoformat(), s_dt.isoformat()))
            if records and len(records) > 0:
                logger.info(f"Loaded {len(records)} timetable entries from DB for {section_id}.")
                self._timetable_cache[cache_key] = records
                return records
        except Exception as e:
            logger.debug(f"DB timetable query for {section_id} inactive ({e}). Using synthetic schedule.")

        synthetic = self.generate_synthetic_timetable(section_id, s_dt, e_dt)
        self._timetable_cache[cache_key] = synthetic
        return synthetic

    def generate_synthetic_timetable(
        self,
        section_id: str,
        start_time: datetime,
        end_time: datetime,
    ) -> List[Dict[str, Any]]:
        """
        Generates realistic scheduled train movements adhering to IR traffic patterns.
        """
        start_time = coerce_iso_date(start_time) or datetime.now(timezone.utc)
        end_time = coerce_iso_date(end_time) or (start_time + timedelta(days=2))

        # Sample Indian Railways train templates
        train_catalog = [
            ("12301", "Howrah Rajdhani", "RAJDHANI_SHATABDI", "UP", 35),
            ("22436", "Vande Bharat Express", "VANDE_BHARAT", "DN", 30),
            ("12417", "Prayagraj Express", "SUPERFAST_EXPRESS", "UP", 40),
            ("12555", "Gorakhdham Express", "SUPERFAST_EXPRESS", "DN", 42),
            ("14217", "Unchahar Express", "MAIL_EXPRESS", "UP", 48),
            ("64583", "CNB-DLI MEMU Commuter", "SUBURBAN_EMU", "UP", 55),
            ("BOXN-C1", "Coal Rake Bulk Freight", "FREIGHT_BULK", "DN", 65),
            ("CONCOR-X4", "Container Freight", "FREIGHT_CONTAINER", "UP", 60),
            ("BCN-F9", "Foodgrain Freight", "FREIGHT_BULK", "DN", 70),
        ]

        total_hours = max(1.0, (end_time - start_time).total_seconds() / 3600.0)
        num_trains = int(total_hours * 3.5)  # Average ~3.5 trains/hour on double track

        events: List[Dict[str, Any]] = []
        step_minutes = (total_hours * 60.0) / max(1, num_trains)

        for i in range(num_trains):
            offset_min = i * step_minutes + np.random.uniform(-10.0, 10.0)
            entry_dt = start_time + timedelta(minutes=max(0.0, offset_min))
            if entry_dt >= end_time:
                break

            template = train_catalog[i % len(train_catalog)]
            run_duration = template[4] + np.random.randint(-5, 8)
            exit_dt = entry_dt + timedelta(minutes=run_duration)

            events.append({
                "train_number": f"{template[0]}_{i//len(train_catalog)}",
                "train_name": template[1],
                "train_type": template[2],
                "direction": template[3],
                "entry_time": entry_dt.isoformat(),
                "exit_time": exit_dt.isoformat(),
                "section_id": section_id,
                "duration_minutes": run_duration,
            })

        events.sort(key=lambda x: x["entry_time"])
        return events

    # ─────────────────────────────────────────────────────────────────────────
    # Occupancy & Conflict Detection
    # ─────────────────────────────────────────────────────────────────────────
    def calculate_section_occupancy(
        self,
        section_id: str,
        start_time: datetime,
        end_time: datetime,
    ) -> Dict[str, Any]:
        """
        Calculates sectional train volume and occupancy percentage for a given window.
        """
        start_dt = coerce_iso_date(start_time) or datetime.now(timezone.utc)
        end_dt = coerce_iso_date(end_time) or (start_dt + timedelta(hours=4))
        window_duration_min = (end_dt - start_dt).total_seconds() / 60.0

        timetable = self.load_timetable_from_db(section_id, start_dt, end_dt)

        occupying_trains: List[Dict[str, Any]] = []
        total_train_minutes = 0.0

        for t in timetable:
            entry = coerce_iso_date(t["entry_time"])
            exit_ = coerce_iso_date(t["exit_time"])
            if entry and exit_:
                overlap_start = max(start_dt, entry)
                overlap_end = min(end_dt, exit_)
                if overlap_end > overlap_start:
                    overlap_duration = (overlap_end - overlap_start).total_seconds() / 60.0
                    total_train_minutes += overlap_duration
                    occupying_trains.append(t)

        occupancy_ratio = total_train_minutes / max(1.0, window_duration_min)
        occupancy_pct = min(100.0, round(occupancy_ratio * 100.0, 1))

        return {
            "section_id": section_id,
            "start_time": start_dt.isoformat(),
            "end_time": end_dt.isoformat(),
            "window_duration_minutes": int(window_duration_min),
            "occupancy_percentage": occupancy_pct,
            "trains_count": len(occupying_trains),
            "passenger_trains_count": sum(1 for t in occupying_trains if "FREIGHT" not in t["train_type"]),
            "freight_trains_count": sum(1 for t in occupying_trains if "FREIGHT" in t["train_type"]),
            "trains": occupying_trains,
        }

    def identify_train_conflicts(
        self,
        section_id: str,
        proposed_start: datetime,
        proposed_end: datetime,
        timetable: Optional[List[Dict[str, Any]]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Identifies all scheduled trains that overlap or conflict with the proposed block time.
        """
        p_start = coerce_iso_date(proposed_start)
        p_end = coerce_iso_date(proposed_end)
        tt = timetable if timetable is not None else self.load_timetable_from_db(section_id, p_start, p_end)

        conflicts: List[Dict[str, Any]] = []
        for t in tt:
            t_entry = coerce_iso_date(t["entry_time"])
            t_exit = coerce_iso_date(t["exit_time"])
            if t_entry and t_exit:
                if t_exit > p_start and t_entry < p_end:
                    # Overlap detected
                    overlap_minutes = int((min(p_end, t_exit) - max(p_start, t_entry)).total_seconds() / 60.0)
                    conflicts.append({
                        "train_number": t["train_number"],
                        "train_name": t.get("train_name", ""),
                        "train_type": t["train_type"],
                        "direction": t.get("direction", "UP"),
                        "scheduled_entry": t["entry_time"],
                        "scheduled_exit": t["exit_time"],
                        "overlap_minutes": overlap_minutes,
                    })

        return conflicts

    # ─────────────────────────────────────────────────────────────────────────
    # Traffic Impact Scoring
    # ─────────────────────────────────────────────────────────────────────────
    def calculate_traffic_impact_score(
        self,
        conflicting_trains: List[Dict[str, Any]],
        block_duration_minutes: int,
    ) -> Dict[str, Any]:
        """
        Calculates comprehensive traffic impact score (0.0 to 100.0) based on
        train counts, categories, and cascade delay simulation.
        """
        if not conflicting_trains:
            return {
                "impact_score": 0.0,
                "conflicts_count": 0,
                "cascade_delay": {"total_trains_delayed": 0, "cumulative_delay_minutes": 0.0},
                "category_breakdown": {},
                "summary": "Zero traffic impact: Track is completely clear.",
            }

        num_conflicts = len(conflicting_trains)
        cascade = self.delay_pred.simulate_cascade_propagation(conflicting_trains, block_duration_minutes)

        # Category multiplier sum
        category_points = 0.0
        cat_counts: Dict[str, int] = {}
        for t in conflicting_trains:
            c_type = t.get("train_type", "PASSENGER")
            cat_counts[c_type] = cat_counts.get(c_type, 0) + 1
            weight = self.delay_pred.CATEGORY_PUNCTUALITY_WEIGHTS.get(c_type, 2.0)
            category_points += weight * 12.0

        # Component contributions
        count_component = min(40.0, num_conflicts * 12.0)
        delay_component = min(40.0, (cascade["cumulative_delay_minutes"] / 120.0) * 40.0)
        severity_component = min(30.0, category_points * 0.4)

        raw_score = count_component + delay_component + severity_component
        impact_score = round(float(np.clip(raw_score, 0.0, 100.0)), 2)

        return {
            "impact_score": impact_score,
            "conflicts_count": num_conflicts,
            "cascade_delay": cascade,
            "category_breakdown": cat_counts,
            "summary": (
                f"Impact score {impact_score}/100: {num_conflicts} conflicting trains, "
                f"~{cascade['cumulative_delay_minutes']} cumulative delay minutes."
            ),
        }

    # ─────────────────────────────────────────────────────────────────────────
    # Corridor Slot Discovery & Scoring
    # ─────────────────────────────────────────────────────────────────────────
    def find_available_corridor_slots(
        self,
        section_id: str,
        search_start: datetime,
        search_end: datetime,
        required_duration_minutes: int = 120,
    ) -> List[Dict[str, Any]]:
        """
        Discovers open intervals and discretizes them into 15-minute granularity slots.
        """
        s_start = coerce_iso_date(search_start)
        s_end = coerce_iso_date(search_end)

        timetable = self.load_timetable_from_db(section_id, s_start, s_end)
        open_intervals = self.corridor_calc.calculate_open_intervals(
            timetable, s_start, s_end, min_duration_minutes=required_duration_minutes
        )

        all_slots: List[Dict[str, Any]] = []
        for interval in open_intervals:
            slots = self.corridor_calc.discretize_slots(interval, required_duration_minutes)
            all_slots.extend(slots)

        return all_slots

    def score_slot(
        self,
        section_id: str,
        slot: Dict[str, Any],
        duration_minutes: int = 120,
        timetable: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        Evaluates a candidate time slot against traffic impact, conflicts, and time preferences.
        """
        s_start: datetime = slot["slot_start"]
        s_end: datetime = slot["slot_end"]

        conflicts = self.identify_train_conflicts(section_id, s_start, s_end, timetable=timetable)
        impact_data = self.calculate_traffic_impact_score(conflicts, duration_minutes)
        base_impact = impact_data["impact_score"]

        # Time-of-day preferences
        hour = s_start.hour
        night_start = int(self.time_prefs.get("preferred_night_start_hour", 23))
        night_end = int(self.time_prefs.get("preferred_night_end_hour", 5))
        lull_start = int(self.time_prefs.get("afternoon_lull_start_hour", 12))
        lull_end = int(self.time_prefs.get("afternoon_lull_end_hour", 15))

        preference_adjustment = 0.0
        time_tag = "DAY_STANDARD"

        if (hour >= night_start) or (hour <= night_end):
            # Deep night corridor (optimal for civil/OHE blocks)
            preference_adjustment = -float(self.time_prefs.get("night_bonus", 0.25)) * 40.0
            time_tag = "NIGHT_SHADOW_CORRIDOR"
        elif lull_start <= hour <= lull_end:
            # Midday passenger lull
            preference_adjustment = -float(self.time_prefs.get("evening_bonus", 0.10)) * 25.0
            time_tag = "AFTERNOON_LULL"
        elif (7 <= hour <= 10) or (17 <= hour <= 20):
            # Peak business / office commuter hours
            preference_adjustment = float(self.time_prefs.get("day_penalty", 0.35)) * 35.0
            time_tag = "PEAK_COMMUTER_PENALTY"

        # Final slot score (Lower is better: represents disruption penalty)
        adjusted_score = max(0.0, min(100.0, base_impact + preference_adjustment))

        # Determine Feasibility Tier
        if adjusted_score <= 30.0 and len(conflicts) <= 0:
            feasibility = "HIGH_FEASIBILITY"
            feasibility_label = "Ideal Maintenance Window"
        elif adjusted_score <= 60.0 and len(conflicts) <= self.max_conflicts:
            feasibility = "MODERATE_FEASIBILITY"
            feasibility_label = "Viable with Train Regulation"
        elif adjusted_score <= 85.0:
            feasibility = "LOW_FEASIBILITY"
            feasibility_label = "Severe Disruption / DRM Approval Required"
        else:
            feasibility = "INFEASIBLE"
            feasibility_label = "Impermissible / Corridor Choke"

        return {
            "slot_start": s_start.isoformat(),
            "slot_end": s_end.isoformat(),
            "duration_minutes": duration_minutes,
            "disruption_score": round(adjusted_score, 2),
            "feasibility": feasibility,
            "feasibility_label": feasibility_label,
            "time_window_type": time_tag,
            "conflicts_count": len(conflicts),
            "conflicts": conflicts,
            "traffic_impact": impact_data,
            "leading_slack_minutes": slot.get("leading_slack_minutes", 0),
            "trailing_slack_minutes": slot.get("trailing_slack_minutes", 0),
        }

    # ─────────────────────────────────────────────────────────────────────────
    # Best Slot Prediction (Top 10)
    # ─────────────────────────────────────────────────────────────────────────
    def predict_best_slots(
        self,
        section_id: str,
        search_start: datetime,
        search_end: datetime,
        duration_minutes: int = 120,
        top_k: int = 10,
    ) -> List[Dict[str, Any]]:
        """
        Discovers all candidate slots in the search horizon, evaluates each slot,
        and returns the top 10 ranked by lowest disruption score.
        """
        s_start = coerce_iso_date(search_start) or datetime.now(timezone.utc)
        s_end = coerce_iso_date(search_end) or (s_start + timedelta(days=self.search_horizon_days))

        logger.info(
            f"Searching best maintenance slots for {section_id} from {s_start.strftime('%Y-%m-%d %H:%M')} "
            f"to {s_end.strftime('%Y-%m-%d %H:%M')} (duration: {duration_minutes}m)..."
        )

        # Preload timetable once for entire search horizon
        horizon_timetable = self.load_timetable_from_db(section_id, s_start, s_end)

        candidate_slots = self.find_available_corridor_slots(
            section_id, s_start, s_end, required_duration_minutes=duration_minutes
        )

        # If zero completely clear slots are found, fall back to sliding windows across the horizon
        if not candidate_slots:
            logger.info("No completely clear intervals found. Evaluating regulated sliding windows...")
            step_td = timedelta(minutes=self.granularity_min)
            req_td = timedelta(minutes=duration_minutes)
            curr = s_start
            while curr + req_td <= s_end:
                candidate_slots.append({
                    "slot_start": curr,
                    "slot_end": curr + req_td,
                    "leading_slack_minutes": 0,
                    "trailing_slack_minutes": 0,
                })
                curr += step_td

        # Score all candidate slots using preloaded timetable
        scored_slots = [
            self.score_slot(section_id, slot, duration_minutes, timetable=horizon_timetable)
            for slot in candidate_slots
        ]

        # Rank: Lowest disruption score first, then lowest conflicts, then highest slack
        scored_slots.sort(key=lambda x: (
            x["disruption_score"],
            x["conflicts_count"],
            -x["leading_slack_minutes"]
        ))

        # Filter duplicates that start at identical times
        unique_slots: List[Dict[str, Any]] = []
        seen_starts = set()
        for s in scored_slots:
            if s["slot_start"] not in seen_starts:
                seen_starts.add(s["slot_start"])
                unique_slots.append(s)
            if len(unique_slots) >= top_k:
                break

        logger.info(f"Identified {len(unique_slots)} top recommended maintenance slots for {section_id}.")
        return unique_slots

    # ─────────────────────────────────────────────────────────────────────────
    # Goods Forecast Impact
    # ─────────────────────────────────────────────────────────────────────────
    def get_goods_forecast_impact(
        self,
        section_id: str,
        start_time: datetime,
        days: int = 7,
    ) -> Dict[str, Any]:
        """
        Retrieves goods train demand projection and analyzes its impact on maintenance.
        """
        goods_forecast = self.forecast_eng.get_goods_forecast(section_id, start_time, days=days)
        total_rakes = goods_forecast["total_projected_rakes"]
        avg_daily_rakes = total_rakes / max(1, days)

        # Operational insights for Section Controller
        insights: List[str] = []
        if avg_daily_rakes > 30:
            insights.append("Heavy bulk freight corridor. Coordinated staging at Marshalling Yard required during blocks.")
        else:
            insights.append("Nominal freight volume. Freight paths can be held in siding loops without major line chokes.")

        insights.append("Preferred freight dispatch aligns with deep night shadow windows (23:00 - 04:00).")

        return {
            "section_id": section_id,
            "horizon_days": days,
            "average_daily_rakes": round(avg_daily_rakes, 1),
            "total_projected_rakes": total_rakes,
            "daily_forecasts": goods_forecast["daily_forecasts"],
            "controller_insights": insights,
        }
