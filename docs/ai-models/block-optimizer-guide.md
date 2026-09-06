# Block Optimizer & Bundling Engine: Technical Guide

## 1. Overview

The **Block Optimizer & Bundling Engine** (`ai-models/block-optimizer/`) solves the complex multi-department maintenance scheduling problem on Indian Railways. Utilizing **Google OR-Tools CP-SAT** (Constraint Programming - Satisfiability), the engine synthesizes maintenance block requests from Civil Engineering (P-Way), Overhead Equipment (TRD), Signalling & Telecommunication (S&T), and Mechanical (Rolling Stock) into unified, non-conflicting corridor execution plans.

---

## 2. Multi-Department Bundling Logic

On Indian Railways, when a block is granted to P-Way for track tamping, the overhead electric traction (OHE) wire or track circuits are often idle. **Corridor Bundling** pairs compatible tasks from different departments within the exact same spatial section and temporal window, multiplying maintenance productivity while imposing only a single traffic disruption.

### Cross-Department Compatibility Matrix

Values range from `0.0` (Incompatible / hazardous) to `1.0` (Perfect synergy):

| Department | CIVIL (P-Way) | TRD_OHE (Traction) | SIGNALLING (S&T) | ROLLING_STOCK |
|---|---|---|---|---|
| **CIVIL** | **1.0** | 0.90 | 0.80 | 0.40 |
| **TRD_OHE** | 0.90 | **1.0** | 0.85 | 0.30 |
| **SIGNALLING**| 0.80 | 0.85 | **1.0** | 0.30 |
| **ROLLING_STOCK** | 0.40 | 0.30 | 0.30 | **1.0** |

*Note: CIVIL and TRD possess a 0.90 compatibility score because track relaying machines (BCM/PQRS) can work simultaneously under de-energized OHE wires during power blocks.*

### Bundling Score Formula:
```
Bundle Score = (0.35 * Same_Section_Indicator) + 
               (0.25 * Same_Department_Indicator) + 
               (0.25 * Compatibility_Coefficient) + 
               (0.15 * Shared_Resource_Synergy)
```

---

## 3. Mathematical Formulation (CP-SAT Model)

The scheduling problem is formulated as a mixed integer constraint satisfaction problem over a discrete time horizon $T$:

### 3.1 Decision Variables
- $x_{i,t} \in \{0, 1\}$: Binary variable indicating if maintenance block request $i$ starts at time slot $t$.
- $s_i, e_i \in \mathbb{N}$: Start and end time slot variables for task $i$, where $e_i = s_i + d_i$.
- $b_{i,j} \in \{0, 1\}$: Binary variable indicating if task $i$ and task $j$ are bundled into the same corridor window.

### 3.2 Operational Constraints
1. **Corridor Non-Overlapping (Single Track)**:
   For any two unbundled tasks $i, j$ on the same track section $S$:
   $$e_i + \text{Buffer} \le s_j \quad \text{OR} \quad e_j + \text{Buffer} \le s_i$$
2. **Maximum Block Duration Constraint**:
   $$d_{\text{bundle}} \le D_{\max} \quad (240 \text{ minutes})$$
3. **Crew & Specialized Machinery Limits**:
   Total machine demand (e.g. Tie Tamping machines CSM, BCM, Tower Wagons) at any time $t$ cannot exceed divisional availability:
   $$\sum_{i \in \text{Active}(t)} \text{Resource}_{i, r} \le \text{Capacity}_r \quad \forall r, t$$
4. **Mandatory P1 SLA Deadline Constraint**:
   $$e_i \le \text{SLA\_Deadline}_i \quad \forall i \in \text{P1 Tasks}$$

### 3.3 Multi-Objective Function
$$\max \sum_{i} \left[ W_{\text{priority}} \cdot P_i \cdot x_i - W_{\text{traffic}} \cdot \text{Disruption}_i(s_i) + W_{\text{bundle}} \cdot \sum_{j} b_{i,j} \cdot C_{i,j} \right]$$

---

## 4. Configuration Options (`config.json`)

Located at [ai-models/block-optimizer/config.json](file:///c:/Users/ry729/.gemini/antigravity-ide/scratch/indian-railways-ai/ai-models/block-optimizer/config.json):

```json
{
  "service": "block-optimizer",
  "optimization_objective": "MINIMIZE_TRAFFIC_DISRUPTION_AND_MAXIMIZE_PRIORITY",
  "max_tasks_per_bundle": 5,
  "buffer_time_minutes": 15,
  "max_block_duration_minutes": 240,
  "constraint_weights": {
    "priority_coverage": 0.40,
    "traffic_disruption_penalty": 0.35,
    "multi_dept_bundling_bonus": 0.15,
    "crew_utilization": 0.10
  },
  "solver": {
    "engine": "CP-SAT",
    "time_limit_seconds": 30,
    "num_search_workers": 4,
    "log_search_progress": false
  }
}
```

---

## 5. Usage Examples

### 5.1 Triggering Schedule Optimization via REST API
```bash
curl -X POST http://localhost:8000/api/v1/optimize/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "section_id": "NDLS-CNB-UP",
    "date": "2026-09-07",
    "tasks": [
      {
        "task_id": "TASK-CIVIL-101",
        "department": "CIVIL",
        "work_type": "DEEP_SCREENING",
        "duration_minutes": 120,
        "priority_score": 88.5,
        "required_machinery": ["BCM-04"]
      },
      {
        "task_id": "TASK-TRD-205",
        "department": "TRD_OHE",
        "work_type": "CANTILEVER_ADJUSTMENT",
        "duration_minutes": 90,
        "priority_score": 76.0,
        "required_machinery": ["TOWER_WAGON-12"]
      }
    ]
  }'
```

**Response:**
```json
{
  "solver_status": "OPTIMAL",
  "objective_value": 842.5,
  "scheduled_blocks": [
    {
      "bundle_id": "BUNDLE-NDLS-CNB-001",
      "section_id": "NDLS-CNB-UP",
      "start_time": "2026-09-07T01:30:00+05:30",
      "end_time": "2026-09-07T03:30:00+05:30",
      "duration_minutes": 120,
      "traffic_disruption_score": 14.2,
      "synergy_score": 0.90,
      "tasks_bundled": ["TASK-CIVIL-101", "TASK-TRD-205"],
      "departments_participating": ["CIVIL", "TRD_OHE"],
      "traffic_sanction_feasibility": "HIGH_FEASIBILITY"
    }
  ],
  "unscheduled_tasks": []
}
```

### 5.2 Calling via Python Direct Import
```python
from block_optimizer.solver import BlockConstraintSolver
from block_optimizer.bundling_engine import BundlingEngine

solver = BlockConstraintSolver()
result = solver.solve_schedule(
    tasks=[...],
    available_slots=[...],
    time_limit_seconds=30
)
print(f"Status: {result.status}, Scheduled Blocks: {len(result.scheduled_blocks)}")
```
