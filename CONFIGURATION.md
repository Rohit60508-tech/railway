# Configuration Guide — Indian Railways AI Platform
### Environment Variables, Model Weights, Operational Rules & Railway Configurations

---

## 1. Environment Variable Reference

The platform is configured via environment variables or a `.env` file located in the project root.

### Core Server & Gateway Settings
| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `development` | Runtime environment (`development`, `staging`, `production`). |
| `PORT` | `8000` | HTTP listening port for Node.js API Gateway. |
| `HOST` | `0.0.0.0` | Bind IP interface (`127.0.0.1` for local, `0.0.0.0` for containers/PaaS). |
| `AI_SERVICE_URL` | `http://127.0.0.1:5000` | Target URL for the Python FastAPI inference microservice. |
| `AI_TIMEOUT_MS` | `15000` | Abort timeout in milliseconds for HTTP calls to Python AI. |
| `AI_EXECUTION_STRATEGY` | `REST_FIRST` | Dual-mode strategy: `REST_FIRST`, `REST_ONLY`, `CLI_ONLY`. |
| `PYTHON_PATH` | `python` | Path to Python runtime executable for local CLI fallbacks. |

### Security & Authentication
| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `IR_API_KEY` | `ir-ai-key-2026` | Pre-shared API Key for machine-to-machine track feeds. |
| `JWT_SECRET` | `change_me_super_secret_railway_2026` | Secret key used to sign and verify employee SSO tokens. |
| `JWT_EXPIRATION_HOURS` | `12` | Employee session lifetime before mandatory re-authentication. |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Time sliding window (1 minute) for API rate limiting. |
| `RATE_LIMIT_MAX_REQUESTS`| `120` | Maximum allowed API calls per IP/key in the time window. |

### Database & Persistence
| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql://...` | Connection URI for PostgreSQL / Neon / TimescaleDB. |
| `DB_CONNECT_TIMEOUT` | `5` | Socket connection timeout in seconds. |
| `DB_POOL_MIN` | `2` | Minimum active database connections in connection pool. |
| `DB_POOL_MAX` | `10` | Maximum connection pool capacity. |
| `REDIS_URL` | `redis://127.0.0.1:6379/0` | Cache & pub/sub broker for real-time safety alert broadcasts. |

### Logging & Telemetry
| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `LOG_LEVEL` | `INFO` | Verbosity level (`DEBUG`, `INFO`, `WARNING`, `ERROR`). |
| `LOG_DIR` | `./logs` | Filesystem directory for daily rotated JSON structured logs. |
| `ALERT_DISPATCH_EMAIL` | `soc@railnet.gov.in` | Target email recipient for automated P1 safety escalations. |

---

## 2. AI Model Hyperparameters & IRPWM Weights

The Defect Prioritization Engine calculates a composite score $S \in [0, 100]$ based on normalized feature weights calibrated to **IRPWM 2020 Para 602**:

### Feature Importance Weights (`weights.json`)
```json
{
  "safety_severity": 0.22,
  "traffic_density": 0.14,
  "failure_probability": 0.12,
  "overdue_days": 0.12,
  "asset_criticality": 0.10,
  "redundancy_factor": 0.08,
  "inspection_source_weight": 0.06,
  "defect_age": 0.06,
  "department_weight": 0.05,
  "location_criticality": 0.05
}
```

### Priority Classification Matrix
| Category | Score Range | SLA Window | Description & Action Required |
| :---: | :---: | :---: | :--- |
| **P1** | $\ge 85.0$ | **24 Hours** | **Critical Safety Threat**: Emergency block sanction required. Immediate speed restriction or rail replacement. |
| **P2** | $70.0 - 84.9$ | **72 Hours** | **High Priority**: Urgent corrective attention. Bundled into upcoming shadow corridor. |
| **P3** | $50.0 - 69.9$ | **7 Days** | **Medium Priority**: Standard defect. Formulated into weekly corridor plan. |
| **P4** | $< 50.0$ | **30 Days** | **Routine Maintenance**: Regular track monitoring and inspection cycling. |

---

## 3. Traffic Analyzer & Corridor Preference Configuration

Parameters controlling corridor window discovery and timetable de-confliction:

```json
{
  "search_horizon_days": 3,
  "granularity_minutes": 15,
  "minimum_block_duration_minutes": 60,
  "maximum_conflicts_allowed": 2,
  "time_preferences": {
    "preferred_night_start_hour": 23,
    "preferred_night_end_hour": 5,
    "night_corridor_bonus": 0.25,
    "afternoon_lull_start_hour": 12,
    "afternoon_lull_end_hour": 15,
    "afternoon_bonus": 0.10,
    "peak_commuter_penalty": 0.35
  }
}
```

---

## 4. Multi-Department Safety & Compatibility Matrix

Before bundling tasks into a single track block, the Bundling Engine evaluates cross-department hazards:

| Department A | Department B | Joint Bundling Permitted? | Required Operational Safety Precautions |
| :--- | :--- | :---: | :--- |
| **Civil (Track)** | **TRD (OHE Traction)** | ✅ **YES** | Simultaneous track possession and OHE power isolation block. |
| **Civil (Track)** | **S&T (Signalling)** | ✅ **YES** | Disconnection notice issued to Station Master; track circuits clamped. |
| **TRD (OHE)** | **S&T (Signalling)** | ✅ **YES** | Traction return bonding verified prior to power isolation restoration. |
| **Heavy Track Tamper** | **Manual Welding** | ⚠️ **CONDITIONAL** | Physical separation distance $\ge 500\text{m}$ enforced by CP-SAT. |
| **OHE Mast Erection**| **Crane Operations** | ⚠️ **RESTRICTED** | Complete isolation of adjacent running line required. |

---

## 5. Railway.app PaaS Configuration (`railway.json`)

When deploying on Railway.app, the following configuration defines build and deployment stages:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "node backend/api/ai-api.js",
    "healthcheckPath": "/api/v1/ai/models/info",
    "healthcheckTimeout": 15,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 5
  }
}
```
