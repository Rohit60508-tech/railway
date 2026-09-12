"""
constraint_solver.py
─────────────────────────────────────────────────────────────────────────────
BlockConstraintSolver: Mathematical programming solver leveraging Google OR-Tools
CP-SAT constraint programming. Formulates decision variables, enforces team
availability, slot capacity, and multi-department consolidation constraints,
and optimizes track possession schedules to minimize train disruption.
─────────────────────────────────────────────────────────────────────────────
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

try:
    from ortools.sat.python import cp_model
    ORTOOLS_AVAILABLE = True
except ImportError:
    ORTOOLS_AVAILABLE = False
    cp_model = None

try:
    from shared.logger import get_logger
    from shared.utils import coerce_iso_date
except ImportError:
    shared_path = str(Path(__file__).resolve().parent.parent)
    if shared_path not in sys.path:
        sys.path.insert(0, shared_path)
    from shared.logger import get_logger
    from shared.utils import coerce_iso_date

logger = get_logger("constraint_solver")

CONFIG_PATH = Path(__file__).resolve().parent / "config.json"


class BlockConstraintSolver:
    """
    CP-SAT constraint programming engine that assigns maintenance tasks and bundles
    to candidate corridor time slots with minimal total traffic disruption.
    """

    def __init__(self, config_path: Optional[Union[str, Path]] = None):
        self.config_path = Path(config_path) if config_path else CONFIG_PATH
        self.config = self._load_config()

        self.solver_params = self.config.get("solver", {})
        self.time_limit = int(self.solver_params.get("time_limit_seconds", 30))
        self.num_workers = int(self.solver_params.get("num_search_workers", 4))
        self.log_search = bool(self.solver_params.get("log_search_progress", False))
        self.weights = self.config.get("constraint_weights", {})

    def _load_config(self) -> Dict[str, Any]:
        """Loads configuration from config.json with fallback defaults."""
        if self.config_path.exists():
            try:
                with open(self.config_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Error loading constraint solver config: {e}")
        return {
            "solver": {"time_limit_seconds": 30, "num_search_workers": 4},
            "constraint_weights": {
                "priority_coverage": 0.40,
                "traffic_disruption_penalty": 0.35,
                "multi_dept_bundling_bonus": 0.15,
                "crew_utilization": 0.10,
            },
        }

    def solve(
        self,
        tasks: List[Dict[str, Any]],
        slots: List[Dict[str, Any]],
        teams: Optional[List[Dict[str, Any]]] = None,
        force_all_tasks: bool = False,
    ) -> Dict[str, Any]:
        """
        Solves the optimal task-to-slot assignment problem using OR-Tools CP-SAT.

        :param tasks: List of maintenance task/bundle dicts
        :param slots: List of candidate corridor slot dicts
        :param teams: Optional list of maintenance teams/gangs
        :param force_all_tasks: If True, mandates every task must be scheduled
        :return: Solution dict with task assignments, scheduled blocks, objective value
        """
        if not ORTOOLS_AVAILABLE or cp_model is None:
            logger.warning("Google OR-Tools is not available. Falling back to greedy best-fit heuristic.")
            return self._solve_greedy_fallback(tasks, slots, teams)

        if not tasks:
            return {"status": "TRIVIAL", "assignments": [], "objective_value": 0.0, "message": "No tasks provided."}
        if not slots:
            return {"status": "INFEASIBLE", "assignments": [], "objective_value": None, "message": "No slots available."}

        model = cp_model.CpModel()
        num_tasks = len(tasks)
        num_slots = len(slots)

        # ─────────────────────────────────────────────────────────────────────
        # 1. Decision Variables
        # ─────────────────────────────────────────────────────────────────────
        # x[i, s] == 1 iff task i is assigned to slot s
        x = {}
        for i in range(num_tasks):
            for s in range(num_slots):
                x[i, s] = model.NewBoolVar(f"task_{i}_slot_{s}")

        # z[s] == 1 iff slot s is activated by at least one task
        z = {}
        for s in range(num_slots):
            z[s] = model.NewBoolVar(f"slot_active_{s}")

        # ─────────────────────────────────────────────────────────────────────
        # 2. Constraints
        # ─────────────────────────────────────────────────────────────────────
        # Constraint A: Each task assigned to at most one slot (or exactly one if forced)
        for i in range(num_tasks):
            assigned_slots = [x[i, s] for s in range(num_slots)]
            if force_all_tasks:
                model.Add(sum(assigned_slots) == 1)
            else:
                model.Add(sum(assigned_slots) <= 1)

        # Constraint B: Link slot activation z[s] to task assignments
        # If any task is in slot s, z[s] must be 1. If no tasks, z[s] can be 0.
        for s in range(num_slots):
            slot_tasks = [x[i, s] for i in range(num_tasks)]
            model.AddMaxEquality(z[s], slot_tasks)

        # Constraint C: Slot Duration & Section Compatibility
        for s, slot in enumerate(slots):
            slot_dur = int(slot.get("duration_minutes", 120))
            slot_sec = slot.get("section_id")

            for i, task in enumerate(tasks):
                task_dur = int(task.get("required_duration_minutes", task.get("duration_minutes", 60)))
                task_sec = task.get("section_id")

                # Cannot assign task to slot if task duration exceeds slot duration
                if task_dur > slot_dur:
                    model.Add(x[i, s] == 0)

                # Cannot assign task to a slot tied to a different section
                if slot_sec and task_sec and slot_sec != task_sec:
                    model.Add(x[i, s] == 0)

        # Constraint D: Team Availability / Single Deployment
        # A specific team cannot execute two concurrent tasks in the same slot unless bundled
        task_teams = {}
        for i, t in enumerate(tasks):
            team_id = t.get("assigned_gang_id") or t.get("team_id")
            if team_id:
                task_teams.setdefault(str(team_id), []).append(i)

        for team_id, task_indices in task_teams.items():
            if len(task_indices) > 1:
                for s in range(num_slots):
                    # Max 1 task per team per slot
                    model.Add(sum(x[idx, s] for idx in task_indices) <= 1)

        # ─────────────────────────────────────────────────────────────────────
        # 3. Department Bundling Preferences (Bonus for co-located tasks)
        # ─────────────────────────────────────────────────────────────────────
        bundling_bonuses = []
        for i in range(num_tasks):
            for j in range(i + 1, num_tasks):
                sec_i = tasks[i].get("section_id")
                sec_j = tasks[j].get("section_id")
                if sec_i and sec_j and sec_i == sec_j:
                    for s in range(num_slots):
                        # b_pair is 1 iff both i and j are scheduled in slot s
                        b_pair = model.NewBoolVar(f"bundle_{i}_{j}_s_{s}")
                        model.Add(b_pair <= x[i, s])
                        model.Add(b_pair <= x[j, s])
                        model.Add(b_pair >= x[i, s] + x[j, s] - 1)
                        bundling_bonuses.append(b_pair)

        # ─────────────────────────────────────────────────────────────────────
        # 4. Objective Function Formulation
        # ─────────────────────────────────────────────────────────────────────
        # Minimize: TrafficDisruptionPenalty + UnassignedTaskPenalty - BundlingBonus
        objective_terms = []

        # Traffic Disruption from activating slots
        for s, slot in enumerate(slots):
            # Integer cost 0 to 1000
            impact = int(round(float(slot.get("disruption_score", slot.get("traffic_impact", {}).get("impact_score", 40.0))) * 10))
            objective_terms.append(impact * z[s])

        # Priority Coverage Bonus (Inverted as penalty for unassigned tasks)
        for i, task in enumerate(tasks):
            prio = int(round(float(task.get("priority_score", 50.0)) * 10))
            is_assigned = sum(x[i, s] for s in range(num_slots))
            # If not assigned, penalty equals its priority score * 2
            unassigned_var = model.NewBoolVar(f"unassigned_{i}")
            model.Add(unassigned_var == 1 - is_assigned)
            objective_terms.append(prio * 2 * unassigned_var)

        # Department Bundling Bonus
        for b_pair in bundling_bonuses:
            objective_terms.append(-35 * b_pair)

        model.Minimize(sum(objective_terms))

        # ─────────────────────────────────────────────────────────────────────
        # 5. Solver Execution
        # ─────────────────────────────────────────────────────────────────────
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = float(self.time_limit)
        solver.parameters.num_search_workers = int(self.num_workers)
        solver.parameters.log_search_progress = self.log_search

        status_code = solver.Solve(model)

        status_str = {
            cp_model.OPTIMAL: "OPTIMAL",
            cp_model.FEASIBLE: "FEASIBLE",
            cp_model.INFEASIBLE: "INFEASIBLE",
            cp_model.MODEL_INVALID: "MODEL_INVALID",
            cp_model.UNKNOWN: "UNKNOWN",
        }.get(status_code, "UNKNOWN")

        logger.info(f"CP-SAT solver finished with status: {status_str}")

        if status_code not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            return {
                "status": status_str,
                "assignments": [],
                "objective_value": None,
                "message": f"Solver terminated with non-feasible status: {status_str}",
            }

        # ─────────────────────────────────────────────────────────────────────
        # 6. Extract Schedule
        # ─────────────────────────────────────────────────────────────────────
        scheduled_slots: List[Dict[str, Any]] = []
        assigned_tasks_count = 0

        for s, slot in enumerate(slots):
            if solver.Value(z[s]) == 1:
                slot_assigned_tasks = []
                for i, task in enumerate(tasks):
                    if solver.Value(x[i, s]) == 1:
                        slot_assigned_tasks.append(task)
                        assigned_tasks_count += 1

                if slot_assigned_tasks:
                    scheduled_slots.append({
                        "slot_id": slot.get("slot_id", f"SLOT_{s+1}"),
                        "slot_start": slot.get("slot_start"),
                        "slot_end": slot.get("slot_end"),
                        "duration_minutes": slot.get("duration_minutes"),
                        "section_id": slot.get("section_id", slot_assigned_tasks[0].get("section_id")),
                        "tasks_assigned": slot_assigned_tasks,
                        "tasks_count": len(slot_assigned_tasks),
                        "disruption_score": slot.get("disruption_score", 0.0),
                    })

        unassigned_tasks = []
        for i, task in enumerate(tasks):
            if solver.Value(sum(x[i, s] for s in range(num_slots))) == 0:
                unassigned_tasks.append(task)

        return {
            "status": status_str,
            "objective_value": round(solver.ObjectiveValue() / 10.0, 2),
            "total_tasks": num_tasks,
            "assigned_tasks_count": assigned_tasks_count,
            "unassigned_tasks_count": len(unassigned_tasks),
            "activated_slots_count": len(scheduled_slots),
            "schedule": scheduled_slots,
            "unassigned_tasks": unassigned_tasks,
            "solved_at": datetime.now(timezone.utc).isoformat(),
        }

    def _solve_greedy_fallback(
        self,
        tasks: List[Dict[str, Any]],
        slots: List[Dict[str, Any]],
        teams: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """Greedy heuristic fallback allocating tasks to the best compatible slots."""
        scheduled_slots: List[Dict[str, Any]] = []
        assigned_task_ids = set()

        sorted_slots = sorted(
            slots,
            key=lambda s: float(s.get("disruption_score", s.get("traffic_impact", {}).get("impact_score", 50.0)))
        )
        sorted_tasks = sorted(
            tasks,
            key=lambda t: float(t.get("priority_score", 50.0)),
            reverse=True
        )

        for slot in sorted_slots:
            slot_dur = int(slot.get("duration_minutes", 120))
            slot_sec = slot.get("section_id")
            slot_tasks = []

            for task in sorted_tasks:
                t_id = task.get("task_id", task.get("bundle_id"))
                if t_id in assigned_task_ids:
                    continue
                t_sec = task.get("section_id")
                t_dur = int(task.get("required_duration_minutes", task.get("duration_minutes", 60)))

                if (not slot_sec or not t_sec or slot_sec == t_sec) and t_dur <= slot_dur:
                    slot_tasks.append(task)
                    assigned_task_ids.add(t_id)

            if slot_tasks:
                scheduled_slots.append({
                    "slot_id": slot.get("slot_id", "SLOT_GREEDY"),
                    "slot_start": slot.get("slot_start"),
                    "slot_end": slot.get("slot_end"),
                    "duration_minutes": slot_dur,
                    "section_id": slot_sec or slot_tasks[0].get("section_id"),
                    "tasks_assigned": slot_tasks,
                    "tasks_count": len(slot_tasks),
                    "disruption_score": slot.get("disruption_score", 0.0),
                })

        unassigned = [t for t in sorted_tasks if t.get("task_id", t.get("bundle_id")) not in assigned_task_ids]

        return {
            "status": "FEASIBLE",
            "objective_value": sum(s.get("disruption_score", 0.0) for s in scheduled_slots),
            "total_tasks": len(tasks),
            "assigned_tasks_count": len(assigned_task_ids),
            "unassigned_tasks_count": len(unassigned),
            "activated_slots_count": len(scheduled_slots),
            "schedule": scheduled_slots,
            "unassigned_tasks": unassigned,
            "solved_at": datetime.now(timezone.utc).isoformat(),
        }
