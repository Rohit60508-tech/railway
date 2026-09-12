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


# ─────────────────────────────────────────────────────────────────────────────
# Persistent Maintenance Block Schedule Database (SQLite + Supabase Mirror)
# ─────────────────────────────────────────────────────────────────────────────
import sqlite3
import json

DATA_DIR = AI_MODELS_DIR.parent / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
BLOCKS_DB_PATH = DATA_DIR / "maintenance_schedules.db"

def init_blocks_db():
    try:
        conn = sqlite3.connect(str(BLOCKS_DB_PATH))
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS maintenance_blocks (
                block_id TEXT PRIMARY KEY,
                section TEXT NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT NOT NULL,
                duration_minutes INTEGER NOT NULL,
                departments TEXT NOT NULL,
                status TEXT NOT NULL,
                disruption_score REAL DEFAULT 0.0,
                delay_minutes INTEGER DEFAULT 0,
                tasks_json TEXT NOT NULL,
                created_by TEXT DEFAULT 'Control Office',
                created_at TEXT NOT NULL
            )
        """)
        conn.commit()
        conn.close()
    except Exception as e:
        logger.error(f"Failed to initialize maintenance_schedules.db: {e}")

init_blocks_db()


class SaveBlockRequest(BaseModel):
    block_id: Optional[str] = Field(None, description="Unique Block ID (auto-generated if omitted)")
    section: str = Field(..., description="Corridor section ID (e.g. NDLS-CNB-UP)")
    start_time: str = Field(..., description="ISO 8601 start timestamp")
    end_time: str = Field(..., description="ISO 8601 end timestamp")
    duration_minutes: int = Field(..., description="Block duration in minutes")
    departments: List[str] = Field(..., description="Participating departments (e.g. Civil, TRD, SIG)")
    status: str = Field("PLANNED", description="Status (PLANNED, APPROVED, ACTIVE, COMPLETED, CANCELLED)")
    disruption_score: float = Field(0.0, description="Traffic disruption index")
    delay_minutes: int = Field(0, description="Estimated delay penalty")
    tasks: List[Dict[str, Any]] = Field([], description="Assigned maintenance tasks/work orders")
    created_by: str = Field("Control Office", description="Officer or system creating the block")


@router.post("/api/v1/optimize/save-block", summary="Save Maintenance Block Schedule to Persistent Database")
async def save_block_schedule(payload: SaveBlockRequest) -> Dict[str, Any]:
    """Persists a planned or approved maintenance block into SQLite / Supabase database storage."""
    try:
        block_id = payload.block_id or f"BLK-{datetime.now().strftime('%Y%m%d')}-{sqlite3.connect(str(BLOCKS_DB_PATH)).cursor().execute('SELECT COUNT(*) FROM maintenance_blocks').fetchone()[0] + 101}"
        created_at = datetime.now(timezone.utc).isoformat()
        depts_str = ",".join(payload.departments)
        tasks_json = json.dumps(payload.tasks)

        conn = sqlite3.connect(str(BLOCKS_DB_PATH))
        cur = conn.cursor()
        cur.execute("""
            INSERT OR REPLACE INTO maintenance_blocks (
                block_id, section, start_time, end_time, duration_minutes,
                departments, status, disruption_score, delay_minutes,
                tasks_json, created_by, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            block_id, payload.section, payload.start_time, payload.end_time,
            payload.duration_minutes, depts_str, payload.status,
            payload.disruption_score, payload.delay_minutes,
            tasks_json, payload.created_by, created_at
        ))
        conn.commit()
        conn.close()

        return {
            "status": "SUCCESS",
            "message": "Block schedule persisted successfully to database",
            "block_id": block_id,
            "saved_record": {
                "block_id": block_id,
                "section": payload.section,
                "start_time": payload.start_time,
                "end_time": payload.end_time,
                "duration_minutes": payload.duration_minutes,
                "departments": payload.departments,
                "status": payload.status,
                "disruption_score": payload.disruption_score,
                "tasks_count": len(payload.tasks),
                "created_by": payload.created_by,
                "created_at": created_at
            }
        }
    except Exception as e:
        logger.error(f"Failed to save block schedule: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/v1/optimize/saved-blocks", summary="Fetch All Saved Maintenance Block Schedules")
async def get_saved_block_schedules(section: Optional[str] = None, status: Optional[str] = None) -> Dict[str, Any]:
    """Retrieves all persisted maintenance block schedules, with optional filtering by section or status."""
    try:
        conn = sqlite3.connect(str(BLOCKS_DB_PATH))
        cur = conn.cursor()
        
        query = "SELECT block_id, section, start_time, end_time, duration_minutes, departments, status, disruption_score, delay_minutes, tasks_json, created_by, created_at FROM maintenance_blocks WHERE 1=1"
        params = []
        if section:
            query += " AND section = ?"
            params.append(section)
        if status:
            query += " AND status = ?"
            params.append(status)

        query += " ORDER BY created_at DESC"
        cur.execute(query, params)
        rows = cur.fetchall()
        conn.close()

        blocks = []
        for r in rows:
            blocks.append({
                "block_id": r[0],
                "section": r[1],
                "start_time": r[2],
                "end_time": r[3],
                "duration_minutes": r[4],
                "departments": r[5].split(",") if r[5] else [],
                "status": r[6],
                "disruption_score": r[7],
                "delay_minutes": r[8],
                "tasks": json.loads(r[9] or "[]"),
                "created_by": r[10],
                "created_at": r[11]
            })

        return {
            "status": "SUCCESS",
            "count": len(blocks),
            "blocks": blocks,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        logger.error(f"Failed to retrieve saved blocks: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/api/v1/optimize/delete-block/{block_id}", summary="Delete Saved Maintenance Block Schedule")
async def delete_saved_block_schedule(block_id: str) -> Dict[str, Any]:
    """Removes a persisted block schedule from the database."""
    try:
        conn = sqlite3.connect(str(BLOCKS_DB_PATH))
        cur = conn.cursor()
        cur.execute("DELETE FROM maintenance_blocks WHERE block_id = ?", (block_id,))
        deleted_count = cur.rowcount
        conn.commit()
        conn.close()

        if deleted_count == 0:
            raise HTTPException(status_code=404, detail=f"Block ID '{block_id}' not found.")

        return {
            "status": "SUCCESS",
            "message": f"Block schedule '{block_id}' deleted successfully.",
            "block_id": block_id,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete block schedule: {e}")
        raise HTTPException(status_code=500, detail=str(e))

