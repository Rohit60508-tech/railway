"""
schedule_generator.py
─────────────────────────────────────────────────────────────────────────────
ScheduleGenerator: End-to-end pipeline uniting BundlingEngine, SlotScorer,
and BlockConstraintSolver to generate conflict-free, multi-department block
maintenance schedules along Indian Railways corridors.
─────────────────────────────────────────────────────────────────────────────
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Union
import pandas as pd

try:
    from shared.logger import get_logger
    from shared.models import BlockWindowRecord, BlockStatus
except ImportError:
    shared_path = str(Path(__file__).resolve().parent.parent)
    if shared_path not in sys.path:
        sys.path.insert(0, shared_path)
    from shared.logger import get_logger
    from shared.models import BlockWindowRecord, BlockStatus
from bundling_engine import BundlingEngine
from slot_scorer import SlotScorer
from constraint_solver import BlockConstraintSolver

logger = get_logger("schedule_generator")


class ScheduleGenerator:
    """
    Orchestrates bundling of maintenance work orders, candidate slot discovery,
    constraint satisfaction solving, and schedule generation.
    """

    def __init__(self, config_path: Optional[Union[str, Path]] = None):
        self.bundling_engine = BundlingEngine(config_path)
        self.slot_scorer = SlotScorer(config_path)
        self.solver = BlockConstraintSolver(config_path)

    def generate_optimized_schedule(
        self,
        tasks: List[Dict[str, Any]],
        available_slots: List[Dict[str, Any]],
        teams: Optional[List[Dict[str, Any]]] = None,
        auto_bundle: bool = True,
    ) -> Dict[str, Any]:
        """
        Executes complete optimization workflow:
        1. Bundles compatible tasks in the same section.
        2. Matches and scores candidate slots for each bundle.
        3. Formulates and solves OR-Tools CP-SAT integer program.
        4. Generates structured schedule records with operational metrics.
        """
        logger.info(f"Initiating schedule generation for {len(tasks)} tasks across {len(available_slots)} slots...")

        # Step 1: Automatic Multi-Department Task Bundling
        if auto_bundle:
            bundles = self.bundling_engine.create_bundles(tasks)
            # Use bundles as input entities to solver
            entities_to_solve = bundles
        else:
            entities_to_solve = tasks

        # Step 2: Solve with Google OR-Tools CP-SAT
        solve_result = self.solver.solve(
            tasks=entities_to_solve,
            slots=available_slots,
            teams=teams,
            force_all_tasks=False,
        )

        if solve_result.get("status") not in ("OPTIMAL", "FEASIBLE"):
            logger.warning(f"Optimization could not find a feasible plan: {solve_result.get('status')}")
            return {
                "status": solve_result.get("status"),
                "total_scheduled_blocks": 0,
                "blocks": [],
                "unassigned_tasks": tasks,
                "solver_details": solve_result,
            }

        # Step 3: Format Output Schedule Records
        blocks: List[Dict[str, Any]] = []
        total_time_saved_min = 0

        for idx, sched_slot in enumerate(solve_result.get("schedule", [])):
            assigned_entities = sched_slot.get("tasks_assigned", [])
            all_contained_tasks: List[Dict[str, Any]] = []

            for entity in assigned_entities:
                if "tasks" in entity:
                    all_contained_tasks.extend(entity["tasks"])
                    total_time_saved_min += entity.get("benefits", {}).get("time_saved_minutes", 0)
                else:
                    all_contained_tasks.append(entity)

            departments = sorted({t.get("department", "CIVIL") for t in all_contained_tasks})
            chainages = [float(t.get("chainage_km", 0.0)) for t in all_contained_tasks if t.get("chainage_km") is not None]
            start_km = min(chainages) if chainages else 0.0
            end_km = max(chainages) if chainages else 0.0

            block_rec = {
                "block_id": f"BLK-{sched_slot.get('section_id', 'SEC')[:6]}-{idx+1:03d}",
                "section_id": sched_slot.get("section_id"),
                "start_time": sched_slot.get("slot_start"),
                "end_time": sched_slot.get("slot_end"),
                "duration_minutes": sched_slot.get("duration_minutes"),
                "start_km": round(start_km, 2),
                "end_km": round(end_km, 2),
                "block_type": "SHADOW_COMBINED" if len(departments) > 1 else "STANDARD_SECTION",
                "departments": departments,
                "tasks_count": len(all_contained_tasks),
                "tasks": all_contained_tasks,
                "traffic_disruption_score": sched_slot.get("disruption_score", 0.0),
                "status": BlockStatus.APPROVED.value,
            }
            blocks.append(block_rec)

        # Unassigned items
        unassigned_raw = []
        for un_ent in solve_result.get("unassigned_tasks", []):
            if "tasks" in un_ent:
                unassigned_raw.extend(un_ent["tasks"])
            else:
                unassigned_raw.append(un_ent)

        summary = {
            "status": solve_result["status"],
            "objective_value": solve_result["objective_value"],
            "total_tasks_input": len(tasks),
            "tasks_scheduled": len(tasks) - len(unassigned_raw),
            "tasks_unassigned": len(unassigned_raw),
            "total_blocks_scheduled": len(blocks),
            "total_possession_minutes_saved": total_time_saved_min,
            "total_possession_hours_saved": round(total_time_saved_min / 60.0, 1),
            "blocks": blocks,
            "unassigned_tasks": unassigned_raw,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

        logger.info(
            f"Schedule generation succeeded! {summary['tasks_scheduled']}/{len(tasks)} tasks "
            f"scheduled into {len(blocks)} consolidated blocks ({summary['total_possession_hours_saved']} hrs saved)."
        )
        return summary
