"""
python_runner.py
─────────────────────────────────────────────────────────────────────────────
CLI bridge script for executing Python AI models from Node.js child processes.
Supports direct execution of:
  - DefectPrioritizer (single & batch scoring)
  - TrafficAnalyzer (occupancy, slot discovery, top best slots, delay predictions)
  - BlockConstraintSolver & BundlingEngine (OR-Tools schedule optimization)
─────────────────────────────────────────────────────────────────────────────
"""

import os
import sys
import json
import argparse
from pathlib import Path
from datetime import datetime, timezone

os.environ["LOG_LEVEL"] = "ERROR"
os.environ["PYTHONIOENCODING"] = "utf-8"

import importlib.util

# Resolve paths to ai-models directory
SCRIPT_DIR = Path(__file__).resolve().parent
WORKSPACE_DIR = SCRIPT_DIR.parents[2]  # python-bridge -> services -> backend -> indian-railways-ai
AI_MODELS_DIR = WORKSPACE_DIR / "ai-models"

for p in [WORKSPACE_DIR, AI_MODELS_DIR]:
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

# Register hyphenated packages in ai-models
for pkg_name, folder_name in [
    ("priority_engine", "priority-engine"),
    ("traffic_predictor", "traffic-predictor"),
    ("block_optimizer", "block-optimizer"),
    ("training", "training"),
    ("shared", "shared"),
    ("inference", "inference"),
]:
    pkg_path = AI_MODELS_DIR / folder_name
    if pkg_path.exists():
        if str(pkg_path) not in sys.path:
            sys.path.insert(0, str(pkg_path))
        init_file = pkg_path / "__init__.py"
        if pkg_name not in sys.modules and init_file.exists():
            spec = importlib.util.spec_from_file_location(
                pkg_name,
                str(init_file),
                submodule_search_locations=[str(pkg_path)],
            )
            if spec and spec.loader:
                mod = importlib.util.module_from_spec(spec)
                sys.modules[pkg_name] = mod
                try:
                    spec.loader.exec_module(mod)
                except Exception:
                    pass

from priority_engine.defect_prioritizer import DefectPrioritizer
from priority_engine.model_loader import model_loader
from traffic_predictor.traffic_analyzer import TrafficAnalyzer
from traffic_predictor.forecast_engine import ForecastEngine
from block_optimizer.bundling_engine import BundlingEngine
from block_optimizer.constraint_solver import BlockConstraintSolver
from block_optimizer.schedule_generator import ScheduleGenerator
from shared.utils import coerce_iso_date


def read_payload(args: argparse.Namespace) -> dict:
    """Reads input data from CLI argument or stdin."""
    if args.input:
        return json.loads(args.input)
    if not sys.stdin.isatty():
        raw = sys.stdin.read().strip()
        if raw:
            return json.loads(raw)
    return {}


def handle_prioritize_defect(payload: dict) -> dict:
    prioritizer = DefectPrioritizer()
    return prioritizer.prioritize(payload)


def handle_prioritize_batch(payload: dict) -> dict:
    prioritizer = DefectPrioritizer()
    defects = payload.get("defects", payload if isinstance(payload, list) else [])
    sort_by_priority = payload.get("sort_by_priority", True) if isinstance(payload, dict) else True
    results = prioritizer.prioritize_batch(defects, sort_by_priority=sort_by_priority)
    return {
        "total_defects": len(results),
        "ranked_defects": results,
    }


def handle_model_info(_: dict) -> dict:
    return model_loader.get_metadata()


def handle_calculate_occupancy(payload: dict) -> dict:
    analyzer = TrafficAnalyzer()
    section_id = payload.get("section_id", "NDLS-CNB-UP")
    start_time = coerce_iso_date(payload.get("start_time")) or datetime.now(timezone.utc)
    end_time = coerce_iso_date(payload.get("end_time"))
    return analyzer.calculate_section_occupancy(section_id, start_time, end_time)


def handle_find_slots(payload: dict) -> dict:
    analyzer = TrafficAnalyzer()
    section_id = payload.get("section_id", "NDLS-CNB-UP")
    start_time = coerce_iso_date(payload.get("start_time")) or datetime.now(timezone.utc)
    end_time = coerce_iso_date(payload.get("end_time"))
    duration = int(payload.get("duration_minutes", 120))
    slots = analyzer.find_available_corridor_slots(section_id, start_time, end_time, required_duration_minutes=duration)
    # Serialize datetimes in slots
    for s in slots:
        if isinstance(s.get("slot_start"), datetime):
            s["slot_start"] = s["slot_start"].isoformat()
        if isinstance(s.get("slot_end"), datetime):
            s["slot_end"] = s["slot_end"].isoformat()
    return {"slots": slots, "count": len(slots)}


def handle_predict_best_slots(payload: dict) -> dict:
    analyzer = TrafficAnalyzer()
    section_id = payload.get("section_id", "NDLS-CNB-UP")
    start_time = coerce_iso_date(payload.get("start_time")) or datetime.now(timezone.utc)
    end_time = coerce_iso_date(payload.get("end_time"))
    duration = int(payload.get("duration_minutes", 120))
    top_k = int(payload.get("top_k", 10))
    best_slots = analyzer.predict_best_slots(section_id, start_time, end_time, duration_minutes=duration, top_k=top_k)
    return {"best_slots": best_slots, "count": len(best_slots)}


def handle_traffic_forecast(payload: dict) -> dict:
    engine = ForecastEngine()
    section_id = payload.get("section_id", "NDLS-CNB-UP")
    start_time = coerce_iso_date(payload.get("date")) or datetime.now(timezone.utc)
    horizon = int(payload.get("horizon_hours", 24))
    df = engine.generate_hourly_forecast(section_id, start_time, horizon_hours=horizon)
    return {"forecast": df.to_dict(orient="records")}


def handle_bundle_tasks(payload: dict) -> dict:
    bundling = BundlingEngine()
    tasks = payload.get("tasks", payload if isinstance(payload, list) else [])
    bundles = bundling.create_bundles(tasks)
    return {"bundles": bundles, "count": len(bundles)}


def handle_optimize_schedule(payload: dict) -> dict:
    generator = ScheduleGenerator()
    tasks = payload.get("tasks", [])
    slots = payload.get("slots", [])
    teams = payload.get("teams", None)
    auto_bundle = payload.get("auto_bundle", True)
    return generator.generate_optimized_schedule(tasks=tasks, available_slots=slots, teams=teams, auto_bundle=auto_bundle)


def handle_check_compatibility(payload: dict) -> dict:
    bundling = BundlingEngine()
    d1 = payload.get("dept1", "CIVIL")
    d2 = payload.get("dept2", "TRD_OHE")
    coefficient = bundling.check_department_compatibility(d1, d2)
    return {"dept1": d1, "dept2": d2, "compatibility": coefficient}


def handle_health(_: dict) -> dict:
    hc = model_loader.health_check()
    return {
        "status": "HEALTHY",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "priority_model": hc.get("status"),
        "bridge": "PYTHON_CHILD_PROCESS",
    }


COMMAND_HANDLERS = {
    "prioritize_defect": handle_prioritize_defect,
    "prioritize_batch": handle_prioritize_batch,
    "model_info": handle_model_info,
    "calculate_occupancy": handle_calculate_occupancy,
    "find_slots": handle_find_slots,
    "predict_best_slots": handle_predict_best_slots,
    "traffic_forecast": handle_traffic_forecast,
    "bundle_tasks": handle_bundle_tasks,
    "optimize_schedule": handle_optimize_schedule,
    "check_compatibility": handle_check_compatibility,
    "health": handle_health,
}


def main():
    parser = argparse.ArgumentParser(description="Python AI CLI Runner for Node.js backend bridge")
    parser.add_argument("command", choices=list(COMMAND_HANDLERS.keys()), help="AI action to execute")
    parser.add_argument("--input", "-i", type=str, help="Input parameters as JSON string")

    args = parser.parse_args()

    try:
        payload = read_payload(args)
        handler = COMMAND_HANDLERS[args.command]
        result = handler(payload)
        output = {
            "success": True,
            "command": args.command,
            "data": result,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        print(json.dumps(output, default=str))
        sys.exit(0)
    except Exception as e:
        err_output = {
            "success": False,
            "command": args.command,
            "error": str(e),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        print(json.dumps(err_output), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
