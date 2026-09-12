"""
ollama_api.py
─────────────────────────────────────────────────────────────────────────────
FastAPI router for Ollama LLM Services & Defect Detection Seed Converter
─────────────────────────────────────────────────────────────────────────────
Endpoints:
  - GET  /api/v1/ollama/status           : Health, connection, & model inventory
  - POST /api/v1/ollama/convert-seeds    : Execute seed file conversion
  - POST /api/v1/ollama/detect-defect    : Live AI text/telemetry defect classification
  - GET  /api/v1/ollama/converted-seeds  : Retrieve converted seed records
─────────────────────────────────────────────────────────────────────────────
"""

import os
import sys
import json
from pathlib import Path
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from pydantic import BaseModel, Field

MODULE_DIR = Path(__file__).resolve().parent
AI_MODELS_DIR = MODULE_DIR.parent
WORKSPACE_DIR = AI_MODELS_DIR.parent
CONVERTED_SEEDS_DIR = WORKSPACE_DIR / "data" / "converted_seeds"

if str(AI_MODELS_DIR) not in sys.path:
    sys.path.insert(0, str(AI_MODELS_DIR))

from shared.logger import get_logger
from seeds.ollama_converter import (
    convert_all_seeds,
    get_ollama_client,
    get_defect_rules,
    save_defect_rules,
    process_custom_import,
    OLLAMA_HOST,
    OLLAMA_MODEL,
)

logger = get_logger("ollama_api")
router = APIRouter(prefix="/api/v1/ollama", tags=["Ollama LLM Defect Detection & Seeds"])


class DefectDetectionRequest(BaseModel):
    raw_text: str = Field(..., description="Field inspector note, patrol log, or sensor output")
    asset_type: Optional[str] = Field(default="Rail Track", description="Asset type")
    detection_source: Optional[str] = Field(default="Keyman Patrol", description="USFD, TRC, OMS, ITMS, Patrol")
    section_id: Optional[str] = Field(default="NDLS-CNB-UP", description="Railway Section ID")
    km_location: Optional[float] = Field(default=120.5, description="Track kilometer location")


class CustomSeedImportRequest(BaseModel):
    records: List[Dict[str, Any]] = Field(..., description="List of raw defect records (CSV rows or JSON)")
    append_to_seeds: Optional[bool] = Field(default=True, description="Append to database seeds register")
    recalculate_manifest: Optional[bool] = Field(default=True, description="Update conversion manifest")


class DefectRulesUpdateRequest(BaseModel):
    severity_weights: Optional[Dict[str, int]] = None
    priority_thresholds: Optional[Dict[str, float]] = None
    weights: Optional[Dict[str, float]] = None
    default_tsr_limits: Optional[Dict[str, Optional[int]]] = None
    trigger_reconversion: Optional[bool] = False


@router.get("/status")
def get_ollama_status() -> Dict[str, Any]:
    """Check Ollama service status, connectivity, and available models."""
    client = get_ollama_client()
    is_online = client is not None
    models_list = []
    
    if is_online:
        try:
            res = client.list()
            # res has models
            models_list = [m.model for m in res.models] if hasattr(res, 'models') else []
        except Exception as err:
            logger.warning(f"Failed to list Ollama models: {err}")

    manifest_file = CONVERTED_SEEDS_DIR / "conversion_manifest.json"
    last_conversion = None
    if manifest_file.exists():
        try:
            with open(manifest_file, "r", encoding="utf-8") as f:
                last_conversion = json.load(f)
        except Exception:
            pass

    return {
        "status": "ONLINE" if is_online else "OFFLINE",
        "service": "Ollama LLM Engine",
        "host": OLLAMA_HOST,
        "default_model": OLLAMA_MODEL,
        "available_models": models_list,
        "last_seed_conversion": last_conversion
    }


@router.post("/convert-seeds")
def trigger_seed_conversion(background_tasks: BackgroundTasks) -> Dict[str, Any]:
    """Execute complete seed file conversion across all CSV database seeds."""
    try:
        manifest = convert_all_seeds(verbose=False)
        return {
            "message": "Seed files converted successfully!",
            "manifest": manifest
        }
    except Exception as exc:
        logger.error(f"Error during seed conversion: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))


@router.get("/converted-seeds")
def get_converted_seeds(
    category: str = Query("defects", description="Category: defects or assets"),
    department: Optional[str] = Query(None, description="CIVIL, S&T, TRD_OHE"),
    limit: int = Query(50, ge=1, le=500)
) -> Dict[str, Any]:
    """Retrieve converted seed records."""
    file_target = CONVERTED_SEEDS_DIR / f"{category}_converted.json"
    if not file_target.exists():
        # Auto-run if not yet run
        convert_all_seeds(verbose=False)

    if not file_target.exists():
        return {"data": [], "count": 0}

    with open(file_target, "r", encoding="utf-8") as f:
        items = json.load(f)

    if department:
        items = [item for item in items if item.get("department") == department.upper()]

    return {
        "category": category,
        "count": len(items),
        "data": items[:limit]
    }


@router.post("/detect-defect")
def detect_defect_with_llm(payload: DefectDetectionRequest) -> Dict[str, Any]:
    """Live XGBoost + Statutory Policy RAG defect detection and classification (No LLM)."""
    priority_engine_dir = AI_MODELS_DIR / "priority-engine"
    if str(priority_engine_dir) not in sys.path:
        sys.path.insert(0, str(priority_engine_dir))
    from xgboost_policy_learner import xgboost_learner

    text = payload.raw_text

    # Default heuristic diagnosis
    severity = "MEDIUM"
    if any(w in text.lower() for w in ["crack", "fracture", "broken", "severe", "imr", "critical"]):
        severity = "HIGH"
    elif any(w in text.lower() for w in ["loss", "dropped", "snap", "derail"]):
        severity = "CRITICAL"
    elif any(w in text.lower() for w in ["minor", "loose", "dirty", "check"]):
        severity = "LOW"

    est_duration = 120 if severity in ["HIGH", "CRITICAL"] else 60

    # Execute Self-Learned XGBoost + Policy RAG
    rag_result = xgboost_learner.classify_with_policy_rag({
        "raw_text": text,
        "defect_type": payload.asset_type,
        "detection_source": payload.detection_source,
        "severity_score": 90.0 if severity == "CRITICAL" else (70.0 if severity == "HIGH" else 40.0),
        "line_speed_kmh": 130.0,
        "oms_peak_g": 0.40 if "oms" in text.lower() else 0.20
    })

    return {
        "input_text": text,
        "asset_type": payload.asset_type,
        "detection_source": payload.detection_source,
        "section_id": payload.section_id,
        "km_location": payload.km_location,
        "inferred_severity": severity,
        "priority_category": rag_result["priority"],
        "priority_label": rag_result["priority_label"],
        "estimated_duration_minutes": est_duration,
        "recommended_tsr_kmh": rag_result["statutory_policy_rag"]["recommended_tsr_kmh"],
        "statutory_policy_rag": rag_result["statutory_policy_rag"],
        "feature_contributions": rag_result["feature_contributions"],
        "ai_engine": "XGBoost 3.4.1 + Statutory Policy RAG (Self-Learning)"
    }


@router.get("/rules")
@router.get("/defect-rules")
def get_rules() -> Dict[str, Any]:
    """Retrieve active defect classification rules, scoring weights, and priority thresholds."""
    return get_defect_rules()


@router.post("/rules")
@router.post("/defect-rules")
def update_rules(payload: DefectRulesUpdateRequest) -> Dict[str, Any]:
    """
    Priority classification is strictly governed by AI model training data.
    Direct manual user priority threshold modification is prohibited to maintain safety integrity.
    """
    if payload.priority_thresholds is not None or payload.weights is not None:
        logger.warning("Direct manual priority alteration blocked: priority is strictly calibrated by AI model training data.")
        return {
            "status": "LOCKED",
            "message": "Manual priority threshold alteration is prohibited. Priority classifications (P1–P4) are strictly calibrated by the AI Model based on training data. Please use /api/v1/ollama/custom-seed-import to provide training data.",
            "rules": get_defect_rules()
        }

    updates = {}
    if payload.severity_weights is not None:
        updates["severity_weights"] = payload.severity_weights
    if payload.default_tsr_limits is not None:
        updates["default_tsr_limits"] = payload.default_tsr_limits

    saved = save_defect_rules(updates) if updates else get_defect_rules()

    manifest = None
    if payload.trigger_reconversion:
        manifest = convert_all_seeds(verbose=False)

    return {
        "status": "SUCCESS",
        "message": "Priority boundaries remain governed by AI Model training data.",
        "rules": saved,
        "reconversion_manifest": manifest
    }


@router.post("/custom-seed-import")
def import_custom_seed_records(payload: CustomSeedImportRequest) -> Dict[str, Any]:
    """
    Import custom defect records, apply XGBoost classification,
    and persist into the active database seeds register.
    """
    priority_engine_dir = AI_MODELS_DIR / "priority-engine"
    if str(priority_engine_dir) not in sys.path:
        sys.path.insert(0, str(priority_engine_dir))
    from xgboost_policy_learner import xgboost_learner

    if not payload.records:
        raise HTTPException(status_code=400, detail="No defect records provided in payload.")

    result = process_custom_import(
        raw_records=payload.records,
        append_to_seeds=payload.append_to_seeds
    )

    # Fit XGBoost to user's custom records
    fit_result = xgboost_learner.fit_to_rules(get_defect_rules(), user_training_data=payload.records)

    if payload.recalculate_manifest:
        pass
        # Re-save manifest with updated count
        manifest_file = CONVERTED_SEEDS_DIR / "conversion_manifest.json"
        if manifest_file.exists():
            try:
                with open(manifest_file, "r", encoding="utf-8") as f:
                    m = json.load(f)
                m["total_defects"] += result["processed_count"]
                with open(manifest_file, "w", encoding="utf-8") as f:
                    json.dump(m, f, indent=2)
            except Exception:
                pass

    return result

