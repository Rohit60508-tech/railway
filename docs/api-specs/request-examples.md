# Indian Railways AI Platform — Request Examples

This document provides production-ready code samples in **cURL**, **JavaScript (Fetch / Node.js)**, and **Python (requests)** for all major API endpoints.

---

## 1. Single Defect Prioritization

`POST /api/v1/ai/prioritize/defect`

### cURL
```bash
curl -X POST "http://127.0.0.1:8080/api/v1/ai/prioritize/defect" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ir-ai-key-2026" \
  -d '{
    "defect_id": "DEF-2026-001",
    "section_id": "NDLS-CNB-UP",
    "department": "CIVIL",
    "asset_type": "RAIL_THERMIT_WELD",
    "severity": "CRITICAL",
    "source": "USFD",
    "track_quality_index": 38.5,
    "trains_per_day": 125,
    "speed_limit_kmh": 110,
    "overdue_days": 2.5
  }'
```

### Python
```python
import requests

url = "http://127.0.0.1:8080/api/v1/ai/prioritize/defect"
headers = {
    "X-API-Key": "ir-ai-key-2026",
    "Content-Type": "application/json"
}
payload = {
    "defect_id": "DEF-2026-001",
    "section_id": "NDLS-CNB-UP",
    "department": "CIVIL",
    "asset_type": "RAIL_THERMIT_WELD",
    "severity": "CRITICAL",
    "source": "USFD",
    "track_quality_index": 38.5,
    "trains_per_day": 125,
    "speed_limit_kmh": 110,
    "overdue_days": 2.5
}

response = requests.post(url, json=payload, headers=headers)
print(response.json())
```

---

## 2. Batch Defect Prioritization

`POST /api/v1/ai/prioritize/batch`

### JavaScript (Node.js)
```javascript
const payload = {
  defects: [
    {
      defect_id: "DEF-2026-001",
      section_id: "NDLS-CNB-UP",
      department: "CIVIL",
      severity: "CRITICAL",
      source: "USFD"
    },
    {
      defect_id: "DEF-2026-002",
      section_id: "NDLS-CNB-UP",
      department: "TRD_OHE",
      severity: "HIGH",
      source: "ITMS"
    }
  ],
  sort_by_priority: true
};

const response = await fetch("http://127.0.0.1:8080/api/v1/ai/prioritize/batch", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": "ir-ai-key-2026"
  },
  body: JSON.stringify(payload)
});

const data = await response.json();
console.log("Ranked Defects Count:", data.data.totalDefects);
```

---

## 3. Query Best Recommended Maintenance Slots

`GET /api/v1/ai/traffic/best-slots/:sectionId/:duration`

### cURL
```bash
curl -X GET "http://127.0.0.1:8080/api/v1/ai/traffic/best-slots/NDLS-CNB-UP/120?top_k=5" \
  -H "X-API-Key: ir-ai-key-2026"
```

### Python
```python
import requests

section_id = "NDLS-CNB-UP"
duration_minutes = 120
url = f"http://127.0.0.1:8080/api/v1/ai/traffic/best-slots/{section_id}/{duration_minutes}?top_k=5"

headers = {"X-API-Key": "ir-ai-key-2026"}
response = requests.get(url, headers=headers)
slots = response.json()["data"]["best_slots"]

for s in slots:
    print(f"Slot {s['slotId']}: {s['slotStart']} to {s['slotEnd']} (Feasibility: {s['feasibility']})")
```

---

## 4. Multi-Department Block Schedule Optimization

`POST /api/v1/ai/optimize/schedule`

### cURL
```bash
curl -X POST "http://127.0.0.1:8080/api/v1/ai/optimize/schedule" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ir-ai-key-2026" \
  -d '{
    "tasks": [
      {
        "task_id": "TASK-CIVIL-01",
        "department": "CIVIL",
        "section_id": "NDLS-CNB-UP",
        "duration_minutes": 120,
        "priority_score": 92.0,
        "required_track_closure": true
      },
      {
        "task_id": "TASK-TRD-01",
        "department": "TRD_OHE",
        "section_id": "NDLS-CNB-UP",
        "duration_minutes": 90,
        "priority_score": 84.0,
        "required_power_block": true
      }
    ],
    "slots": [
      {
        "slot_id": "SLOT-NIGHT-01",
        "section_id": "NDLS-CNB-UP",
        "start_time": "2026-09-08T01:00:00Z",
        "end_time": "2026-09-08T04:00:00Z",
        "duration_minutes": 180,
        "disruption_score": 14.5
      }
    ],
    "auto_bundle": true
  }'
```

---

## 5. Evaluate Cross-Department Bundling

`POST /api/v1/ai/optimize/bundle`

### cURL
```bash
curl -X POST "http://127.0.0.1:8080/api/v1/ai/optimize/bundle" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ir-ai-key-2026" \
  -d '{
    "tasks": [
      {
        "task_id": "T1",
        "department": "CIVIL",
        "section_id": "NDLS-CNB-UP",
        "duration_minutes": 120
      },
      {
        "task_id": "T2",
        "department": "TRD_OHE",
        "section_id": "NDLS-CNB-UP",
        "duration_minutes": 90
      }
    ]
  }'
```

---

## 6. Trigger Model Retraining Pipeline

`POST /api/v1/ai/models/retrain`

### cURL
```bash
curl -X POST "http://127.0.0.1:8080/api/v1/ai/models/retrain" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer admin-secret-key" \
  -d '{
    "samples": 3000,
    "model_type": "RandomForest"
  }'
```

---

## 7. Inspect Real-Time Telemetry & Drift Metrics

`GET /api/v1/ai/models/metrics`

### cURL
```bash
curl -X GET "http://127.0.0.1:8080/api/v1/ai/models/metrics" \
  -H "X-API-Key: ir-ai-key-2026"
```
