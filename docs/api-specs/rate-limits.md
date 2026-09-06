# Indian Railways AI Platform — Rate Limiting Policy

## 1. Rate Limiting Strategy

To guarantee operational stability, protect computation-heavy machine learning models, and prevent denial-of-service conditions, the Indian Railways AI API enforces strict sliding-window rate limiting.

Limits are applied per authenticated client identity (API Key or JWT Subject). For unauthenticated requests, limits fallback to the remote client IP address.

---

## 2. Tiered Rate Limits by Operation

| Endpoint Group | Maximum Requests | Sliding Window | Concurrency Cap | Rationale |
|---|:---:|:---:|:---:|---|
| **Single Defect Prioritization** | 120 requests | 1 minute | 50 concurrent | High throughput for automated inspection cars. |
| **Batch Defect Prioritization** | 30 requests | 1 minute | 5 concurrent | Vectorized processing up to 500 defects/call. |
| **Corridor Slot Discovery** | 120 requests | 1 minute | 20 concurrent | Database-driven headway calculations. |
| **Best Slot Prediction** | 60 requests | 1 minute | 10 concurrent | ML regression and conflict simulation. |
| **CP-SAT Block Optimization** | 15 requests | 1 minute | 2 concurrent | CPU-intensive constraint solver (OR-Tools). |
| **Task Bundling Evaluation** | 30 requests | 1 minute | 5 concurrent | Combinatorial departmental compatibility. |
| **Model Info & Telemetry** | 180 requests | 1 minute | 100 concurrent | Low-cost in-memory metadata read. |
| **Model Retraining Pipeline** | 5 requests | 1 hour | 1 concurrent | Heavy disk/GPU model training cycle. |

---

## 3. Rate Limit Headers

Every HTTP response from the AI gateway includes standardized tracking headers:

| Header | Example | Description |
|---|---|---|
| `X-RateLimit-Limit` | `120` | Total requests permitted within current sliding window. |
| `X-RateLimit-Remaining` | `114` | Remaining requests allowed before rate limit is reached. |
| `X-RateLimit-Reset` | `1788665460` | Unix epoch timestamp (in seconds) when window refreshes. |
| `Retry-After` *(on 429 only)* | `42` | Number of seconds client must wait before retrying. |

---

## 4. HTTP 429 Response Format

When the rate limit threshold is exceeded, the gateway immediately returns `429 Too Many Requests`:

```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
X-RateLimit-Limit: 120
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1788665460
Retry-After: 42

{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded (120 req/min). Please retry after 42s.",
    "timestamp": "2026-09-06T03:32:00.000Z"
  }
}
```

---

## 5. Client Implementation: Exponential Backoff with Jitter

Clients must implement automatic retries with exponential backoff and randomized jitter to gracefully handle rate limit exhaustion without thundering herd spikes.

### Python Example
```python
import time
import random
import requests

def call_ai_api_with_retry(url, payload, headers, max_retries=4):
    for attempt in range(max_retries):
        response = requests.post(url, json=payload, headers=headers)
        
        if response.status_code == 200:
            return response.json()
        
        if response.status_code == 429:
            retry_after = int(response.headers.get("Retry-After", 2 ** attempt))
            jitter = random.uniform(0.1, 0.5)
            wait_time = retry_after + jitter
            print(f"[Rate Limited] Backing off for {wait_time:.2f} seconds...")
            time.sleep(wait_time)
            continue
            
        response.raise_for_status()
        
    raise RuntimeError("Exceeded maximum retry attempts due to rate limiting.")
```
