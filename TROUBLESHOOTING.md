# Troubleshooting Guide — Indian Railways AI Platform
### Common Issues, Diagnostic Procedures, Root Causes & Operational Workarounds

---

## 1. Quick Triage Matrix

| Symptom / Error | Probable Root Cause | Immediate Resolution |
| :--- | :--- | :--- |
| `listen EADDRINUSE: address already in use :::8000` | Port occupied by a previous zombie Node process. | Kill process on port (`netstat -ano \| findstr :8000`), or bind ephemeral port `0`. |
| `AI Service request timed out after 15000ms` | Python daemon slow or PostgreSQL connect timeout in progress. | Increase `AI_TIMEOUT_MS=25000` or rely on the automatic Python CLI runner fallback. |
| `CP-SAT solver returned INFEASIBLE` | Over-constrained tasks with mutually exclusive department hazards. | Review safety compatibility rules; relax tight task start constraints. |
| `429 Too Many Requests` | Burst flood exceeded `120 req/min` threshold. | Inspect `Retry-After` response header; distribute batch requests evenly. |
| `401 UNAUTHORIZED / Missing API Key` | Missing or expired `X-API-Key` or Bearer JWT token. | Provide valid key (`ir-ai-key-2026`) in request headers. |
| `WebGL: CONTEXT_LOST_WEBGL` | GPU power state change or memory exhaustion in browser. | ThreeContextManager will auto-restore on focus; reload page if unrecovered. |
| `Database connection pool unreachable` | Local PostgreSQL service stopped or invalid credentials. | Verify `psql -U ir_app`; system automatically falls back to synthetic fixtures. |

---

## 2. Detailed Diagnostic & Resolution Runbooks

### Issue 1: Port Collisions (`EADDRINUSE`) on Windows / PaaS
**Symptoms:**
Node.js fails to bind with:
`Error: listen EADDRINUSE: address already in use :::8000`

**Root Cause:**
On Windows, when servers terminate abruptly, sockets can remain in `TIME_WAIT` state for up to 60 seconds.

**Resolution:**
1. Identify and terminate the PID holding the port:
   ```powershell
   # Windows PowerShell
   netstat -ano | findstr :8000
   taskkill /PID <PID> /F

   # Linux / macOS
   lsof -i :8000
   kill -9 <PID>
   ```
2. In automated testing and parallel execution, use dynamic ephemeral port binding:
   ```javascript
   const server = await createAiServer(0);
   const actualPort = server.address().port;
   ```

---

### Issue 2: Python AI Microservice Timeout & CLI Fallback
**Symptoms:**
Logs report:
`[AIServiceConnector] REST failed (AI Service request timed out after 15000ms). Falling back to Python CLI runner for 'predict_best_slots'...`

**Root Cause:**
When a live PostgreSQL connection is configured but the host is offline, `psycopg2` blocks for the duration of the TCP socket connect timeout (default 10s–30s) before timing out and switching to synthetic schedules.

**Resolution:**
1. Check if the Python AI microservice is alive:
   ```bash
   curl -i http://127.0.0.1:5000/api/v1/health
   ```
2. If running without a database, set connection timeout low in `ai-models/shared/database_config.json`:
   ```json
   {
     "connect_timeout": 2
   }
   ```
3. Or increase the Node.js timeout in `.env`:
   ```env
   AI_TIMEOUT_MS=30000
   ```
> **Note**: The system is designed with a **dual-mode executor**. Even if the REST endpoint times out, the local Python CLI runner (`python_runner.py`) takes over automatically, ensuring requests do not fail.

---

### Issue 3: OR-Tools CP-SAT Solver Returns `INFEASIBLE`
**Symptoms:**
Block schedule generation fails to place tasks into candidate corridor windows.

**Root Cause:**
1. Total duration of mandatory tasks exceeds the longest candidate slot window.
2. Contradictory constraints: A heavy track tamper and manual thermit welding crew scheduled within the 500m mandatory safety buffer.
3. Inadequate train regulation slack.

**Resolution:**
1. Enable solver diagnostic logging in `ai-models/block-optimizer/constraint_solver.py`:
   ```python
   solver.parameters.log_search_progress = True
   ```
2. Split tasks across multiple days or widen candidate search window from 3 days to 7 days.
3. Allow the Bundling Engine to bundle non-conflicting tasks into a single shadow block.

---

### Issue 4: Rate Limiter Throttling (HTTP 429)
**Symptoms:**
API returns HTTP 429 with JSON payload:
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please slow down.",
    "retry_after_seconds": 45
  }
}
```

**Resolution:**
1. Observe the standard RFC headers returned:
   - `X-RateLimit-Limit`: Maximum allowance (default 120).
   - `X-RateLimit-Remaining`: Requests remaining in current window.
   - `X-RateLimit-Reset`: UTC epoch seconds when quota resets.
   - `Retry-After`: Seconds to wait before retrying.
2. For high-volume automated data ingestion (e.g. TRC / USFD track geometry uploads), use the batch endpoint (`POST /api/v1/ai/prioritize/batch`) which processes up to 500 defects in a single call.

---

### Issue 5: Railway.app Container Memory Limits (OOM Kill)
**Symptoms:**
Railway.app dashboard indicates service crashed with `OOMKilled` (Exit code 137).

**Root Cause:**
OR-Tools CP-SAT building combinatorial constraint tables for $> 100$ tasks can consume $> 512\text{MB}$ RAM during search branch exploration.

**Resolution:**
1. In Railway project settings, increase memory limit to minimum **1 GB** (2 GB recommended for zonal hubs).
2. Set solver search time limit in `ai-models/block-optimizer/constraint_solver.py`:
   ```python
   solver.parameters.max_time_in_seconds = 10.0
   ```

---

## 3. Diagnostic Commands Reference

```powershell
# Check Node.js and Python processes
tasklist | findstr -i "node.exe python.exe"

# Run health inspection audit
node -e "require('./backend/services/health-monitor').healthMonitor.audit().then(console.log)"

# Inspect daily rotated JSON log files
Get-Content logs/ai_inference.log -Tail 50

# Execute full platform verification suite
node testing/run-all-tests.js
```

---

## 4. SOC Escalation Procedures

If a critical flaw (P1) is not successfully sanctioned within the 24-hour SLA window due to system errors:
1. **Immediate Escalation**: Call Zonal Control Office Hot-Line (`1800-110-139`).
2. **Manual Caution Order**: Section Controller must manually impose a 30 km/h speed restriction via COIS/FOIS terminal.
3. **Log Incident**: Export diagnostic bundle to `soc-incident@railnet.gov.in`.
