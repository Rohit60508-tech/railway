# Installation Guide — Indian Railways AI Platform
### Comprehensive Setup, Environment Provisioning & System Verification

---

## 1. System Requirements

### Hardware Sizing
| Environment | CPU Cores | Memory (RAM) | Storage (NVMe/SSD) | Network |
| :--- | :--- | :--- | :--- | :--- |
| **Local Development** | 2 Cores | 4 GB | 20 GB free | 10 Mbps |
| **Staging / Test** | 4 Cores | 8 GB | 60 GB free | 100 Mbps |
| **Production (Zonal)** | 8 Cores | 16–32 GB | 250 GB RAID-10 | 1 Gbps redundant |
| **Production (HQ/DR)** | 16 Cores | 64 GB | 1 TB Enterprise | 10 Gbps RailTel |

### Software Prerequisites
- **Node.js**: v18.16.0 LTS or v20.x (`node -v`)
- **Python**: v3.10.x, v3.11.x, or v3.12.x (`python --version`)
- **PostgreSQL**: v15 or v16 (with optional TimescaleDB extension for rail sensor telemetry)
- **Git**: v2.35+ (`git --version`)
- **Docker & Docker Compose** (optional for containerized setup): v24.0+

---

## 2. Local Development Setup

### Step 1: Clone Repository
```powershell
git clone https://github.com/IndianRailways/ai-block-planner.git
cd ai-block-planner
```

### Step 2: Python Virtual Environment
Create and activate an isolated virtual environment:

**On Windows (PowerShell):**
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```

**On Linux / macOS:**
```bash
python3 -m venv venv
source venv/bin/activate
```

### Step 3: Install Python AI Dependencies
Install the required AI, operations research, and web frameworks:
```powershell
pip install --upgrade pip
pip install fastapi uvicorn[standard] pydantic ortools pandas numpy scikit-learn psycopg2-binary
```

### Step 4: Configure Environment Variables
Copy and customize the development environment settings:
```powershell
cp .env.example .env
```
Edit `.env` (or accept defaults for local standalone mode):
```ini
NODE_ENV=development
PORT=8000
AI_SERVICE_URL=http://127.0.0.1:5000
AI_TIMEOUT_MS=15000
AI_EXECUTION_STRATEGY=REST_FIRST
DATABASE_URL=postgresql://ir_app:railway2026@localhost:5432/ir_maintenance
IR_API_KEY=ir-ai-key-2026
LOG_LEVEL=INFO
```

---

## 3. Database Initialization

### PostgreSQL Local Setup (Optional)
If running a live database rather than synthetic memory fixtures:
```powershell
# Create database and user
psql -U postgres -c "CREATE USER ir_app WITH PASSWORD 'railway2026';"
psql -U postgres -c "CREATE DATABASE ir_maintenance OWNER ir_app;"

# Apply DDL schema and initial seed data
psql -U ir_app -d ir_maintenance -f database/schema/init-schema.sql
```

> **Note**: If PostgreSQL is offline or unreachable, the system automatically falls back to synthetic high-fidelity timetables and defect fixtures without failing startup.

---

## 4. Running the Platform Locally

### Terminal 1: Python AI Microservice (FastAPI + OR-Tools)
```powershell
python ai-models/inference/app.py
```
*Output confirmation:*
```
INFO: Uvicorn running on http://127.0.0.1:5000 (Press CTRL+C to quit)
INFO: AI Microservice ready: DefectPrioritizer, TrafficAnalyzer, BlockOptimizer initialized.
```

### Terminal 2: Node.js Backend Gateway
```powershell
node backend/api/ai-api.js
```
*Output confirmation:*
```
[IR-AI Gateway] Server active on port 8000 (Prefix: /api/v1/ai)
[Health] All connectors online. Dual-mode execution strategy: REST_FIRST.
```

### Terminal 3: Web Client / Static Frontend
Serve the frontend root:
```powershell
npx serve -l 3000 .
```
Access the portals:
- Web Landing Page: `http://localhost:3000/index.html`
- Executive Admin AI Dashboard: `http://localhost:3000/frontend/pages/admin-dashboard.html`
- Control Office Console: `http://localhost:3000/frontend/pages/control-office.html`
- Maintenance Cell Dashboard: `http://localhost:3000/frontend/pages/maintenance-dashboard.html`
- Surveillance Inspector UI: `http://localhost:3000/frontend/pages/surveillance-dashboard.html`
- AI Model Management: `http://localhost:3000/frontend/pages/ai-model-management.html`

---

## 5. Automated Verification & Acceptance Run

Run the master test orchestrator to ensure 100% compliance across all 12 test suites:
```powershell
node testing/run-all-tests.js
```
Expected output:
```
=================================================================
  INDIAN RAILWAYS AI PLATFORM — MASTER TEST SUITE RUNNER         
=================================================================
MASTER TEST SUMMARY: 12/12 test suites passed
>>> STATUS: ALL TESTS PASSED! RAILWAY ACCEPTANCE CRITERIA MET <<<
```

---

## 6. Railway Cloud & Container Deployment

### Docker Compose
To launch all services (Python AI daemon, Node.js API gateway, PostgreSQL, Redis) via Docker:
```powershell
docker compose -f deployment/docker/docker-compose.yml up -d --build
```

### Deploying on Railway.app (PaaS)
1. **Repository Link**: Connect your Git repository to Railway.
2. **Dual Service Configuration**:
   - **Service 1 (Python AI)**: Set Root Directory to `/`, Start Command: `uvicorn ai-models.inference.app:app --host 0.0.0.0 --port $PORT`.
   - **Service 2 (Node Gateway)**: Set Start Command: `node backend/api/ai-api.js`.
3. **Environment Variable Linking**:
   - In Service 2, set `AI_SERVICE_URL=http://${{Service1.RAILWAY_PRIVATE_DOMAIN}}:5000`.
   - Set `IR_API_KEY` and `PORT`.
4. **Health Check Path**: Configure `/api/v1/health` in Railway project settings with a 15-second grace period.
