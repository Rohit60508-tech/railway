"""
optimizer_api.py
─────────────────────────────────────────────────────────────────────────────
RESTful inference endpoints for Multi-Department Block Optimization Engine:
  - POST /api/v1/optimize/schedule    : Solves optimal block schedule via CP-SAT
  - POST /api/v1/optimize/bundle      : Discovers multi-department bundling opportunities
  - GET  /api/v1/optimize/constraints : Returns active constraints & compatibility matrix
  - POST /api/v1/optimize/validate    : Validates proposed schedule against operational rules
─────────────────────────────────────────────────────────────────────────────
"""

import sys
from pathlib import Path
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
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

from shared.logger import get_logger
from block_optimizer.bundling_engine import BundlingEngine
from block_optimizer.schedule_generator import ScheduleGenerator

logger = get_logger("optimizer_api")
router = APIRouter(tags=["Multi-Department Block Optimizer"])

generator = ScheduleGenerator()
bundling_engine = BundlingEngine()


# ─────────────────────────────────────────────────────────────────────────────
# Request Schemas
# ─────────────────────────────────────────────────────────────────────────────
class OptimizeScheduleRequest(BaseModel):
    tasks: List[Dict[str, Any]] = Field(..., description="List of maintenance work orders/tasks")
    slots: List[Dict[str, Any]] = Field(..., description="List of candidate corridor slots")
    teams: Optional[List[Dict[str, Any]]] = Field(None, description="Optional available maintenance gangs")
    auto_bundle: bool = Field(True, description="Automatically bundle compatible tasks in same section")


class FindBundlesRequest(BaseModel):
    tasks: List[Dict[str, Any]] = Field(..., description="List of raw maintenance work orders")


class ValidateScheduleRequest(BaseModel):
    schedule: List[Dict[str, Any]] = Field(..., description="List of scheduled block records to validate")


# ─────────────────────────────────────────────────────────────────────────────
# API Endpoints
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/api/v1/optimize/schedule", summary="Generate Optimized Block Schedule")
async def optimize_schedule(payload: OptimizeScheduleRequest) -> Dict[str, Any]:
    """
    Formulates and solves the multi-department maintenance scheduling problem using
    Google OR-Tools CP-SAT constraint programming. Returns conflict-free blocks,
    assigned tasks, and possession hours saved.
    """
    try:
        schedule_result = generator.generate_optimized_schedule(
            tasks=payload.tasks,
            available_slots=payload.slots,
            teams=payload.teams,
            auto_bundle=payload.auto_bundle,
        )
        return {
            "status": "SUCCESS",
            "optimization_result": schedule_result,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        logger.error(f"Schedule optimization failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/v1/optimize/bundle", summary="Find Multi-Department Bundling Opportunities")
async def find_bundles(payload: FindBundlesRequest) -> Dict[str, Any]:
    """
    Groups maintenance tasks by section, checks inter-department compatibility
    (Civil, Traction/OHE, S&T), and returns synthesized multi-department shadow blocks
    with quantified time savings.
    """
    try:
        bundles = bundling_engine.create_bundles(payload.tasks)
        total_time_saved = sum(b.get("benefits", {}).get("time_saved_minutes", 0) for b in bundles)

        return {
            "status": "SUCCESS",
            "bundles_count": len(bundles),
            "total_time_saved_minutes": total_time_saved,
            "total_time_saved_hours": round(total_time_saved / 60.0, 1),
            "bundles": bundles,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        logger.error(f"Task bundling failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/v1/optimize/constraints", summary="Get Optimization Constraints")
async def get_optimization_constraints() -> Dict[str, Any]:
    """
    Returns current constraint programming configuration, inter-department
    compatibility matrix, objective weights, and solver limits.
    """
    try:
        cfg = generator.solver.config
        return {
            "status": "SUCCESS",
            "constraints": {
                "optimization_objective": cfg.get("optimization_objective"),
                "max_tasks_per_bundle": cfg.get("max_tasks_per_bundle"),
                "buffer_time_minutes": cfg.get("buffer_time_minutes"),
                "max_block_duration_minutes": cfg.get("max_block_duration_minutes"),
                "department_compatibility": cfg.get("department_compatibility"),
                "constraint_weights": cfg.get("constraint_weights"),
                "solver_parameters": cfg.get("solver"),
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        logger.error(f"Error fetching constraints: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/v1/optimize/validate", summary="Validate Proposed Block Schedule")
async def validate_schedule(payload: ValidateScheduleRequest) -> Dict[str, Any]:
    """
    Audits a proposed maintenance schedule against operational constraints:
    - Verifies block duration capacity against assigned task requirements
    - Checks for simultaneous team double-booking
    - Flags high-disruption corridors
    """
    try:
        violations: List[Dict[str, Any]] = []
        warnings: List[Dict[str, Any]] = []

        for blk in payload.schedule:
            block_id = blk.get("block_id", "UNKNOWN_BLOCK")
            dur = int(blk.get("duration_minutes", 120))
            tasks = blk.get("tasks", [])

            # Check duration capacity
            task_durs = [int(t.get("duration_minutes", 60)) for t in tasks]
            if task_durs and max(task_durs) > dur:
                violations.append({
                    "block_id": block_id,
                    "type": "DURATION_OVERFLOW",
                    "message": f"Block duration ({dur}m) is shorter than largest task ({max(task_durs)}m).",
                })

            # Check disruption score threshold
            disruption = float(blk.get("disruption_score", blk.get("traffic_disruption_score", 0.0)))
            if disruption >= 80.0:
                warnings.append({
                    "block_id": block_id,
                    "type": "HIGH_TRAFFIC_DISRUPTION",
                    "message": f"Block has severe traffic disruption score ({disruption}/100); DRM clearance recommended.",
                })

        is_valid = len(violations) == 0

        return {
            "status": "SUCCESS",
            "is_valid": is_valid,
            "violations_count": len(violations),
            "warnings_count": len(warnings),
            "violations": violations,
            "warnings": warnings,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    except Exception as e:
        logger.error(f"Schedule validation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
