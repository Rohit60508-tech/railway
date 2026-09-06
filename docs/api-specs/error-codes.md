# Indian Railways AI Platform — Error Codes & Fault Handling

## 1. Standard Error Envelope Structure

All failed requests return HTTP status codes in the $4xx$ or $5xx$ range accompanied by a standardized, machine-readable JSON error payload:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Parameter :duration must be an integer between 15 and 1440 minutes.",
    "details": {
      "field": "duration",
      "received": 5,
      "minimum": 15,
      "maximum": 1440
    },
    "timestamp": "2026-09-06T03:32:00.000Z"
  }
}
```

---

## 2. Complete Error Code Taxonomy

### 2.1 Client Errors (4xx)

| HTTP Status | Error Code | Description | Remediation / Action |
|---|---|---|---|
| **400** | `VALIDATION_ERROR` | Request body or route parameter failed schema validation. | Inspect `details` object and correct malformed field types/bounds. |
| **400** | `INVALID_JSON` | Malformed JSON in HTTP request body. | Validate JSON syntax with a linter before transmitting. |
| **400** | `BATCH_LIMIT_EXCEEDED` | Defects array exceeds maximum 500 records. | Partition large defect datasets into multiple batch chunks $\le 500$. |
| **400** | `PARAMETER_OUT_OF_BOUNDS` | Value outside physical railway constraints (e.g. speed $> 250\text{ km/h}$). | Ensure metrics align with RDSO standards and physical corridor limits. |
| **401** | `UNAUTHORIZED` | Missing `X-API-Key` or `Authorization: Bearer` header. | Supply valid credentials in request headers. |
| **401** | `TOKEN_EXPIRED` | JWT authentication token expired. | Re-authenticate against CRIS SSO (`sso.railnet.gov.in`) to obtain a new token. |
| **401** | `INVALID_API_KEY` | Provided API key is unrecognized or revoked. | Verify API key or contact System Administrator for rotation. |
| **403** | `FORBIDDEN` | Caller identity lacks required RBAC role. | Request elevated privileges (e.g. `MLOPS_ADMIN` for model retraining). |
| **403** | `DIVISION_ACCESS_DENIED` | Officer role restricted to specific Railway Division. | Verify divisional authorization headers (`X-Railway-Division`). |
| **404** | `ROUTE_NOT_FOUND` | Path does not match any registered API endpoints. | Check URI path against `GET /api/v1/ai/models/info`. |
| **404** | `SECTION_NOT_FOUND` | Specified section code not found in GIS/timetable ledger. | Confirm section code against Track Section Database (e.g. `NDLS-CNB-UP`). |
| **409** | `SCHEDULE_CONFLICT` | Block window collides with existing locked block. | Adjust time window or enable `auto_bundle` to combine tasks. |
| **422** | `INFEASIBLE_CONSTRAINTS` | OR-Tools CP-SAT proved no schedule satisfies all hard safety rules. | Relax non-critical constraints (e.g., allow gang split or extend search window). |
| **429** | `RATE_LIMIT_EXCEEDED` | Request rate exceeded tier limit. | Back off request rate. Respect `Retry-After` header. |

---

### 2.2 Server & Inference Errors (5xx)

| HTTP Status | Error Code | Description | Operational Triage |
|---|---|---|---|
| **500** | `PRIORITY_SCORING_FAILED` | Internal exception during ML feature extraction or model inference. | Inspect logs with `correlation_id`; check Python memory state. |
| **500** | `BATCH_PRIORITIZATION_FAILED` | Vectorized batch inference failed. | Verify defect feature array consistency. |
| **500** | `SOLVER_FAILURE` | Google OR-Tools CP-SAT crashed or aborted. | Check memory allocation and CPU core availability. |
| **502** | `BAD_GATEWAY` | Node gateway received invalid response from Python microservice. | Verify port 5000 FastAPI daemon process state. |
| **503** | `SERVICE_UNAVAILABLE` | Service undergoing automated model retraining or cold reload. | Retry with exponential backoff (typically $< 3\text{ seconds}$). |
| **504** | `INFERENCE_TIMEOUT` | Computation exceeded maximum timeout threshold (15s). | Narrow search horizon or reduce batch volume. |

---

## 3. Incident Correlation & Debugging

Every request header includes an automated correlation token:

```http
HTTP/1.1 500 Internal Server Error
Content-Type: application/json
X-Correlation-Id: c4f810e7-3b2d-4581-9b64-c2c317ad54a1
```

To investigate an unexpected error in the central logs, query by `correlation_id`:

```bash
# Search using Centralized Log Aggregator
curl -G "http://127.0.0.1:8080/api/v1/ai/logs" \
  --data-urlencode "correlationId=c4f810e7-3b2d-4581-9b64-c2c317ad54a1" \
  -H "X-API-Key: ir-ai-key-2026"
```
