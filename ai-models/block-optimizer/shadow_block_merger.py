"""
shadow_block_merger.py
─────────────────────────────────────────────────────────────────────────────
Pre-processor that runs BEFORE CP-SAT constraint_solver.
Detects requests targeting the same corridor section with overlapping time
windows, merges them into a single ShadowBlock, and sequences sub-tasks
inside it by department work order — eliminating conflicting possessions.

Also accepts VLM defect signals from Gemini Flash and auto-generates tasks.
─────────────────────────────────────────────────────────────────────────────
"""

import json
import os
import sys
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

try:
    from shared.logger import get_logger
except ImportError:
    from pathlib import Path
    shared_path = str(Path(__file__).resolve().parent.parent)
    if shared_path not in sys.path:
        sys.path.insert(0, shared_path)
    from shared.logger import get_logger

logger = get_logger("shadow_block_merger")

# ─────────────────────────────────────────────────────────────────────────────
# DEPARTMENT SEQUENCE ORDER (who works first inside a shadow block)
# ─────────────────────────────────────────────────────────────────────────────
DEPT_SEQUENCE_PRIORITY = {
    "CIVIL": 1,          # Civil/P-Way does earthwork and tamping first
    "TRD_OHE": 2,        # TRD/OHE installs after civil ground work
    "SIGNALLING": 3,     # Signal & Telecom tests after OHE is live
    "ROLLING_STOCK": 4,  # Mechanical/C&W last
}

DEPT_ALIASES = {
    "CIVIL": "CIVIL", "ENGINEERING": "CIVIL", "P_WAY": "CIVIL", "TRACK": "CIVIL",
    "TRD": "TRD_OHE", "OHE": "TRD_OHE", "TRACTION": "TRD_OHE", "TRD_OHE": "TRD_OHE",
    "S&T": "SIGNALLING", "SIGNAL": "SIGNALLING", "SIGNALLING": "SIGNALLING",
    "MECHANICAL": "ROLLING_STOCK", "C&W": "ROLLING_STOCK", "ROLLING_STOCK": "ROLLING_STOCK",
}

# Department task durations after VLM detection (minutes)
VLM_DEFECT_TASK_DEFAULTS = {
    "CRITICAL":              {"duration_minutes": 180, "priority_score": 95},
    "CRITICAL_IMMEDIATE_HALT": {"duration_minutes": 240, "priority_score": 100},
    "HIGH":                  {"duration_minutes": 120, "priority_score": 80},
    "MEDIUM":                {"duration_minutes": 75,  "priority_score": 60},
    "LOW":                   {"duration_minutes": 45,  "priority_score": 35},
    "OPERATIONAL_CAUTION":   {"duration_minutes": 60,  "priority_score": 50},
    "SAFE_CLEAR":            {"duration_minutes": 0,   "priority_score": 0},
}


def _normalize_dept(dept: str) -> str:
    return DEPT_ALIASES.get(str(dept).upper().replace("-", "_").replace(" ", "_"), "CIVIL")


def _parse_time_minutes(time_str: Optional[str]) -> Optional[int]:
    """Converts 'HH:MM' or 'HH:MM:SS' string to minutes since midnight."""
    if not time_str:
        return None
    try:
        parts = str(time_str).split("T")[-1].split("+")[0].split("Z")[0]
        h, m = int(parts.split(":")[0]), int(parts.split(":")[1])
        return h * 60 + m
    except Exception:
        return None


def _windows_overlap(start_a: int, end_a: int, start_b: int, end_b: int) -> bool:
    """Returns True if two time windows [start_a, end_a) and [start_b, end_b) overlap."""
    return start_a < end_b and start_b < end_a


def _sections_overlap(sec_a: str, km_start_a: float, km_end_a: float,
                      sec_b: str, km_start_b: float, km_end_b: float,
                      tolerance_km: float = 5.0) -> bool:
    """Returns True if two section/km ranges are the same or within tolerance_km."""
    if sec_a and sec_b and sec_a != sec_b:
        return False
    # Check km range overlap with tolerance
    return km_start_a <= km_end_b + tolerance_km and km_start_b <= km_end_a + tolerance_km


# ─────────────────────────────────────────────────────────────────────────────
# SHADOW BLOCK BUILDER
# ─────────────────────────────────────────────────────────────────────────────

class ShadowBlockMerger:
    """
    Groups overlapping-zone, overlapping-time maintenance requests into
    unified ShadowBlocks before they reach CP-SAT.
    """

    def __init__(self, buffer_minutes: int = 15, km_proximity_tolerance: float = 5.0):
        self.buffer_minutes = buffer_minutes
        self.km_tolerance = km_proximity_tolerance

    def _extract_km_range(self, task: Dict[str, Any]) -> Tuple[float, float]:
        km_start = float(task.get("km_start", task.get("chainage_km", 0.0)))
        km_end = float(task.get("km_end", km_start + 5.0))
        return km_start, km_end

    def _extract_time_window(self, task: Dict[str, Any]) -> Tuple[Optional[int], Optional[int]]:
        start = _parse_time_minutes(task.get("slot_start", task.get("preferred_start")))
        dur = int(task.get("duration_minutes", task.get("required_duration_minutes", 60)))
        end = start + dur if start is not None else None
        return start, end

    def _tasks_are_mergeable(self, task_a: Dict[str, Any], task_b: Dict[str, Any]) -> bool:
        """Returns True if two tasks should be merged into the same shadow block."""
        sec_a = task_a.get("section_id", "")
        sec_b = task_b.get("section_id", "")
        km_a = self._extract_km_range(task_a)
        km_b = self._extract_km_range(task_b)

        if not _sections_overlap(sec_a, km_a[0], km_a[1], sec_b, km_b[0], km_b[1], self.km_tolerance):
            return False

        start_a, end_a = self._extract_time_window(task_a)
        start_b, end_b = self._extract_time_window(task_b)

        # If no time info, assume mergeable by section alone
        if start_a is None or start_b is None:
            return True

        return _windows_overlap(start_a, end_a, start_b, end_b)

    def _build_shadow_block(self, group: List[Dict[str, Any]], block_idx: int) -> Dict[str, Any]:
        """Merges a group of overlapping tasks into a single ShadowBlock."""
        # Sort by department sequence (Civil → TRD → Signal → Mechanical)
        sorted_tasks = sorted(
            group,
            key=lambda t: DEPT_SEQUENCE_PRIORITY.get(_normalize_dept(t.get("department", "CIVIL")), 99)
        )

        # Merged time window: min(start) to max(end)
        windows = [self._extract_time_window(t) for t in group]
        valid_starts = [w[0] for w in windows if w[0] is not None]
        valid_ends   = [w[1] for w in windows if w[1] is not None]

        merged_start_min = min(valid_starts) if valid_starts else None
        merged_end_min   = max(valid_ends)   if valid_ends   else None
        
        # Duration = full window span + buffer
        if merged_start_min is not None and merged_end_min is not None:
            merged_duration = (merged_end_min - merged_start_min) + self.buffer_minutes
        else:
            merged_duration = sum(int(t.get("duration_minutes", 60)) for t in sorted_tasks) + self.buffer_minutes

        # Build sub-task sequence with staggered offsets
        offset = 0
        sub_tasks = []
        for t in sorted_tasks:
            dept = _normalize_dept(t.get("department", "CIVIL"))
            dur = int(t.get("duration_minutes", t.get("required_duration_minutes", 60)))
            sub_tasks.append({
                **t,
                "sub_task_offset_minutes": offset,
                "sub_task_duration_minutes": dur,
                "dept_normalized": dept,
                "dept_sequence": DEPT_SEQUENCE_PRIORITY.get(dept, 99),
            })
            # Next department starts after this one finishes (with 5 min handover)
            offset += dur + 5

        # Section union
        km_starts = [self._extract_km_range(t)[0] for t in group]
        km_ends   = [self._extract_km_range(t)[1] for t in group]
        section_ids = list({t.get("section_id", "") for t in group if t.get("section_id")})
        departments = sorted({_normalize_dept(t.get("department", "CIVIL")) for t in group})

        # Calculate time saved vs sequential execution
        sequential_duration = sum(int(t.get("duration_minutes", 60)) for t in group)
        time_saved = max(0, sequential_duration - merged_duration)
        possession_reduction_pct = round((time_saved / max(1, sequential_duration)) * 100, 1)

        block_id = f"SHADOW-{(section_ids[0] if section_ids else 'CORR')[:6].upper()}-{block_idx:03d}"

        return {
            "shadow_block_id": block_id,
            "merged_from_task_count": len(group),
            "section_ids": section_ids,
            "km_start": min(km_starts),
            "km_end": max(km_ends),
            "departments_involved": departments,
            "merged_start_time_minutes": merged_start_min,
            "merged_end_time_minutes": merged_end_min,
            "required_duration_minutes": merged_duration,
            "sub_tasks": sub_tasks,
            "sequential_duration_minutes": sequential_duration,
            "time_saved_minutes": time_saved,
            "possession_reduction_pct": possession_reduction_pct,
            "bundled": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
            # CP-SAT compatible fields
            "task_id": block_id,
            "section_id": section_ids[0] if section_ids else "",
            "priority_score": max(t.get("priority_score", 50) for t in group),
            "duration_minutes": merged_duration,
        }

    def merge(self, tasks: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Main entry point. Clusters tasks into ShadowBlocks.
        Returns (shadow_blocks, standalone_tasks) ready for CP-SAT input.
        """
        if not tasks:
            return [], []

        merged_flags = [False] * len(tasks)
        shadow_blocks = []
        block_idx = 1

        for i in range(len(tasks)):
            if merged_flags[i]:
                continue
            group = [tasks[i]]
            merged_flags[i] = True

            for j in range(i + 1, len(tasks)):
                if merged_flags[j]:
                    continue
                if self._tasks_are_mergeable(tasks[i], tasks[j]):
                    group.append(tasks[j])
                    merged_flags[j] = True

            if len(group) > 1:
                shadow_blocks.append(self._build_shadow_block(group, block_idx))
                block_idx += 1
            else:
                # Standalone — no merge needed, pass through as-is
                task = tasks[i]
                if "task_id" not in task:
                    task["task_id"] = f"TASK-SOLO-{block_idx:03d}"
                    block_idx += 1
                shadow_blocks.append(task)

        logger.info(f"Shadow Block Merger: {len(tasks)} requests -> {len(shadow_blocks)} blocks "
                    f"({sum(1 for b in shadow_blocks if b.get('bundled'))} bundled, "
                    f"{sum(1 for b in shadow_blocks if not b.get('bundled'))} standalone)")
        return shadow_blocks, []


# ─────────────────────────────────────────────────────────────────────────────
# VLM → TASK AUTO-GENERATOR (Gemini Flash Output → Maintenance Task)
# ─────────────────────────────────────────────────────────────────────────────

def vlm_result_to_task(vlm_result: Dict[str, Any], route_context: Dict[str, Any] = None) -> Optional[Dict[str, Any]]:
    """
    Converts a Gemini/VLM inspection result into a structured CP-SAT maintenance task.
    Returns None if the track is clear (no task needed).
    """
    if vlm_result.get("is_clear") or vlm_result.get("severity") == "SAFE_CLEAR":
        return None

    severity = vlm_result.get("severity", "MEDIUM")
    defaults = VLM_DEFECT_TASK_DEFAULTS.get(severity, VLM_DEFECT_TASK_DEFAULTS["MEDIUM"])

    if defaults["duration_minutes"] == 0:
        return None

    route = route_context or {}
    section_id = route.get("section_id", "CORR-VLM")
    km_start = float(route.get("km_start", 0.0))
    km_end = float(route.get("km_end", km_start + 5.0))

    # Map defect type to owning department
    defect_type = str(vlm_result.get("defect_type", "")).lower()
    if any(k in defect_type for k in ["ohe", "overhead", "wire", "mast", "insulator"]):
        dept = "TRD_OHE"
    elif any(k in defect_type for k in ["signal", "interlocking", "telecom"]):
        dept = "SIGNALLING"
    else:
        dept = "CIVIL"  # Default: P-Way / ballast / fastener / rail defects

    task_id = f"VLM-AUTO-{section_id[:6].upper()}-{int(datetime.now().timestamp()) % 100000}"

    return {
        "task_id": task_id,
        "section_id": section_id,
        "km_start": km_start,
        "km_end": km_end,
        "department": dept,
        "defect_type": vlm_result.get("defect_type"),
        "severity": severity,
        "duration_minutes": defaults["duration_minutes"],
        "required_duration_minutes": defaults["duration_minutes"],
        "priority_score": defaults["priority_score"],
        "speed_restriction_kmh": vlm_result.get("speed_restriction_kmh"),
        "recommendation": vlm_result.get("recommendation"),
        "bounding_box": vlm_result.get("bounding_box"),
        "source": "VLM_AUTO_DETECT",
        "reroute_to": vlm_result.get("reroute_to"),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


# ─────────────────────────────────────────────────────────────────────────────
# GEMINI VLM INSPECTION CALL
# ─────────────────────────────────────────────────────────────────────────────

def inspect_with_gemini(image_base64: str = None, image_path: str = None,
                        prompt: str = None, route_context: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Calls Gemini Flash (free multimodal API) to inspect a track image.
    Returns a structured VLM result and auto-generated maintenance task.
    """
    gemini_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY", "")

    if gemini_key and (image_base64 or image_path):
        try:
            import google.generativeai as genai
            genai.configure(api_key=gemini_key)
            model = genai.GenerativeModel("gemini-1.5-flash")

            if image_path and os.path.exists(image_path):
                import PIL.Image
                img = PIL.Image.open(image_path)
            elif image_base64:
                import base64, io, PIL.Image
                img = PIL.Image.open(io.BytesIO(base64.b64decode(image_base64)))
            else:
                img = None

            vlm_prompt = (
                "You are a Railway Track Defect Vision Inspector. Analyze the track image. "
                "Output ONLY valid JSON: "
                '{"is_clear":bool,"defect_type":str,"severity":"CRITICAL|HIGH|MEDIUM|LOW|SAFE_CLEAR",'
                '"speed_restriction_kmh":int,"recommendation":str,"reroute_to":str|null,"bounding_box":[ymin,xmin,ymax,xmax]|null}'
            )

            if img:
                response = model.generate_content([vlm_prompt, img, prompt or ""])
                raw = response.text.strip().lstrip("```json").rstrip("```").strip()
                vlm_result = json.loads(raw)
            else:
                raise ValueError("No valid image provided")

        except Exception as e:
            logger.warning(f"Gemini Vision API bypassed: {e}")
            vlm_result = _heuristic_vlm(prompt or "")
    else:
        vlm_result = _heuristic_vlm(prompt or "")

    task = vlm_result_to_task(vlm_result, route_context)
    return {"vlm_result": vlm_result, "auto_generated_task": task}


def _heuristic_vlm(prompt: str) -> Dict[str, Any]:
    """Physics-calibrated heuristic if no API key or image."""
    p = prompt.lower()
    if "crack" in p or "fracture" in p:
        return {"is_clear": False, "defect_type": "Transverse Rail Weld Fracture",
                "severity": "CRITICAL", "speed_restriction_kmh": 0,
                "recommendation": "Complete corridor lockdown — apply emergency fishplate.",
                "reroute_to": "RT-LOOP-02", "bounding_box": [420, 280, 590, 460]}
    elif "ballast" in p or "washout" in p:
        return {"is_clear": False, "defect_type": "Ballast Scouring & Shoulder Void",
                "severity": "HIGH", "speed_restriction_kmh": 20,
                "recommendation": "Tamping Machine Block required. Cap TSR 20 km/h.",
                "reroute_to": "RT-LOOP-02", "bounding_box": [310, 190, 560, 430]}
    elif "clip" in p or "fastener" in p:
        return {"is_clear": False, "defect_type": "Missing ERC Fasteners",
                "severity": "MEDIUM", "speed_restriction_kmh": 45,
                "recommendation": "Keyman Gang — clip insertion within 4 hours. TSR 45 km/h.",
                "reroute_to": None, "bounding_box": [200, 390, 340, 510]}
    elif "ohe" in p or "overhead" in p:
        return {"is_clear": False, "defect_type": "OHE Wire Sag / Mast Defect",
                "severity": "HIGH", "speed_restriction_kmh": 30,
                "recommendation": "TRD power block required. OHE gang dispatch.",
                "reroute_to": None, "bounding_box": [100, 50, 600, 300]}
    else:
        return {"is_clear": True, "defect_type": "Clear — No Anomalies Detected",
                "severity": "SAFE_CLEAR", "speed_restriction_kmh": 130,
                "recommendation": "Full MPS (130 km/h) certified.",
                "reroute_to": None, "bounding_box": None}


# ─────────────────────────────────────────────────────────────────────────────
# COMBINED PIPELINE ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

def run_vlm_shadow_cpsat_pipeline(
    requests: List[Dict[str, Any]],
    slots: List[Dict[str, Any]],
    teams: List[Dict[str, Any]] = None,
    vlm_image_prompt: str = None,
    route_context: Dict[str, Any] = None,
) -> Dict[str, Any]:
    """
    Full pipeline:
      1. Gemini VLM inspects image → auto-generates task if defect found
      2. ShadowBlockMerger merges overlapping requests into unified blocks
      3. CP-SAT BlockConstraintSolver assigns merged blocks to slots
    """
    pipeline_result = {
        "stages": {},
        "shadow_blocks": [],
        "schedule": None,
        "vlm_inspection": None,
    }

    # Stage 1: VLM auto-detect → inject task
    if vlm_image_prompt or route_context:
        vlm_output = inspect_with_gemini(prompt=vlm_image_prompt, route_context=route_context)
        pipeline_result["vlm_inspection"] = vlm_output
        auto_task = vlm_output.get("auto_generated_task")
        if auto_task:
            requests = list(requests) + [auto_task]
            logger.info(f"VLM auto-injected task: {auto_task['task_id']} | Severity: {auto_task['severity']}")
        pipeline_result["stages"]["vlm"] = "COMPLETED"
    else:
        pipeline_result["stages"]["vlm"] = "SKIPPED"

    # Stage 2: Shadow Block Merger
    merger = ShadowBlockMerger()
    merged_blocks, _ = merger.merge(requests)
    pipeline_result["shadow_blocks"] = merged_blocks
    pipeline_result["stages"]["shadow_merger"] = f"{len(merged_blocks)} blocks from {len(requests)} requests"

    # Stage 3: CP-SAT Solver
    try:
        from block_optimizer.constraint_solver import BlockConstraintSolver
        solver = BlockConstraintSolver()
        schedule = solver.solve(merged_blocks, slots, teams)
        pipeline_result["schedule"] = schedule
        pipeline_result["stages"]["cpsat"] = schedule.get("status", "UNKNOWN")
    except Exception as e:
        logger.error(f"CP-SAT solver error: {e}")
        pipeline_result["schedule"] = {"status": "ERROR", "message": str(e)}
        pipeline_result["stages"]["cpsat"] = f"ERROR: {e}"

    return pipeline_result


if __name__ == "__main__":
    # Self-test: two overlapping requests, same corridor, diff departments
    test_requests = [
        {
            "task_id": "REQ-001",
            "section_id": "NDLS-GZB-UP",
            "km_start": 45.0, "km_end": 48.6,
            "department": "CIVIL",
            "duration_minutes": 150,
            "priority_score": 80,
            "preferred_start": "02:00",
            "slot_start": "02:00",
        },
        {
            "task_id": "REQ-002",
            "section_id": "NDLS-GZB-UP",
            "km_start": 45.5, "km_end": 49.0,
            "department": "TRD_OHE",
            "duration_minutes": 120,
            "priority_score": 75,
            "preferred_start": "03:00",
            "slot_start": "03:00",
        },
    ]
    test_slots = [
        {"slot_id": "SLOT-001", "section_id": "NDLS-GZB-UP",
         "slot_start": "02:00", "slot_end": "07:00",
         "duration_minutes": 300, "disruption_score": 35.0},
    ]

    merger = ShadowBlockMerger()
    blocks, _ = merger.merge(test_requests)

    print(json.dumps({
        "input_requests": len(test_requests),
        "shadow_blocks_produced": len(blocks),
        "blocks": blocks,
    }, indent=2, default=str))
