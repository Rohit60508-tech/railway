# Deployment Procedures — Indian Railways AI Platform
### Production Runbooks, Cloud PaaS (Railway.app), Zonal Infrastructure & Disaster Recovery

---

## 1. Deployment Topologies

The platform supports two deployment topologies:
1. **Cloud PaaS (Railway.app / AWS / GCP)**: Containerized microservices with managed Postgres/Redis, ideal for staging, DR, and divisional pilot corridors.
2. **Indian Railways Enterprise Cloud (RailTel Tier-IV Data Centers)**: High-security air-gapped on-premises deployment adhering to RDSO and Ministry of Railways critical infrastructure standards.

```
                          CLOUD & ON-PREMISES DEPLOYMENT
                          
       Internet / RailTel WAN                    Railway SOC (SIEM)
                 │                                        ▲
                 ▼                                        │ (Syslog/TLS)
       ┌───────────────────┐                              │
       │ Cloudflare / WAF  │ ──► [ Rate Limiting & TLS 1.3 Termination ]
       └─────────┬─────────┘
                 │
                 ▼
       ┌───────────────────┐
       │ Ingress / Gateway │ ──► Port 8000 (Node.js API Gateway)
       └─────────┬─────────┘
                 │
         ┌───────┴────────────────────────┐
         ▼                                ▼
┌──────────────────┐            ┌──────────────────┐
│ Python AI Engine │            │ Web UI & Assets  │
│ (FastAPI: 5000)  │            │ (Static CDN/S3)  │
└────────┬─────────┘            └──────────────────┘
         │
         ▼
┌──────────────────┐
│ PostgreSQL 16    │ ◄── Automated SHA-256 Daily Encrypted Backups
│ (TimescaleDB)    │
└──────────────────┘
```

---

## 2. Automated Deployment Scripts

All operational deployment scripts are located in `deployment/scripts/`:

### 1. Staging Environment Deployment
```bash
bash deployment/scripts/setup-staging.sh
```
*Actions Executed:*
- Sets `NODE_ENV=staging`
- Provisions staging PostgreSQL schema with migration checks
- Runs unit, integration, and security test suites
- Spawns services with verbose staging telemetry

### 2. Production Environment Deployment
```bash
bash deployment/scripts/setup-production.sh
```
*Actions Executed:*
- Enforces strict environment variable validation (`JWT_SECRET`, `IR_API_KEY`)
- Validates TLS 1.3 certificates in `security/certificates/`
- Compiles production bundles and runs pre-flight health checks
- Spawns background daemon processes under process supervisor (systemd / PM2)
- Dispatches deployment audit log to Railway SOC

### 3. Automated Database Backup & Verification
```bash
bash deployment/scripts/backup-database.sh
```
*Actions Executed:*
- Executes `pg_dump` with gzip compression
- Computes SHA-256 checksum for backup integrity verification
- Encrypts backup archive using AES-256
- Retains daily backups for 30 days and weekly backups for 1 year

### 4. Database Restoration Procedure
```bash
bash deployment/scripts/restore-database.sh /path/to/backup.sql.gz
```
*Actions Executed:*
- Verifies SHA-256 checksum
- Terminates existing connections to `ir_maintenance`
- Replays DDL and DML state atomically inside a single transaction

### 5. Automated Security Vulnerability Scan
```bash
bash deployment/scripts/security-scan.sh
```
*Actions Executed:*
- Scans dependencies for known CVEs (`npm audit`, `pip-audit`)
- Performs static code analysis for hardcoded secrets and OWASP Top 10 vulnerabilities
- Validates TLS certificate expiration dates and cipher suites

---

## 3. Deploying to Railway.app PaaS

### Step-by-Step Procedure
1. **Initialize Project**:
   ```bash
   railway login
   railway init
   ```
2. **Provision Managed PostgreSQL**:
   Add a PostgreSQL database service via the Railway dashboard or CLI:
   ```bash
   railway add --database postgres
   ```
3. **Configure Environment Variables**:
   In Railway Dashboard -> Variables, link the database connection and set:
   ```env
   NODE_ENV=production
   PORT=8000
   AI_SERVICE_URL=http://127.0.0.1:5000
   AI_TIMEOUT_MS=20000
   DATABASE_URL=${{Postgres.DATABASE_URL}}
   IR_API_KEY=ir-prod-sec-key-9910
   JWT_SECRET=super_strong_railway_jwt_secret_2026
   ```
4. **Deploy Application**:
   ```bash
   railway up
   ```
5. **Verify Health**:
   Query the public production URL:
   ```bash
   curl -i https://<your-railway-app>.up.railway.app/api/v1/ai/models/info
   ```

---

## 4. Zero-Downtime AI Model Retraining & Hot-Reload

When new track recording car datasets arrive:
1. **Trigger Retraining**:
   ```bash
   curl -X POST https://<api-url>/api/v1/ai/models/retrain \
     -H "X-API-Key: $IR_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"epochs": 50, "validation_split": 0.2}'
   ```
2. **Model Evaluation Gate**:
   The retrained model is evaluated against the current production model. If validation accuracy decreases or latency exceeds 100ms, the update is rejected.
3. **Atomic Swap**:
   The Python AI daemon reloads model weights in memory using atomic file pointer swaps without terminating in-flight block scheduling queries.

---

## 5. High Availability (HA) & Disaster Recovery (DR)

- **RTO (Recovery Time Objective)**: $< 15\text{ minutes}$
- **RPO (Recovery Point Objective)**: $< 1\text{ hour}$
- **Zonal Redundancy**: Primary active region (Northern Railway DC, New Delhi) with active-standby replica in secondary region (North Central Railway DC, Prayagraj).
- **Heartbeat Monitoring**: HealthMonitor runs automated 30-second audit sweeps. If 3 consecutive failures occur, traffic is automatically rerouted to the DR site via DNS failover.
