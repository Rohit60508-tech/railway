"""
live_train_api.py
─────────────────────────────────────────────────────────────────────────────
REST endpoints for Live Train Tracking & Station Movement Integration
Using RapidAPI IRCTC Endpoints & COA Real-Time Feed.
─────────────────────────────────────────────────────────────────────────────
"""

import os
import sys
from pathlib import Path
from typing import Any, Dict, Optional
from fastapi import APIRouter, HTTPException, Query, Path as FPath
from pydantic import BaseModel, Field

MODULE_DIR = Path(__file__).resolve().parent
AI_MODELS_DIR = MODULE_DIR.parent
if str(AI_MODELS_DIR) not in sys.path:
    sys.path.insert(0, str(AI_MODELS_DIR))

from shared.logger import get_logger
from traffic_predictor.live_train_service import live_train_service

logger = get_logger("live_train_api")
router = APIRouter(prefix="/api/v1", tags=["Live Train Movement & Tracking (IRCTC / RapidAPI)"])


class CorridorConflictRequest(BaseModel):
    section_id: str = Field(default="NDLS-CNB-UP", description="Railway section (e.g. NDLS-CNB-UP)")
    start_time: str = Field(..., description="Proposed start timestamp (ISO)")
    duration_minutes: int = Field(default=120, ge=30, le=480, description="Possession duration")
    station_from: Optional[str] = Field(default="ALJN", description="Nearest Station 1 (e.g. ALJN)")
    station_to: Optional[str] = Field(default="TDL", description="Nearest Station 2 (e.g. TDL)")
    start_km: Optional[float] = Field(default=142.5, description="Work location Start KM")
    end_km: Optional[float] = Field(default=145.8, description="Work location End KM")
    km_pole: Optional[str] = Field(default="142/10 – 145/20", description="KM pole number or OHE mast span")


@router.get(
    "/live-trains-at-station/{station_code}",
    summary="Get Live Trains Passing Station (RapidAPI / IRCTC)",
    description="Fetch all live train movements passing through or arriving at a specific station/location within the next X hours.",
)
def get_live_trains_by_location(
    station_code: str = FPath(..., description="Station Code (e.g., 'NDLS', 'CNB', 'PRYJ')"),
    hours: int = Query(default=2, ge=1, le=12, description="Time window in hours"),
) -> Dict[str, Any]:
    """Queries live station arrivals/departures from RapidAPI or fallback simulator."""
    try:
        data = live_train_service.get_live_trains_at_station(station_code, hours=hours)
        return data
    except Exception as e:
        logger.error(f"Error querying station {station_code}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch live movement: {str(e)}")


@router.get(
    "/live-running-status/{train_number}",
    summary="Get Real-Time Train Running Status",
    description="Query live GPS running status, current station delay, and location along the track corridor.",
)
def get_live_train_status(
    train_number: str = FPath(..., description="Train number (e.g. 22436, 12004, 12302)"),
    date: Optional[str] = Query(None, description="Date of journey (YYYY-MM-DD)"),
) -> Dict[str, Any]:
    """Queries current location and running delay for a specific train."""
    try:
        data = live_train_service.get_live_running_status(train_number, date=date)
        return data
    except Exception as e:
        logger.error(f"Error querying train {train_number}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch train status: {str(e)}")


@router.post(
    "/live-corridor-conflicts",
    summary="Evaluate Live Train Conflicts with Maintenance Block",
    description="Cross-references live train positions against a proposed maintenance block window and exact 2-station / KM pole location.",
)
def evaluate_corridor_conflicts(req: CorridorConflictRequest) -> Dict[str, Any]:
    """Evaluates live train timetable conflicts for a proposed block possession."""
    try:
        result = live_train_service.check_corridor_conflicts(
            section_id=req.section_id,
            start_time=req.start_time,
            duration_minutes=req.duration_minutes,
            station_from=req.station_from,
            station_to=req.station_to,
            start_km=req.start_km,
            end_km=req.end_km,
            km_pole=req.km_pole,
        )
        return {
            "status": "SUCCESS",
            **result,
        }
    except Exception as e:
        logger.error(f"Error checking corridor conflicts for {req.section_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/live-weather/{station_code}",
    summary="Get Real-Time Weather & Rail Temperature (OpenWeatherMap)",
    description="Fetch live ambient weather, rail surface temperature, track buckling risk (IRPWM Para 602), and fog alerts.",
)
def get_live_station_weather(
    station_code: str = FPath(..., description="Station Code (e.g. NDLS, CNB, PRYJ)"),
) -> Dict[str, Any]:
    """Queries live weather and computes track thermal buckling safety."""
    try:
        return live_train_service.get_live_weather(station_code)
    except Exception as e:
        logger.error(f"Error querying weather for station {station_code}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get(
    "/gateway-config",
    summary="Inspect Active RapidAPI Gateway Configuration",
)
def get_gateway_config() -> Dict[str, Any]:
    """Returns active provider and masked API key info for verification."""
    masked_key = (
        live_train_service.api_key[:6] + "..." + live_train_service.api_key[-4:]
        if len(live_train_service.api_key) > 10
        else "NOT_CONFIGURED"
    )
    masked_weather = (
        live_train_service.weather_key[:6] + "..." + live_train_service.weather_key[-4:]
        if len(live_train_service.weather_key) > 10
        else "NOT_CONFIGURED"
    )
    return {
        "status": "CONFIGURED",
        "provider": "RapidAPI Indian Railways / IRCTC",
        "rapidapi_host": live_train_service.host,
        "masked_api_key": masked_key,
        "weather_provider": "OpenWeatherMap API",
        "masked_weather_key": masked_weather,
        "gis_provider": "Mapbox GL JS",
        "backup_source": "Centre for Railway Information Systems (CRIS) / COA",
        "supported_stations": ["NDLS", "CNB", "PRYJ", "DLI", "GZB", "ALD", "BSB", "HWH"],
    }


@router.get("/mapbox-token", summary="Get Public Mapbox Token from Environment")
def get_mapbox_token() -> Dict[str, str]:
    """Returns public mapbox access token configured in environment."""
    return {"token": os.getenv("MAPBOX_ACCESS_TOKEN", "")}

