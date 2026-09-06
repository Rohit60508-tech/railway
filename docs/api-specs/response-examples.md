# Indian Railways AI Platform — Response Examples

This reference documents complete, realistic JSON response structures across all endpoints.

---

## 1. Single Defect Prioritization

`POST /api/v1/ai/prioritize/defect`

### Success Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "isValid": true,
    "defect": {
      "defect_id": "DEF-2026-001",
      "section_id": "NDLS-CNB-UP",
      "department": "CIVIL",
      "asset_type": "RAIL_THERMIT_WELD",
      "severity": "CRITICAL",
      "source": "USFD",
      "priority_score": 92.4,
      "priority_category": "P1",
      "confidence": 0.94,
      "sla_hours": 24,
      "action_required": "Emergency clamp / Rail replacement within 24h",
      "explanation": "High risk driven by CRITICAL flaw depth (0.24 weight) on 110 km/h passenger corridor."
    }
  },
  "meta": {
    "timestamp": "2026-09-06T03:32:00.124Z",
    "correlation_id": "8f3b1a2c-4d5e-6f7a-8b9c-0d1e2f3a4b5c",
    "service": "priority-engine"
  }
}
```

---

## 2. Batch Defect Prioritization

`POST /api/v1/ai/prioritize/batch`

### Success Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "totalDefects": 2,
    "p1Count": 1,
    "p2Count": 1,
    "p3Count": 0,
    "p4Count": 0,
    "evaluatedAt": "2026-09-06T03:32:01.000Z",
    "ranked_defects": [
      {
        "defect_id": "DEF-2026-001",
        "priority_score": 92.4,
        "priority_category": "P1",
        "confidence": 0.94,
        "sla_hours": 24
      },
      {
        "defect_id": "DEF-2026-002",
        "priority_score": 76.5,
        "priority_category": "P2",
        "confidence": 0.91,
        "sla_hours": 72
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

## 3. Best Recommended Maintenance Slots

`GET /api/v1/ai/traffic/best-slots/:sectionId/:duration`

### Success Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "section_id": "NDLS-CNB-UP",
    "duration_minutes": 120,
    "top_k": 2,
    "best_slots": [
      {
        "slotId": "SLOT-BEST-01",
        "slotStart": "2026-09-08T01:30:00.000Z",
        "slotEnd": "2026-09-08T03:30:00.000Z",
        "durationMinutes": 120,
        "disruptionScore": 11.4,
        "feasibility": "HIGH_FEASIBILITY",
        "feasibilityLabel": "Optimal Night Maintenance Window",
        "timeWindowType": "NIGHT_SHADOW",
        "conflictsCount": 0,
        "conflicts": []
      },
      {
        "slotId": "SLOT-BEST-02",
        "slotStart": "2026-09-08T11:00:00.000Z",
        "slotEnd": "2026-09-08T13:00:00.000Z",
        "durationMinutes": 120,
        "disruptionScore": 38.2,
        "feasibility": "MODERATE_FEASIBILITY",
        "feasibilityLabel": "Midday Freight Gap Window",
        "timeWindowType": "DAY_DIURNAL",
        "conflictsCount": 1,
        "conflicts": ["GOODS-BOXN-401 (Regulated by 18m)"]
      }
    ]
  },
  "meta": {
    "timestamp": "2026-09-06T03:32:02.450Z",
    "service": "traffic-analyzer"
  }
}
```

---

## 4. Multi-Department Block Schedule Optimization

`POST /api/v1/ai/optimize/schedule`

### Success Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "status": "OPTIMAL",
    "objective_value": 418.5,
    "solve_time_seconds": 3.42,
    "iterations_count": 1820,
    "scheduled_blocks": [
      {
        "block_id": "BLOCK-2026-0908-01",
        "slot_id": "SLOT-NIGHT-01",
        "section_id": "NDLS-CNB-UP",
        "start_time": "2026-09-08T01:00:00Z",
        "end_time": "2026-09-08T03:30:00Z",
        "duration_minutes": 150,
        "departments_involved": ["CIVIL", "TRD_OHE"],
        "tasks": ["TASK-CIVIL-01", "TASK-TRD-01"],
        "is_bundled": true,
        "time_saved_minutes": 60,
        "disruption_score": 14.5
      }
    ],
    "unassigned_tasks": [],
    "metrics": {
      "feasibility_rate": 1.0,
      "bundling_synergy_gain": 0.285
    }
  },
  "meta": {
    "service": "block-optimizer"
  }
}
```

---

## 5. Model Information & Telemetry

`GET /api/v1/ai/models/info`

### Success Response (`200 OK`)
```json
{
  "success": true,
  "data": {
    "platform": "Indian Railways AI Maintenance Intelligence Platform",
    "environment": "production",
    "health": {
      "mode": "REST_DAEMON",
      "server": { "status": "HEALTHY", "version": "1.2.0" }
    },
    "models": {
      "priority_engine": {
        "name": "Defect Priority Classifier",
        "version": "v1.2.0",
        "algorithm": "RandomForestClassifier",
        "status": "SERVING",
        "metrics": {
          "accuracy": 0.924,
          "macro_f1": 0.896,
          "p1_recall": 0.981
        },
        "last_trained": "2026-09-05T18:30:00Z"
      },
      "traffic_predictor": {
        "name": "Train Traffic & Delay Forecaster",
        "version": "v1.1.4",
        "algorithm": "GradientBoosting Ensemble Regressor",
        "status": "SERVING",
        "metrics": {
          "delay_mae_minutes": 3.8,
          "punctuality_r2": 0.912
        }
      },
      "block_optimizer": {
        "name": "Block Constraint Solver & Bundling Engine",
        "version": "v2.0.1",
        "algorithm": "Google OR-Tools CP-SAT (4 Parallel Search Workers)",
        "status": "SERVING",
        "metrics": {
          "feasibility_rate": 0.965,
          "avg_solve_seconds": 4.2
        }
      }
    }
  }
}
```

---

## 6. Standard Error Response Payloads

### 401 Unauthorized (`UNAUTHORIZED`)
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Missing or invalid authentication credentials. Provide a valid X-API-Key or Authorization Bearer token.",
    "details": {
      "required_headers": ["x-api-key", "Authorization: Bearer <token>"]
    },
    "timestamp": "2026-09-06T03:32:10.000Z"
  }
}
```

### 400 Validation Error (`VALIDATION_ERROR`)
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Missing required field: section_id; track_quality_index must be a numeric value",
    "timestamp": "2026-09-06T03:32:11.000Z"
  }
}
```

### 429 Rate Limit Exceeded (`RATE_LIMIT_EXCEEDED`)
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded (120 req/min). Please retry after 42s.",
    "timestamp": "2026-09-06T03:32:12.000Z"
  }
}
```
