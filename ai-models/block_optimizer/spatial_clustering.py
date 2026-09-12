"""
spatial_clustering.py
─────────────────────────────────────────────────────────────────────────────
Spatial & Multi-Department Clustering Engine for Indian Railways.
Groups track defects and maintenance work orders within a 2 km linear
spatial threshold using DBSCAN and generates unified cross-department
"Mega-Blocks" / "Shadow Blocks".

Departments supported:
  - Engineering (P-Way / Civil)
  - Signal (S&T / Points & Axle Counters)
  - Electrical (TRD OHE Catenary & Power Distribution)
─────────────────────────────────────────────────────────────────────────────
"""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple
import uuid
import time
import numpy as np

try:
    from sklearn.cluster import DBSCAN
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

try:
    from ortools.sat.python import cp_model
    ORTOOLS_AVAILABLE = True
except ImportError:
    ORTOOLS_AVAILABLE = False


@dataclass
class ClusteredMegaBlock:
    """Represents a unified, multi-department spatial Mega-Block."""
    bundle_id: str
    section_id: str
    cluster_center_km: float
    start_km: float
    end_km: float
    span_km: float
    departments_involved: List[str]
    bundled_tasks: List[Dict[str, Any]]
    disjoint_total_minutes: int
    unified_duration_minutes: int
    minutes_saved: int
    savings_percentage: float
    efficiency_score: float
    requires_power_cut: bool
    requires_track_closure: bool
    solver_engine: str = "Google OR-Tools CP-SAT v9.15"
    solver_status: str = "OPTIMAL"
    solve_time_seconds: float = 0.0
    scheduled_tasks: List[Dict[str, Any]] = field(default_factory=list)


class SpatialClusterEngine:
    """
    Groups linear railway maintenance tasks into unified spatial clusters.
    Supports:
      1. Google OR-Tools CP-SAT (Exact Constraint Programming Satisfaction) [Recommended]
      2. DBSCAN Linear Distance Clustering (Heuristic fallback)
    """

    def __init__(self, spatial_threshold_km: float = 2.0, safety_buffer_minutes: int = 15):
        self.spatial_threshold_km = float(spatial_threshold_km)
        self.safety_buffer_minutes = int(safety_buffer_minutes)

    def cluster_tasks(
        self,
        tasks: List[Dict[str, Any]],
        section_id: Optional[str] = None,
        solver_mode: str = "cp-sat",
    ) -> List[ClusteredMegaBlock]:
        """
        Clusters a list of maintenance defects/tasks by section and linear kilometer chainage.

        Args:
            tasks: List of task/defect dicts
            section_id: Optional filter for a specific track section
            solver_mode: 'cp-sat' (Google OR-Tools CP-SAT) or 'dbscan'
        """
        if not tasks:
            return []

        if section_id:
            tasks = [t for t in tasks if t.get("section_id") == section_id]

        if not tasks:
            return []

        if solver_mode.lower() in ("cp-sat", "cpsat") and ORTOOLS_AVAILABLE:
            return self.cluster_tasks_cpsat(tasks, section_id=section_id)

        # Fallback to DBSCAN
        by_section: Dict[str, List[Dict[str, Any]]] = {}
        for t in tasks:
            sec = t.get("section_id", "DEFAULT_SEC")
            by_section.setdefault(sec, []).append(t)

        mega_blocks: List[ClusteredMegaBlock] = []
        for sec, sec_tasks in by_section.items():
            clusters = self._cluster_section_tasks(sec, sec_tasks)
            mega_blocks.extend(clusters)

        mega_blocks.sort(key=lambda b: (len(b.departments_involved), b.savings_percentage), reverse=True)
        return mega_blocks
    def cluster_tasks_cpsat(
        self,
        tasks: List[Dict[str, Any]],
        section_id: Optional[str] = None,
    ) -> List[ClusteredMegaBlock]:
        """
        Exact Multi-Department Spatial Bundling using Google OR-Tools CP-SAT (Constraint Programming).
        Optimizes concurrent track access, electrical OHE power cuts, and departmental sequencing.
        """
        if not tasks:
            return []

        if section_id:
            tasks = [t for t in tasks if t.get("section_id") == section_id]

        by_section: Dict[str, List[Dict[str, Any]]] = {}
        for t in tasks:
            sec = t.get("section_id", "DEFAULT_SEC")
            by_section.setdefault(sec, []).append(t)

        all_mega_blocks: List[ClusteredMegaBlock] = []

        for sec, sec_tasks in by_section.items():
            n = len(sec_tasks)
            if n == 0:
                continue

            # Task metadata parsing
            durations = []
            midpoints = []
            spans = []
            for t in sec_tasks:
                d = int(t.get("estimated_duration_minutes") or t.get("duration_minutes") or t.get("duration") or 60)
                s_km = float(t.get("start_km", 0.0))
                e_km = float(t.get("end_km", s_km))
                durations.append(max(15, d))
                midpoints.append((s_km + e_km) / 2.0)
                spans.append((min(s_km, e_km), max(s_km, e_km)))

            # Pairwise spatial compatibility
            is_compatible = {}
            for i in range(n):
                for j in range(n):
                    is_compatible[(i, j)] = abs(midpoints[i] - midpoints[j]) <= self.spatial_threshold_km

            # CP-SAT Formulation
            model = cp_model.CpModel()
            num_clusters = n
            max_duration = max(720, sum(durations) + 60)

            # Decision variables: x[i, k] == 1 if task i assigned to cluster k
            x = {}
            for i in range(n):
                for k in range(num_clusters):
                    x[(i, k)] = model.NewBoolVar(f"x_{i}_{k}")

            used = [model.NewBoolVar(f"used_{k}") for k in range(num_clusters)]

            # Assignment constraint: each task belongs to exactly 1 cluster
            for i in range(n):
                model.Add(sum(x[(i, k)] for k in range(num_clusters)) == 1)

            # Spatial threshold constraint: incompatible tasks cannot share a cluster
            for i in range(n):
                for j in range(i + 1, n):
                    if not is_compatible[(i, j)]:
                        for k in range(num_clusters):
                            model.Add(x[(i, k)] + x[(j, k)] <= 1)

            # Link cluster used flags
            for i in range(n):
                for k in range(num_clusters):
                    model.Add(used[k] >= x[(i, k)])

            # Symmetry breaking: activate cluster k only if k-1 is active
            for k in range(num_clusters - 1):
                model.Add(used[k] >= used[k + 1])

            # Task intervals and scheduling
            task_start = [model.NewIntVar(0, max_duration, f"start_{i}") for i in range(n)]
            task_end = [model.NewIntVar(0, max_duration, f"end_{i}") for i in range(n)]
            for i in range(n):
                model.Add(task_end[i] == task_start[i] + durations[i])

            # Same-department collision avoidance on overlapping physical spans
            for i in range(n):
                for j in range(i + 1, n):
                    if sec_tasks[i].get("department") == sec_tasks[j].get("department"):
                        # Check physical span overlap
                        spans_overlap = max(spans[i][0], spans[j][0]) < min(spans[i][1], spans[j][1])
                        if spans_overlap:
                            for k in range(num_clusters):
                                b_same = model.NewBoolVar(f"same_dept_{i}_{j}_{k}")
                                model.Add(x[(i, k)] + x[(j, k)] == 2).OnlyEnforceIf(b_same)
                                model.Add(x[(i, k)] + x[(j, k)] < 2).OnlyEnforceIf(b_same.Not())
                                order = model.NewBoolVar(f"order_{i}_{j}_{k}")
                                model.Add(task_start[j] >= task_end[i]).OnlyEnforceIf([b_same, order])
                                model.Add(task_start[i] >= task_end[j]).OnlyEnforceIf([b_same, order.Not()])

            # Cluster makespan variables
            makespan = [model.NewIntVar(0, max_duration, f"makespan_{k}") for k in range(num_clusters)]
            for i in range(n):
                for k in range(num_clusters):
                    model.Add(makespan[k] >= task_end[i]).OnlyEnforceIf(x[(i, k)])

            # Objective: Minimize total makespan (closure time) + penalize fragmented clusters
            total_makespan = sum(makespan[k] for k in range(num_clusters))
            cluster_count = sum(used[k] for k in range(num_clusters))
            model.Minimize(total_makespan * 10 + cluster_count * 50)

            # Solve CP-SAT
            solver = cp_model.CpSolver()
            solver.parameters.max_time_in_seconds = 5.0
            start_t = time.time()
            solver_status_code = solver.Solve(model)
            solve_time = time.time() - start_t
            status_name = solver.StatusName(solver_status_code)

            # Extract clusters
            clusters_map: Dict[int, List[int]] = {}
            for i in range(n):
                for k in range(num_clusters):
                    if solver.Value(x[(i, k)]) == 1:
                        clusters_map.setdefault(k, []).append(i)

            for k, task_indices in clusters_map.items():
                c_tasks = [sec_tasks[i] for i in task_indices]
                c_makespan = int(solver.Value(makespan[k]))
                disjoint_total = sum(durations[i] for i in task_indices)
                minutes_saved = max(0, disjoint_total - c_makespan)
                savings_pct = round((minutes_saved / max(1, disjoint_total)) * 100.0, 2)

                min_km = min(spans[i][0] for i in task_indices)
                max_km = max(spans[i][1] for i in task_indices)
                center_km = round(float(np.mean([midpoints[i] for i in task_indices])), 3)

                departments = sorted(list(set(t.get("department", "Engineering") for t in c_tasks)))
                requires_power_cut = any(t.get("requires_power_cut", False) or t.get("department") in ("Electrical", "TRD_OHE") for t in c_tasks)
                requires_track_closure = any(t.get("required_track_closure", True) for t in c_tasks)

                dept_bonus = (len(departments) - 1) * 15.0
                efficiency_score = round(min(100.0, 50.0 + (savings_pct * 0.35) + dept_bonus), 2)

                # Scheduled tasks inside cluster with start and end offsets
                scheduled_tasks = []
                for i in task_indices:
                    t = sec_tasks[i]
                    scheduled_tasks.append({
                        "task_id": t.get("defect_id") or t.get("task_id") or f"TASK-{i+1}",
                        "department": t.get("department", "Engineering"),
                        "start_km": spans[i][0],
                        "end_km": spans[i][1],
                        "start_offset_min": int(solver.Value(task_start[i])),
                        "end_offset_min": int(solver.Value(task_end[i])),
                        "duration_min": durations[i],
                        "requires_power_cut": bool(t.get("requires_power_cut", False) or t.get("department") in ("Electrical", "TRD_OHE")),
                    })

                all_mega_blocks.append(
                    ClusteredMegaBlock(
                        bundle_id=f"MEGA-BLK-{str(uuid.uuid4())[:8].upper()}",
                        section_id=sec,
                        cluster_center_km=center_km,
                        start_km=round(min_km, 3),
                        end_km=round(max_km, 3),
                        span_km=round(max_km - min_km, 3),
                        departments_involved=departments,
                        bundled_tasks=c_tasks,
                        disjoint_total_minutes=disjoint_total,
                        unified_duration_minutes=c_makespan,
                        minutes_saved=minutes_saved,
                        savings_percentage=savings_pct,
                        efficiency_score=efficiency_score,
                        requires_power_cut=requires_power_cut,
                        requires_track_closure=requires_track_closure,
                        solver_engine="Google OR-Tools CP-SAT v9.15",
                        solver_status=status_name,
                        solve_time_seconds=round(solve_time, 4),
                        scheduled_tasks=scheduled_tasks,
                    )
                )

        all_mega_blocks.sort(key=lambda b: (len(b.departments_involved), b.savings_percentage), reverse=True)
        return all_mega_blocks

    def _cluster_section_tasks(self, section_id: str, tasks: List[Dict[str, Any]]) -> List[ClusteredMegaBlock]:
        """Clusters tasks for a single track section."""
        n_tasks = len(tasks)
        if n_tasks == 0:
            return []

        # Extract midpoint KM for each task
        km_midpoints = np.array([
            (float(t.get("start_km", 0.0)) + float(t.get("end_km", t.get("start_km", 0.0)))) / 2.0
            for t in tasks
        ]).reshape(-1, 1)

        labels: np.ndarray
        if SKLEARN_AVAILABLE and n_tasks > 1:
            # DBSCAN with metric='euclidean', eps=threshold_km, min_samples=1
            db = DBSCAN(eps=self.spatial_threshold_km, min_samples=1, metric="euclidean")
            labels = db.fit_predict(km_midpoints)
        else:
            # Simple 1D greedy clustering fallback if scikit-learn is not present
            labels = self._simple_1d_cluster(km_midpoints.flatten(), self.spatial_threshold_km)

        # Aggregate tasks by cluster label
        clusters_map: Dict[int, List[Dict[str, Any]]] = {}
        for idx, label in enumerate(labels):
            clusters_map.setdefault(label, []).append(tasks[idx])

        results: List[ClusteredMegaBlock] = []

        for cluster_id, cluster_tasks in clusters_map.items():
            start_kms = [float(t.get("start_km", 0.0)) for t in cluster_tasks]
            end_kms = [float(t.get("end_km", t.get("start_km", 0.0))) for t in cluster_tasks]
            min_km = min(start_kms)
            max_km = max(end_kms)
            center_km = round((min_km + max_km) / 2.0, 3)

            durations = [int(t.get("estimated_duration_minutes", t.get("duration_minutes", 120))) for t in cluster_tasks]
            disjoint_total = sum(durations)

            # Unified duration is max single task duration plus safety buffer for multi-department coordination
            max_single = max(durations) if durations else 120
            num_depts = len(set(t.get("department", "Engineering") for t in cluster_tasks))
            coordination_buffer = (num_depts - 1) * self.safety_buffer_minutes
            unified_duration = max_single + coordination_buffer

            if len(cluster_tasks) > 1:
                minutes_saved = max(0, disjoint_total - unified_duration)
                savings_pct = round((minutes_saved / max(1, disjoint_total)) * 100.0, 2)
            else:
                minutes_saved = 0
                savings_pct = 0.0

            departments = sorted(list(set(t.get("department", "Engineering") for t in cluster_tasks)))
            requires_power_cut = any(t.get("requires_power_cut", False) or t.get("department") in ("Electrical", "TRD_OHE") for t in cluster_tasks)
            requires_track_closure = any(t.get("required_track_closure", True) for t in cluster_tasks)

            # Efficiency Score formula: weights savings percentage + multi-department bonus
            dept_bonus = (len(departments) - 1) * 15.0
            efficiency_score = round(min(100.0, 50.0 + (savings_pct * 0.35) + dept_bonus), 2)

            bundle_id = f"MEGA-BLK-{str(uuid.uuid4())[:8].upper()}"

            results.append(
                ClusteredMegaBlock(
                    bundle_id=bundle_id,
                    section_id=section_id,
                    cluster_center_km=center_km,
                    start_km=round(min_km, 3),
                    end_km=round(max_km, 3),
                    span_km=round(max_km - min_km, 3),
                    departments_involved=departments,
                    bundled_tasks=cluster_tasks,
                    disjoint_total_minutes=disjoint_total,
                    unified_duration_minutes=unified_duration,
                    minutes_saved=minutes_saved,
                    savings_percentage=savings_pct,
                    efficiency_score=efficiency_score,
                    requires_power_cut=requires_power_cut,
                    requires_track_closure=requires_track_closure,
                )
            )

        return results

    def _simple_1d_cluster(self, points: np.ndarray, eps: float) -> np.ndarray:
        """1D line clustering fallback grouping points within eps distance."""
        labels = np.zeros(len(points), dtype=int)
        sorted_indices = np.argsort(points)
        current_label = 0

        for i in range(len(sorted_indices)):
            if i == 0:
                labels[sorted_indices[i]] = current_label
            else:
                prev_idx = sorted_indices[i - 1]
                curr_idx = sorted_indices[i]
                if abs(points[curr_idx] - points[prev_idx]) <= eps:
                    labels[curr_idx] = current_label
                else:
                    current_label += 1
                    labels[curr_idx] = current_label

        return labels


# Default global singleton
spatial_cluster_engine = SpatialClusterEngine(spatial_threshold_km=2.0)
