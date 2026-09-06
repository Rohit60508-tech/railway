# Indian Railways AI Platform — REST API Endpoints Specification

## Complete Route Summary

| Method | Endpoint Path | Description | Rate Limit | Auth Required |
|---|---|---|---|---|
| `POST` | `/api/v1/ai/prioritize/defect` | Evaluates risk score & category for a single defect. | 120 req/min | Yes |
| `POST` | `/api/v1/ai/prioritize/batch` | High-throughput batch defect prioritization (up to 500 records). | 30 req/min | Yes |
| `GET` | `/api/v1/ai/traffic/slots/:sectionId` | Returns available corridor maintenance windows for a section. | 120 req/min | Yes |
| `GET` | `/api/v1/ai/traffic/best-slots/:sectionId/:duration` | Predicts top-ranked maintenance slots with minimal disruption. | 60 req/min | Yes |
| `POST` | `/api/v1/ai/optimize/schedule` | Solves optimal task-to-slot assignment using OR-Tools CP-SAT. | 15 req/min | Yes |
| `POST` | `/api/v1/ai/optimize/bundle` | Evaluates cross-department task compatibility & bundling. | 30 req/min | Yes |
| `GET` | `/api/v1/ai/models/info` | Returns model versions, architectures, and operational health. | 120 req/min | Yes |
| `POST` | `/api/v1/ai/models/retrain` | Triggers retraining pipeline on updated inspection records. | 5 req/min | Yes (Admin) |
| `GET` | `/api/v1/ai/models/metrics` | Serves real-time telemetry (drift PSI, latency, accuracy). | 120 req/min | Yes |

---

## 1. Defect Prioritization

### 1.1 Single Defect Prioritization
`POST /api/v1/ai/prioritize/defect`

Scores an individual track defect across 10 domain risk features and computes the regulatory IRPWM priority category.

#### Request Headers
- `Content-Type: application/json`
- `X-API-Key: <api_key>` or `Authorization: Bearer <token>`

#### Request Body Schema
```json
{
  "defect_id": "string (Required. Unique identifier, e.g. DEF-2026-001)",
  "section_id": "string (Required. Railway section code, e.g. NDLS-CNB-UP)",
  "department": "string (CIVIL | TRD_OHE | SIGNAL_TELECOM | MECHANICAL)",
  "asset_type": "string (e.g. RAIL_THERMIT_WELD, OHE_CANTILEVER, POINT_MACHINE)",
  "severity": "string (CRITICAL | HIGH | MEDIUM | LOW)",
  "source": "string (USFD | OMS | TRC | DRONE | MANUAL)",
  "track_quality_index": "number (0.0 to 100.0, optional)",
  "trains_per_day": "number (Daily traffic volume, optional)",
  "speed_limit_kmh": "number (Section speed ceiling, optional)",
  "overdue_days": "number (Days past inspection cycle, optional)"
}
```

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "isValid": true,
    "defect": {
      "defect_id": "DEF-2026-001",
      "priority_score": 92.4,
      "priority_category": "P1",
      "confidence": 0.94,
      "sla_hours": 24,
      "action_required": "Emergency clamp / 20 km/h TSR within 24h",
      "explanation": "High risk driven by CRITICAL severity and high traffic volume on NDLS-CNB-UP."
    }
  },
  "meta": {
    "timestamp": "2026-09-06T03:32:00.000Z",
    "correlation_id": "a5e8c1b2-3f4a-4d6e-8c9a-1b2c3d4e5f6a",
    "service": "priority-engine"
  }
}
```

---

### 1.2 Batch Defect Prioritization
`POST /api/v1/ai/prioritize/batch`

Processes a collection of defects (up to 500) and returns a sorted ranking.

#### Request Body Schema
```json
{
  "defects": "array of defect objects (Required. 1 to 500 items)",
  "sort_by_priority": "boolean (Optional, default: true)"
}
```

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "totalDefects": 2,
    "p1Count": 1,
    "p2Count": 1,
    "p3Count": 0,
    "p4Count": 0,
    "ranked_defects": [
      {
        "defect_id": "DEF-2026-001",
        "priority_score": 92.4,
        "priority_category": "P1"
      },
      {
        "defect_id": "DEF-2026-002",
        "priority_score": 78.1,
        "priority_category": "P2"
      }
    ]
  },
  "meta": {
    "count": 2,
    "service": "priority-engine"
  }
}
```

---

## 2. Traffic Corridor Analysis & Slots

### 2.1 Get Available Corridor Slots
`GET /api/v1/ai/traffic/slots/:sectionId`

Discovers available maintenance slots without passenger conflict.

#### Path Parameters
- `sectionId` (`string`): Target track section (e.g., `NDLS-CNB-UP`).

#### Query Parameters
- `duration` (`integer`, optional): Requested duration in minutes (default: `120`).
- `start_time` (`string`, optional): ISO-8601 start timestamp.
- `end_time` (`string`, optional): ISO-8601 end timestamp.

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "section_id": "NDLS-CNB-UP",
    "requested_duration_minutes": 120,
    "slots_count": 3,
    "slots": [
      {
        "slot_id": "SLOT-01",
        "slot_start": "2026-09-07T01:30:00Z",
        "slot_end": "2026-09-07T03:30:00Z",
        "duration_minutes": 120,
        "disruption_score": 14.2,
        "feasibility": "HIGH_FEASIBILITY"
      }
    ]
  }
}
```

---

### 2.2 Get Best Recommended Slots
`GET /api/v1/ai/traffic/best-slots/:sectionId/:duration`

Ranks optimal maintenance windows using machine learning delay impact estimation.

#### Path Parameters
- `sectionId` (`string`): Railway section code.
- `duration` (`integer`): Block duration in minutes (15 to 1440).

#### Query Parameters
- `top_k` (`integer`, optional): Number of slots to return (default: `10`).

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "section_id": "NDLS-CNB-UP",
    "duration_minutes": 120,
    "top_k": 5,
    "best_slots": [
      {
        "slot_id": "SLOT-BEST-01",
        "slot_start": "2026-09-07T01:00:00Z",
        "slot_end": "2026-09-07T03:00:00Z",
        "duration_minutes": 120,
        "disruption_score": 11.8,
        "feasibility": "HIGH_FEASIBILITY",
        "feasibility_label": "Optimal Night Shadow Window",
        "conflicts_count": 0
      }
    ]
  }
}
```

---

## 3. Block Schedule Optimization & Bundling

### 3.1 Generate Optimized Block Schedule
`POST /api/v1/ai/optimize/schedule`

Solves the multi-department constraint programming model via Google OR-Tools CP-SAT.

#### Request Body Schema
```json
{
  "tasks": [
    {
      "task_id": "TASK-CIVIL-01",
      "department": "CIVIL",
      "section_id": "NDLS-CNB-UP",
      "duration_minutes": 120,
      "priority_score": 92.0,
      "required_track_closure": true
    }
  ],
  "slots": [
    {
      "slot_id": "SLOT-01",
      "section_id": "NDLS-CNB-UP",
      "start_time": "2026-09-07T01:00:00Z",
      "end_time": "2026-09-07T03:30:00Z",
      "duration_minutes": 150,
      "disruption_score": 12.0
    }
  ],
  "teams": "array (optional)",
  "auto_bundle": "boolean (optional, default: true)"
}
```

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "status": "OPTIMAL",
    "objective_value": 412.5,
    "solve_time_seconds": 3.8,
    "scheduled_blocks": [
      {
        "block_id": "BLOCK-SCH-01",
        "slot_id": "SLOT-01",
        "section_id": "NDLS-CNB-UP",
        "start_time": "2026-09-07T01:00:00Z",
        "end_time": "2026-09-07T03:00:00Z",
        "tasks": ["TASK-CIVIL-01"],
        "departments_involved": ["CIVIL"],
        "is_bundled": false
      }
    ],
    "unassigned_tasks": []
  }
}
```

---

### 3.2 Evaluate Task Bundling
`POST /api/v1/ai/optimize/bundle`

Discovers cross-department shadow block consolidation opportunities.

#### Request Body Schema
```json
{
  "tasks": "array of task objects (minimum 2 tasks)"
}
```

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "bundles_count": 1,
    "total_time_saved_minutes": 90,
    "synergy_score": 0.89,
    "bundles": [
      {
        "bundle_id": "BUNDLE-01",
        "section_id": "NDLS-CNB-UP",
        "departments": ["CIVIL", "TRD_OHE"],
        "task_ids": ["TASK-01", "TASK-02"],
        "combined_duration_minutes": 150,
        "individual_duration_sum": 240,
        "time_saved_minutes": 90
      }
    ]
  }
}
```

---

## 4. Model Governance & Telemetry

### 4.1 Model Information & Health
`GET /api/v1/ai/models/info`

Returns architecture, hyperparameters, and active status for all models.

---

### 4.2 Trigger Retraining
`POST /api/v1/ai/models/retrain`

Dispatches asynchronous model retraining on updated database logs.

#### Request Body Schema
```json
{
  "samples": 3000,
  "model_type": "RandomForest"
}
```

---

### 4.3 Telemetry & Drift Metrics
`GET /api/v1/ai/models/metrics`

Returns live telemetry: Concept drift PSI, P95 latency, error rates, and confusion matrix.
