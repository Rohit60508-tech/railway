# Indian Railways AI Services: Complete API Reference

## 1. Overview & Base URLs

The Indian Railways AI Inference Microservice exposes a unified OpenAPI 3.0 REST interface running on FastAPI.

- **Development Port**: `http://localhost:5000` or `http://localhost:8000`
- **Docker Container Base URL**: `http://localhost:8000`
- **Production Kubernetes Ingress**: `https://ai.maintenance.railnet.gov.in`
- **Interactive Swagger UI**: `GET /docs`
- **Redoc Documentation**: `GET /redoc`
- **OpenAPI JSON**: `GET /api/v1/openapi.json`

---

## 2. Authentication & Headers

Production endpoints are authenticated via JWT Bearer Tokens provided by the CRIS Single-Sign-On (SSO) authority:

```http
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
X-Railway-Zone: NR
X-Railway-Division: DLI
```

### Rate Limits:
- **General Endpoints**: 120 requests/minute per client IP.
- **Batch Prioritization**: 20 requests/minute (maximum 1,000 defects per batch).
- **Optimization Solver**: 10 requests/minute (solves are computationally intensive).

---

## 3. Defect Priority Endpoints

### 3.1 Prioritize Single Defect
`POST /api/v1/prioritize/defect`

Computes priority score (0–100), categorization (`P1`, `P2`, `P3`, `P4`), SLA deadline, and explanatory rationale.

#### Request Body
```json
{
  "defect_id": "DEF-CIVIL-2026-001",
  "defect_type": "RAIL_FRACTURE",
  "department": "CIVIL",
  "safety_severity": "CRITICAL",
  "track_section": "NDLS-CNB-UP",
  "traffic_density_gmt": 95.0,
  "overdue_days": 3,
  "inspection_source": "USFD",
  "failure_probability": 0.85,
  "asset_criticality": 5,
  "location_criticality": 4
}
```

#### Response (200 OK)
```json
{
  "defect_id": "DEF-CIVIL-2026-001",
  "priority_score": 92.4,
  "category": "P1",
  "label": "Critical / Immediate Intervention",
  "sla_hours": 24,
  "action_required": "Immediate block required within 24 hours",
  "recommended_action": "Emergency clamp / Rail replacement and 20 km/h TSR",
  "explanation": "High risk driven by CRITICAL safety severity (0.22 weight) and USFD detection on 95.0 GMT track section."
}
```

---

### 3.2 Batch Defect Prioritization
`POST /api/v1/prioritize/batch`

Processes up to 1,000 defects in a single high-throughput vectorized inference call.

#### Request Body
```json
{
  "defects": [
    { "defect_id": "DEF-001", "safety_severity": "CRITICAL", "department": "CIVIL" },
    { "defect_id": "DEF-002", "safety_severity": "LOW", "department": "S&T" }
  ]
}
```

#### Response (200 OK)
```json
{
  "total_processed": 2,
  "summary": { "P1": 1, "P2": 0, "P3": 0, "P4": 1 },
  "results": [
    { "defect_id": "DEF-001", "priority_score": 88.5, "category": "P1" },
    { "defect_id": "DEF-002", "priority_score": 32.0, "category": "P4" }
  ]
}
```

---

### 3.3 Model Information
`GET /api/v1/priority/model-info`

Returns active model architecture, weights version, training timestamp, and feature importance.

#### Response (200 OK)
```json
{
  "model_name": "Indian Railways Defect Prioritizer",
  "model_type": "RandomForestClassifier",
  "version": "1.0.0",
  "n_features": 10,
  "status": "LOADED",
  "trained_at": "2026-09-05T18:30:00Z",
  "feature_importance": {
    "safety_severity": 0.23,
    "traffic_density": 0.15,
    "overdue_days": 0.12,
    "failure_probability": 0.12
  }
}
```

---

### 3.4 Retrain Priority Model
`POST /api/v1/priority/retrain`

Triggers background retraining pipeline against newly verified defects and reloads model weights.

---

## 4. Traffic Predictor Endpoints

### 4.1 Section Occupancy
`GET /api/v1/traffic/occupancy/{section_id}?date=YYYY-MM-DD`

Returns hourly train density, line capacity utilization, and active speed restrictions.

#### Response (200 OK)
```json
{
  "section_id": "NDLS-CNB-UP",
  "date": "2026-09-07",
  "total_scheduled_trains": 84,
  "line_utilization_percent": 118.5,
  "congestion_level": "HEAVY",
  "peak_hours": [7, 8, 9, 17, 18, 19, 20]
}
```

---

### 4.2 Best Maintenance Slots
`GET /api/v1/traffic/best-slots/{section_id}/{duration_minutes}?date=YYYY-MM-DD`

Discovers optimal time windows of specified duration ranked by minimum traffic disruption.

#### Response (200 OK)
```json
{
  "section_id": "NDLS-CNB-UP",
  "duration_minutes": 120,
  "recommended_slots": [
    {
      "start_time": "2026-09-07T01:30:00+05:30",
      "end_time": "2026-09-07T03:30:00+05:30",
      "disruption_score": 14.2,
      "feasibility": "HIGH_FEASIBILITY",
      "conflicts_count": 0
    }
  ]
}
```

---

## 5. Maintenance Block Optimizer Endpoints

### 5.1 Schedule Optimization
`POST /api/v1/optimize/schedule`

Executes the OR-Tools CP-SAT solver to schedule and bundle multi-department tasks.

#### Response (200 OK)
```json
{
  "solver_status": "OPTIMAL",
  "scheduled_blocks_count": 2,
  "total_tasks_scheduled": 5,
  "objective_score": 912.4,
  "bundles": [
    {
      "bundle_id": "BNDL-001",
      "start_time": "2026-09-07T01:00:00+05:30",
      "end_time": "2026-09-07T03:30:00+05:30",
      "tasks": ["TASK-CIVIL-01", "TASK-TRD-04"],
      "departments": ["CIVIL", "TRD_OHE"]
    }
  ]
}
```

---

### 5.2 Validate Feasibility
`POST /api/v1/optimize/validate`

Validates a manually requested block against train headway, crew limits, and safety buffers.

---

## 6. Health & Diagnostics Endpoints

| Method | Endpoint | Description | Expected Status |
|---|---|---|---|
| `GET` | `/api/v1/health` | Overall system diagnostic check | 200 OK |
| `GET` | `/api/v1/health/live` | Kubernetes Liveness Probe | 200 OK |
| `GET` | `/api/v1/health/ready` | Kubernetes Readiness Probe | 200 OK |
| `GET` | `/api/v1/health/models` | Status of loaded ML weight artifacts | 200 OK |
| `GET` | `/api/v1/health/database` | Database connection status | 200 OK |

---

## 7. HTTP Error Codes & Schemas

Standard RFC 7807 error format:

```json
{
  "status_code": 422,
  "error": "Unprocessable Entity",
  "message": "Missing required field: safety_severity",
  "timestamp": "2026-09-06T03:10:00Z"
}
```

| HTTP Status | Reason | Remedy |
|---|---|---|
| **400 Bad Request** | Malformed JSON or invalid parameter | Check parameter types and JSON schema |
| **401 Unauthorized** | Missing or expired JWT token | Refresh CRIS SSO authentication token |
| **422 Unprocessable**| Validation failure (e.g. negative duration) | Ensure durations and scores lie within bounds |
| **429 Rate Limited** | Exceeded request quota | Back off and retry with exponential jitter |
| **500 Internal Error**| Uncaught exception | Check service logs in `/app/ai-models/logs` |
| **503 Unavailable** | Database unreachable or model reloading | Service will auto-recover; check `/api/v1/health` |
