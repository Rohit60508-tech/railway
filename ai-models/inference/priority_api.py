"""
priority_api.py
─────────────────────────────────────────────────────────────────────────────
RESTful inference endpoints for Indian Railways Defect Prioritization Engine:
  - POST /api/v1/prioritize/defect : Scores and classifies an individual defect
  - POST /api/v1/prioritize/batch  : Ranks multiple defects with explainability
  - GET  /api/v1/priority/model-info: Returns model architecture & performance
  - POST /api/v1/priority/retrain  : Triggers background model retraining
─────────────────────────────────────────────────────────────────────────────
"""

import sys
from pathlib import Path
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field

# Resolve paths and bootstrap hyphenated packages
MODULE_DIR = Path(__file__).resolve().parent
AI_MODELS_DIR = MODULE_DIR.parent
if str(AI_MODELS_DIR) not in sys.path:
    sys.path.insert(0, str(AI_MODELS_DIR))
try:
    from inference import _bootstrap
except ImportError:
    import _bootstrap

# Subsystem imports
from shared.logger import get_logger
from priority_engine.model_loader import model_loader
from training.train_priority_model import train_priority_model

logger = get_logger("priority_api")
router = APIRouter(tags=["Defect Priority Engine"])


# ─────────────────────────────────────────────────────────────────────────────
# Request / Response Schemas
# ─────────────────────────────────────────────────────────────────────────────
class DefectPrioritizeRequest(BaseModel):
    defect_id: str = Field(..., description="Unique defect identifier")
    section_id: str = Field(..., description="Railway section identifier")
    department: str = Field(..., description="CIVIL, TRD_OHE, SIGNALLING, ROLLING_STOCK")
    asset_type: str = Field("RAIL_THERMIT_WELD", description="Asset type")
    severity: str = Field("HIGH", description="CRITICAL, HIGH, MEDIUM, LOW")
    source: str = Field("USFD", description="USFD, TRC, OMS, ITMS, PATROL, MANUAL")
    sla_deadline: Optional[str] = Field(None, description="Mandatory deadline ISO timestamp")
    detected_at: Optional[str] = Field(None, description="Initial detection ISO timestamp")
    track_quality_index: Optional[float] = Field(None, description="TQI score (0-100)")
    trains_per_day: Optional[float] = Field(None, description="Daily train density")
    track_count: Optional[int] = Field(2, description="Track count (1=single, 2=double)")
    overdue_days: Optional[float] = Field(0.0, description="Days overdue past SLA")
    location_criticality: Optional[float] = Field(50.0, description="Location risk factor (0-100)")
    speed_restriction_kmh: Optional[int] = Field(None, description="Speed restriction imposed (km/h)")
    failure_probability: Optional[float] = Field(None, description="Predicted failure risk")


class DefectBatchRequest(BaseModel):
    defects: List[DefectPrioritizeRequest]
    sort_by_priority: bool = Field(True, description="Sort descending by priority score")


class RetrainRequest(BaseModel):
    samples: int = Field(3000, description="Training sample volume", ge=200, le=20000)
    model_type: str = Field("RandomForest", description="RandomForest or GradientBoosting")


# ─────────────────────────────────────────────────────────────────────────────
# API Endpoints
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/api/v1/prioritize/defect", summary="Prioritize Single Defect")
async def prioritize_defect(payload: DefectPrioritizeRequest) -> Dict[str, Any]:
    """
    Evaluates an individual track defect against 10 operational risk factors,
    calculates composite priority score (0-100), assigns P1-P4 category, and returns
    structured explainability highlights.
    """
    try:
        data = payload.model_dump()
        result = model_loader.predict_priority(data)
        return {
            "status": "SUCCESS",
            "data": result,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        logger.error(f"Failed to prioritize defect {payload.defect_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/v1/prioritize/batch", summary="Prioritize Multiple Defects")
async def prioritize_batch(payload: DefectBatchRequest) -> Dict[str, Any]:
    """
    Batches multiple defect records, generates normalized features, executes inference,
    and returns defects ranked from highest safety risk (P1) to routine maintenance (P4).
    """
    try:
        raw_items = [d.model_dump() for d in payload.defects]
        ranked_results = model_loader.predict_batch(raw_items, sort_by_priority=payload.sort_by_priority)
        return {
            "status": "SUCCESS",
            "total_defects": len(ranked_results),
            "p1_count": sum(1 for r in ranked_results if r.get("priority_category") == "P1"),
            "p2_count": sum(1 for r in ranked_results if r.get("priority_category") == "P2"),
            "p3_count": sum(1 for r in ranked_results if r.get("priority_category") == "P3"),
            "p4_count": sum(1 for r in ranked_results if r.get("priority_category") == "P4"),
            "ranked_defects": ranked_results,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        logger.error(f"Batch prioritization failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/v1/priority/model-info", summary="Get Model Information")
async def get_model_info() -> Dict[str, Any]:
    """
    Returns active priority model metadata, feature weights, accuracy, and active inference mode.
    """
    try:
        meta = model_loader.get_metadata()
        return {
            "status": "SUCCESS",
            "model_info": meta,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        logger.error(f"Error fetching model info: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/v1/priority/retrain", summary="Trigger Model Retraining")
async def trigger_retraining(payload: RetrainRequest, background_tasks: BackgroundTasks) -> Dict[str, Any]:
    """
    Initiates asynchronous model retraining on updated database records,
    re-evaluates performance, and hot-reloads the in-memory inference pipeline.
    """
    def _background_retrain(samples: int, mtype: str):
        try:
            logger.info(f"Background retraining started (samples={samples}, type={mtype})...")
            train_priority_model(model_type=mtype, samples=samples)
            model_loader.reload()
            logger.info("Background retraining and model reload completed successfully.")
        except Exception as err:
            logger.error(f"Background retraining failed: {err}")

    background_tasks.add_task(_background_retrain, payload.samples, payload.model_type)

    return {
        "status": "ACCEPTED",
        "message": f"Retraining task queued in background with {payload.samples} samples ({payload.model_type}).",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
