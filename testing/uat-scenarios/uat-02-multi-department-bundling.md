# UAT Scenario 2: Multi-Department Block Bundling & Time Savings

## 1. Scenario Identification
- **Test ID**: `UAT-IR-02`
- **Feature Area**: Cross-Department Bundling Engine & OR-Tools CP-SAT Solver
- **Actor(s)**: Civil Track Engineer, OHE Traction Engineer, Section Controller
- **Target Route**: `NDLS-CNB-UP` (KM 120.0–125.0 near Kanpur)

---

## 2. Business Context & Objective
Verify that independent maintenance requests submitted by the Civil Department (Track Tamping, duration 150m) and Electrical Department (OHE Dropper Replacement, duration 120m) on the same section are automatically bundled into a single coordinated block, saving at least 60 minutes of corridor line closure time.

---

## 3. Step-by-Step Test Procedure

| Step | Action | Expected Result | Pass/Fail Criteria |
|:---:|---|---|---|
| **1** | Civil engineer submits work order for track tamping between KM 120 and 125. | Work order logged in Maintenance Cell queue (`TASK-CIVIL-01`). | Success status returned. |
| **2** | Electrical engineer submits work order for OHE cantilever replacement between KM 122 and 124. | Work order logged in Maintenance Cell queue (`TASK-TRD-01`). | Success status returned. |
| **3** | BundlingEngine evaluates task compatibility via `POST /api/v1/ai/optimize/bundle`. | Civil + Electrical compatibility confirmed ($\ge 0.85$). Shadow block proposal generated. | Single combined bundle created; time saved $\ge 60\text{ mins}$. |
| **4** | BlockConstraintSolver generates schedule via `POST /api/v1/ai/optimize/schedule`. | CP-SAT solver allocates both tasks to optimal Night Shadow window `01:00 – 03:30`. | Solver status `OPTIMAL`; `is_bundled: true`. |
| **5** | Section Controller reviews bundled proposal on Control Office console. | Approves single unified block sanction. Both engineering gangs dispatched simultaneously. | Single line possession granted in COA. |

---

## 4. Acceptance Criteria
- [x] Time saved by bundling must be $\ge 25\%$ compared to separate sequential blocks.
- [x] Safety boundaries must protect electrical isolation and physical track closure simultaneously.
- [x] Gantt chart must render single combined block bar with two department badges.
