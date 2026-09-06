"""
bundling_engine.py
─────────────────────────────────────────────────────────────────────────────
BundlingEngine: Groups maintenance work orders by section, checks inter-department
operational compatibility (Civil / Engineering, Traction / TRD, S&T), synthesizes
multi-department task bundles, and quantifies corridor occupancy savings.
─────────────────────────────────────────────────────────────────────────────
"""

import json
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple, Union

try:
    from shared.logger import get_logger
except ImportError:
    shared_path = str(Path(__file__).resolve().parent.parent)
    if shared_path not in sys.path:
        sys.path.insert(0, shared_path)
    from shared.logger import get_logger

logger = get_logger("bundling_engine")

CONFIG_PATH = Path(__file__).resolve().parent / "config.json"


class BundlingEngine:
    """
    Consolidates disparate maintenance tasks into synchronized, multi-department
    corridor blocks to minimize track possession frequency and train disruption.
    """

    DEPT_ALIASES = {
        "ENGINEERING": "CIVIL",
        "P_WAY": "CIVIL",
        "TRACK": "CIVIL",
        "CIVIL": "CIVIL",
        "TRACTION": "TRD_OHE",
        "TRD": "TRD_OHE",
        "OHE": "TRD_OHE",
        "TRD_OHE": "TRD_OHE",
        "S&T": "SIGNALLING",
        "SIGNAL": "SIGNALLING",
        "SIGNALLING": "SIGNALLING",
        "TELECOM": "SIGNALLING",
        "MECHANICAL": "ROLLING_STOCK",
        "C&W": "ROLLING_STOCK",
        "ROLLING_STOCK": "ROLLING_STOCK",
    }

    def __init__(self, config_path: Optional[Union[str, Path]] = None):
        self.config_path = Path(config_path) if config_path else CONFIG_PATH
        self.config = self._load_config()

        self.max_tasks_per_bundle = int(self.config.get("max_tasks_per_bundle", 5))
        self.buffer_time_minutes = int(self.config.get("buffer_time_minutes", 15))
        self.max_block_duration_minutes = int(self.config.get("max_block_duration_minutes", 240))
        self.compatibility_matrix = self.config.get("department_compatibility", {})
        self.bundling_weights = self.config.get("bundling_weights", {
            "same_section": 0.35,
            "same_department": 0.25,
            "compatible_departments": 0.25,
            "shared_resources": 0.15,
        })

    def _load_config(self) -> Dict[str, Any]:
        """Loads configuration from config.json with fallback defaults."""
        if self.config_path.exists():
            try:
                with open(self.config_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception as e:
                logger.error(f"Error loading bundling config from {self.config_path}: {e}")
        return {
            "max_tasks_per_bundle": 5,
            "buffer_time_minutes": 15,
            "max_block_duration_minutes": 240,
            "department_compatibility": {
                "CIVIL": {"CIVIL": 1.0, "TRD_OHE": 0.9, "SIGNALLING": 0.8},
                "TRD_OHE": {"CIVIL": 0.9, "TRD_OHE": 1.0, "SIGNALLING": 0.85},
                "SIGNALLING": {"CIVIL": 0.8, "TRD_OHE": 0.85, "SIGNALLING": 1.0},
            },
        }

    def normalize_department(self, dept: str) -> str:
        """Maps diverse departmental acronyms to standard canonical keys."""
        cleaned = str(dept).upper().replace("-", "_").replace(" ", "_")
        return self.DEPT_ALIASES.get(cleaned, cleaned)

    def check_department_compatibility(self, dept1: str, dept2: str) -> float:
        """
        Returns compatibility coefficient (0.0 to 1.0) between two departments.
        High values indicate tasks can safely execute simultaneously under same block.
        """
        d1 = self.normalize_department(dept1)
        d2 = self.normalize_department(dept2)

        if d1 == d2:
            return 1.0

        comp_dict = self.compatibility_matrix.get(d1, {})
        if d2 in comp_dict:
            return float(comp_dict[d2])

        # Symmetric lookup fallback
        rev_dict = self.compatibility_matrix.get(d2, {})
        if d1 in rev_dict:
            return float(rev_dict[d1])

        return 0.5

    def group_tasks_by_section(self, tasks: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        """Groups raw maintenance work orders by section identifier."""
        grouped: Dict[str, List[Dict[str, Any]]] = {}
        for task in tasks:
            sec = str(task.get("section_id", "DEFAULT_SECTION"))
            grouped.setdefault(sec, []).append(task)
        return grouped

    def calculate_bundling_score(self, tasks: List[Dict[str, Any]]) -> float:
        """
        Computes composite bundling quality score (0.0 to 100.0) based on
        same_section, same_department, compatible_departments, and shared_resources.
        """
        if not tasks:
            return 0.0
        if len(tasks) == 1:
            return 50.0

        # 1. Same Section (100 if all match, else partial)
        sections = {t.get("section_id") for t in tasks}
        same_section_score = 100.0 if len(sections) == 1 else max(0.0, 100.0 - (len(sections) - 1) * 40.0)

        # 2. Same Department vs Multi-department balance
        departments = [self.normalize_department(t.get("department", "CIVIL")) for t in tasks]
        unique_depts = set(departments)
        same_dept_ratio = max(departments.count(d) for d in unique_depts) / len(departments)
        same_department_score = same_dept_ratio * 100.0

        # 3. Compatible Departments (Average pairwise compatibility)
        pairwise_compat: List[float] = []
        for i in range(len(departments)):
            for j in range(i + 1, len(departments)):
                pairwise_compat.append(self.check_department_compatibility(departments[i], departments[j]))
        avg_compat = (sum(pairwise_compat) / len(pairwise_compat)) if pairwise_compat else 1.0
        compatible_dept_score = avg_compat * 100.0

        # 4. Shared Resources / Spatial Proximity
        # Higher score if chainage is close (< 5 km span)
        chainages = [float(t.get("chainage_km", 0.0)) for t in tasks if t.get("chainage_km") is not None]
        if len(chainages) >= 2:
            span_km = max(chainages) - min(chainages)
            spatial_score = max(20.0, 100.0 - (span_km * 10.0))
        else:
            spatial_score = 75.0

        w_sec = float(self.bundling_weights.get("same_section", 0.35))
        w_dept = float(self.bundling_weights.get("same_department", 0.25))
        w_compat = float(self.bundling_weights.get("compatible_departments", 0.25))
        w_res = float(self.bundling_weights.get("shared_resources", 0.15))

        total_score = (
            same_section_score * w_sec
            + same_department_score * w_dept
            + compatible_dept_score * w_compat
            + spatial_score * w_res
        )

        return round(float(min(100.0, max(0.0, total_score))), 2)

    def generate_bundling_benefits(self, tasks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Quantifies human-readable benefits of task bundling:
        - Time saved vs sequential execution
        - Reduced corridor possession requests
        - Multi-department synergy
        """
        task_count = len(tasks)
        durations = [int(t.get("duration_minutes", 60)) for t in tasks]
        sequential_total_min = sum(durations)

        # Simultaneous execution under shadow block: max individual task duration + buffer
        bundled_duration_min = max(durations) + self.buffer_time_minutes
        bundled_duration_min = min(self.max_block_duration_minutes, bundled_duration_min)

        time_saved_min = max(0, sequential_total_min - bundled_duration_min)
        time_saved_hours = round(time_saved_min / 60.0, 1)

        unique_depts = sorted({self.normalize_department(t.get("department", "CIVIL")) for t in tasks})
        multi_dept = len(unique_depts) > 1

        benefits_list: List[str] = []
        if time_saved_min > 0:
            benefits_list.append(
                f"Saves {time_saved_min} minutes ({time_saved_hours} hrs) of total track possession compared to sequential blocks."
            )
        if task_count > 1:
            benefits_list.append(
                f"Replaces {task_count} separate corridor block requests with 1 unified integrated window."
            )
        if multi_dept:
            dept_names = " + ".join(unique_depts)
            benefits_list.append(
                f"Multi-department synergy achieved: Synchronized execution between {dept_names}."
            )
        else:
            benefits_list.append("Batch execution of intra-department gang work orders in single possession.")

        return {
            "tasks_count": task_count,
            "sequential_duration_minutes": sequential_total_min,
            "bundled_duration_minutes": bundled_duration_min,
            "time_saved_minutes": time_saved_min,
            "time_saved_hours": time_saved_hours,
            "corridor_possession_reduction_pct": round((time_saved_min / max(1, sequential_total_min)) * 100.0, 1),
            "departments_involved": unique_depts,
            "benefits": benefits_list,
        }

    def create_bundles(self, tasks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Groups tasks by section and bundles compatible tasks up to max_tasks_per_bundle.
        Returns list of structured Bundle dicts.
        """
        grouped_by_sec = self.group_tasks_by_section(tasks)
        all_bundles: List[Dict[str, Any]] = []
        bundle_counter = 1

        for section_id, sec_tasks in grouped_by_sec.items():
            # Sort tasks by priority score descending if available
            sorted_tasks = sorted(sec_tasks, key=lambda x: x.get("priority_score", 50.0), reverse=True)

            # Greedy clustering of compatible tasks
            unassigned = list(sorted_tasks)
            while unassigned:
                lead_task = unassigned.pop(0)
                current_bundle_tasks = [lead_task]
                lead_dept = self.normalize_department(lead_task.get("department", "CIVIL"))

                remaining: List[Dict[str, Any]] = []
                for cand in unassigned:
                    if len(current_bundle_tasks) >= self.max_tasks_per_bundle:
                        remaining.append(cand)
                        continue

                    cand_dept = self.normalize_department(cand.get("department", "CIVIL"))
                    compat = self.check_department_compatibility(lead_dept, cand_dept)

                    # Chainage proximity check if both specified (< 10 km)
                    chain_lead = lead_task.get("chainage_km")
                    chain_cand = cand.get("chainage_km")
                    close_proximity = True
                    if chain_lead is not None and chain_cand is not None:
                        close_proximity = abs(float(chain_lead) - float(chain_cand)) <= 10.0

                    if compat >= 0.70 and close_proximity:
                        current_bundle_tasks.append(cand)
                    else:
                        remaining.append(cand)

                unassigned = remaining

                bundling_score = self.calculate_bundling_score(current_bundle_tasks)
                benefits = self.generate_bundling_benefits(current_bundle_tasks)
                task_ids = [str(t.get("task_id", t.get("defect_id", f"TSK_{idx}"))) for idx, t in enumerate(current_bundle_tasks)]

                bundle_obj = {
                    "bundle_id": f"BUNDLE-{section_id[:6].upper()}-{bundle_counter:03d}",
                    "section_id": section_id,
                    "task_ids": task_ids,
                    "tasks": current_bundle_tasks,
                    "required_duration_minutes": benefits["bundled_duration_minutes"],
                    "bundling_score": bundling_score,
                    "departments": benefits["departments_involved"],
                    "benefits": benefits,
                }
                all_bundles.append(bundle_obj)
                bundle_counter += 1

        logger.info(f"Formed {len(all_bundles)} optimized task bundles across {len(grouped_by_sec)} sections.")
        return all_bundles
