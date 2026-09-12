"""
forecast_engine.py
─────────────────────────────────────────────────────────────────────────────
ForecastEngine: Forecasts sectional train density, passenger traffic volume,
and freight flow using historical diurnal curves and weekly seasonality patterns.
Provides 90% confidence intervals for robust block window planning.
─────────────────────────────────────────────────────────────────────────────
"""

from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
import numpy as np
import pandas as pd

from shared.logger import get_logger
from shared.utils import coerce_iso_date

logger = get_logger("forecast_engine")


class ForecastEngine:
    """
    Generates temporal traffic forecasts capturing diurnal curves, day-of-week
    cycles, and freight rake movement patterns along Indian Railways corridors.
    """

    # Baseline hourly traffic factors (summing across typical Indian Railways 24-hr cycle)
    # Troughs at 01:00-04:00 (0.25 - 0.35) and 12:00-14:00 (0.60)
    # Peaks at 08:00-10:00 (1.45) and 17:00-20:00 (1.50)
    DIURNAL_HOURLY_FACTORS = [
        0.35, 0.25, 0.20, 0.25, 0.45, 0.70,   # 00:00 - 05:00 (Deep night lull)
        1.10, 1.45, 1.50, 1.35, 1.10, 0.85,   # 06:00 - 11:00 (Morning peak)
        0.65, 0.60, 0.75, 0.95, 1.20, 1.45,   # 12:00 - 17:00 (Midday lull to evening build)
        1.55, 1.40, 1.25, 1.05, 0.75, 0.50    # 18:00 - 23:00 (Evening peak to night)
    ]

    DAY_OF_WEEK_FACTORS = {
        0: 1.12,  # Monday (commuter surge)
        1: 1.02,  # Tuesday
        2: 0.98,  # Wednesday
        3: 1.00,  # Thursday
        4: 1.15,  # Friday (weekend travel departure surge)
        5: 0.95,  # Saturday (freight dominant)
        6: 0.90,  # Sunday (lower suburban, high long-distance)
    }

    def __init__(self, confidence_interval_pct: float = 90.0):
        self.confidence_interval_pct = confidence_interval_pct
        # Z-score for 90% two-tailed is ~1.645
        self.z_score = 1.645 if confidence_interval_pct >= 90.0 else 1.28

    def generate_hourly_forecast(
        self,
        section_id: str,
        start_time: datetime,
        horizon_hours: int = 48,
        base_trains_per_day: float = 80.0,
        goods_train_ratio: float = 0.35,
    ) -> pd.DataFrame:
        """
        Projects hourly train traffic for the requested horizon.

        :param section_id: Section identifier (e.g. "NDLS-CNB-UP")
        :param start_time: Starting timestamp
        :param horizon_hours: Projection horizon in hours (6 to 168)
        :param base_trains_per_day: Average daily sectional train throughput
        :param goods_train_ratio: Proportion of freight vs passenger traffic
        :return: DataFrame with hourly forecasts and confidence intervals
        """
        start_time = coerce_iso_date(start_time) or datetime.now(timezone.utc)
        start_hour_floor = start_time.replace(minute=0, second=0, microsecond=0)

        records: List[Dict[str, Any]] = []
        base_hourly_mean = base_trains_per_day / 24.0

        for h in range(horizon_hours):
            target_dt = start_hour_floor + timedelta(hours=h)
            hour_of_day = target_dt.hour
            weekday = target_dt.weekday()

            diurnal_mult = self.DIURNAL_HOURLY_FACTORS[hour_of_day]
            dow_mult = self.DAY_OF_WEEK_FACTORS.get(weekday, 1.0)

            # Expected passenger vs freight trains
            expected_total = base_hourly_mean * diurnal_mult * dow_mult
            expected_freight = expected_total * goods_train_ratio
            expected_passenger = expected_total - expected_freight

            # Standard deviation for stochastic variation
            std_dev = max(0.4, np.sqrt(expected_total) * 0.55)
            ci_lower = max(0.0, expected_total - self.z_score * std_dev)
            ci_upper = expected_total + self.z_score * std_dev

            records.append({
                "timestamp": target_dt.isoformat(),
                "hour_offset": h,
                "hour_of_day": hour_of_day,
                "weekday": weekday,
                "expected_trains": round(float(expected_total), 2),
                "expected_passenger": round(float(expected_passenger), 2),
                "expected_freight": round(float(expected_freight), 2),
                "ci_lower_90": round(float(ci_lower), 2),
                "ci_upper_90": round(float(ci_upper), 2),
                "is_night_shadow_window": (23 <= hour_of_day or hour_of_day <= 5),
                "is_afternoon_lull": (12 <= hour_of_day <= 15),
            })

        df = pd.DataFrame(records)
        return df

    def get_goods_forecast(
        self,
        section_id: str,
        start_time: datetime,
        days: int = 7,
        avg_freight_rakes_per_day: int = 28,
    ) -> Dict[str, Any]:
        """
        Generates daily freight loading and goods train path demand forecast.
        """
        start_time = coerce_iso_date(start_time) or datetime.now(timezone.utc)
        daily_forecasts: List[Dict[str, Any]] = []

        commodities = ["COAL_THERMAL", "CONTAINER_EXIM", "CEMENT", "FOODGRAIN", "STEEL"]
        commodity_distribution = [0.45, 0.20, 0.15, 0.10, 0.10]

        for d in range(days):
            day_dt = start_time + timedelta(days=d)
            dow = day_dt.weekday()
            # Freight often surges on weekends when passenger trains have slightly fewer business runs
            day_multiplier = 1.15 if dow in (5, 6) else 0.95
            rakes_today = int(round(avg_freight_rakes_per_day * day_multiplier))

            commodity_breakdown = {
                comm: int(round(rakes_today * share))
                for comm, share in zip(commodities, commodity_distribution)
            }

            daily_forecasts.append({
                "date": day_dt.strftime("%Y-%m-%d"),
                "day_name": day_dt.strftime("%A"),
                "total_freight_rakes": rakes_today,
                "commodity_breakdown": commodity_breakdown,
                "preferred_dispatch_hours": [23, 0, 1, 2, 3, 13, 14],
            })

        return {
            "section_id": section_id,
            "forecast_horizon_days": days,
            "total_projected_rakes": sum(x["total_freight_rakes"] for x in daily_forecasts),
            "daily_forecasts": daily_forecasts,
        }
