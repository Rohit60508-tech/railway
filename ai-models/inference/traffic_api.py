"""
traffic_api.py
─────────────────────────────────────────────────────────────────────────────
RESTful inference endpoints for Indian Railways Traffic & Corridor Predictor:
  - GET /api/v1/traffic/occupancy/{section_id}            : Section volume & occupancy
  - GET /api/v1/traffic/slots/{section_id}                : Discovered corridor slots
  - GET /api/v1/traffic/best-slots/{section_id}/{duration}: Top 10 recommended block slots
  - GET /api/v1/traffic/forecast/{section_id}/{date}      : Hourly traffic projection
─────────────────────────────────────────────────────────────────────────────
"""

import sys
from pathlib import Path
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, HTTPException, Query, Path as FPath

# Resolve paths and bootstrap hyphenated packages
MODULE_DIR = Path(__file__).resolve().parent
AI_MODELS_DIR = MODULE_DIR.parent
if str(AI_MODELS_DIR) not in sys.path:
    sys.path.insert(0, str(AI_MODELS_DIR))
try:
    from inference import _bootstrap
except ImportError:
    import _bootstrap

from shared.logger import get_logger
from shared.utils import coerce_iso_date
from traffic_predictor.traffic_analyzer import TrafficAnalyzer
from traffic_predictor.forecast_engine import ForecastEngine

logger = get_logger("traffic_api")
router = APIRouter(tags=["Traffic & Corridor Predictor"])

# Cached analyzers
analyzer = TrafficAnalyzer()
forecast_engine = ForecastEngine()


# ─────────────────────────────────────────────────────────────────────────────
# API Endpoints
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/api/v1/traffic/occupancy/{section_id}", summary="Get Section Occupancy")
async def get_section_occupancy(
    section_id: str = FPath(..., description="Railway section identifier"),
    start_time: Optional[str] = Query(None, description="Start timestamp (ISO)"),
    end_time: Optional[str] = Query(None, description="End timestamp (ISO)"),
) -> Dict[str, Any]:
    """
    Calculates sectional train volume and track occupancy percentage for the specified time window.
    """
    try:
        now = datetime.now(timezone.utc)
        s_dt = coerce_iso_date(start_time) or now
        e_dt = coerce_iso_date(end_time) or (s_dt + timedelta(hours=4))

        data = analyzer.calculate_section_occupancy(section_id, s_dt, e_dt)
        return {
            "status": "SUCCESS",
            "section_id": section_id,
            "occupancy_data": data,
            "timestamp": now.isoformat(),
        }
    except Exception as e:
        logger.error(f"Error getting occupancy for {section_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/v1/traffic/slots/{section_id}", summary="Get Available Corridor Slots")
async def get_available_slots(
    section_id: str = FPath(..., description="Railway section identifier"),
    search_start: Optional[str] = Query(None, description="Search start ISO timestamp"),
    search_end: Optional[str] = Query(None, description="Search end ISO timestamp"),
    duration_minutes: int = Query(120, description="Required block duration in minutes", ge=30, le=480),
) -> Dict[str, Any]:
    """
    Scans sectional timetable for unobstructed headway intervals and returns
    discretized 15-minute maintenance slots.
    """
    try:
        now = datetime.now(timezone.utc)
        s_start = coerce_iso_date(search_start) or now
        s_end = coerce_iso_date(search_end) or (s_start + timedelta(days=2))

        slots = analyzer.find_available_corridor_slots(
            section_id=section_id,
            search_start=s_start,
            search_end=s_end,
            required_duration_minutes=duration_minutes,
        )

        return {
            "status": "SUCCESS",
            "section_id": section_id,
            "duration_requested_minutes": duration_minutes,
            "slots_count": len(slots),
            "slots": slots,
            "timestamp": now.isoformat(),
        }
    except Exception as e:
        logger.error(f"Error fetching slots for {section_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/v1/traffic/best-slots/{section_id}/{duration}", summary="Get Best Maintenance Slots")
async def get_best_slots(
    section_id: str = FPath(..., description="Railway section identifier"),
    duration: int = FPath(..., description="Required block duration in minutes"),
    search_start: Optional[str] = Query(None, description="Search start ISO timestamp"),
    search_end: Optional[str] = Query(None, description="Search end ISO timestamp"),
    top_k: int = Query(10, description="Number of top slots to return", ge=1, le=25),
) -> Dict[str, Any]:
    """
    Evaluates candidate time slots against cascade train disruption, timetable conflicts,
    and diurnal preferences, returning the top 10 recommended slots.
    """
    try:
        now = datetime.now(timezone.utc)
        s_start = coerce_iso_date(search_start) or now
        s_end = coerce_iso_date(search_end) or (s_start + timedelta(days=3))

        best = analyzer.predict_best_slots(
            section_id=section_id,
            search_start=s_start,
            search_end=s_end,
            duration_minutes=duration,
            top_k=top_k,
        )

        return {
            "status": "SUCCESS",
            "section_id": section_id,
            "duration_minutes": duration,
            "slots_returned": len(best),
            "best_slots": best,
            "timestamp": now.isoformat(),
        }
    except Exception as e:
        logger.error(f"Error finding best slots for {section_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/v1/traffic/forecast/{section_id}/{date}", summary="Get Traffic Forecast")
async def get_traffic_forecast(
    section_id: str = FPath(..., description="Railway section identifier"),
    date: str = FPath(..., description="Target date (YYYY-MM-DD)"),
    horizon_hours: int = Query(24, description="Forecast horizon in hours", ge=6, le=168),
) -> Dict[str, Any]:
    """
    Generates hourly projected train traffic density with 90% confidence intervals
    and freight demand estimates.
    """
    try:
        target_dt = coerce_iso_date(f"{date}T00:00:00Z") or datetime.now(timezone.utc)

        df_forecast = forecast_engine.generate_hourly_forecast(
            section_id=section_id,
            start_time=target_dt,
            horizon_hours=horizon_hours,
        )
        goods_forecast = analyzer.get_goods_forecast_impact(section_id, target_dt, days=min(7, horizon_hours // 24 + 1))

        return {
            "status": "SUCCESS",
            "section_id": section_id,
            "date": date,
            "horizon_hours": horizon_hours,
            "hourly_projection": df_forecast.to_dict(orient="records"),
            "freight_summary": {
                "total_projected_rakes": goods_forecast.get("total_projected_rakes"),
                "average_daily_rakes": goods_forecast.get("average_daily_rakes"),
                "controller_insights": goods_forecast.get("controller_insights"),
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        logger.error(f"Error generating traffic forecast for {section_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
