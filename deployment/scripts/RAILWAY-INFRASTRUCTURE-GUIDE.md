# Indian Railways AI Maintenance Platform — Infrastructure Deployment Guide

## 1. Executive Infrastructure Overview

The **Indian Railways AI Maintenance Platform (IR-AIMP)** is designed as an enterprise-grade, high-availability distributed system capable of serving all 17 Railway Zones and 68 Operating Divisions. The architecture supports deployment across:

1. **CRIS On-Premises Enterprise Clusters**: Primary Data Center (Chanakyapuri, New Delhi) & Disaster Recovery (DR) Site (Secunderabad).
2. **Cloud / Hybrid Kubernetes Environments**: Production K8s clusters with Horizontal Pod Autoscaling (HPA) and Pod Disruption Budgets.
3. **Railway.app / Container PaaS**: Modern containerized PaaS deployment for regional sandboxes, staging clusters, and rapid prototyping.

```mermaid
flowchart TD
    subgraph Edge & Field Layer
        USFD[USFD Track Cars] --> Gateway[API Gateway / Ingress]
        TRC[Track Recording Cars] --> Gateway
        Drone[Drone LiDAR Feeds] --> Gateway
        IoT[Axle Counters & IoT] --> Gateway
    end

    subgraph "Railway Infrastructure Tier (CRIS / K8s / Railway)"
        Gateway --> AuthRate[Auth & Rate Limiting Middleware]
        AuthRate --> NodeBackend[Node.js AI API Gateway]
        
        NodeBackend --> PriorityService[ai-priority-service\nRandomForest & XGBoost]
        NodeBackend --> TrafficService[ai-traffic-service\nDelay & Headway Predictor]
        NodeBackend --> OptimizerService[ai-optimizer-service\nGoogle OR-Tools CP-SAT]
        
        PriorityService --> Postgres[(PostgreSQL DB\nTimetables & Defects)]
        TrafficService --> Postgres
        OptimizerService --> Postgres
        
        PriorityService --> Redis[(Redis Cache\nPredictions & Slots)]
        TrafficService --> Redis
    end

    subgraph "Observability & Alerting"
        Prometheus[Prometheus Server] --> PriorityService
        Prometheus --> TrafficService
        Prometheus --> OptimizerService
        Prometheus --> Grafana[Grafana Dashboards]
        Prometheus --> AlertManager[AlertManager\n(SMS/Email to Control Office)]
    end
```

---

## 2. Deployment Automation Suite (`/deployment/scripts/`)

| Script | Purpose | Key Flags / Parameters |
|---|---|---|
| [`setup-development.sh`](file:///c:/Users/ry729/.gemini/antigravity-ide/scratch/indian-railways-ai/deployment/scripts/setup-development.sh) | Sets up local developer sandbox (Python venv, Node, DB seeds). | `--docker`, `--skip-python`, `--skip-db`, `--port-api`, `--port-backend` |
| [`setup-staging.sh`](file:///c:/Users/ry729/.gemini/antigravity-ide/scratch/indian-railways-ai/deployment/scripts/setup-staging.sh) | Deploys containerized staging/UAT environment with smoke tests. | `--target [docker\|k8s\|railway]`, `--rebuild`, `--tag <version>`, `--clean` |
| [`setup-production.sh`](file:///c:/Users/ry729/.gemini/antigravity-ide/scratch/indian-railways-ai/deployment/scripts/setup-production.sh) | Zero-downtime rolling deployment to CRIS Enterprise data centers. | `--namespace`, `--version-tag`, `--site [CRIS-DELHI\|CRIS-DR]`, `--dry-run` |
| [`backup-database.sh`](file:///c:/Users/ry729/.gemini/antigravity-ide/scratch/indian-railways-ai/deployment/scripts/backup-database.sh) | Automated compressed backup with SHA-256 integrity check and 30-day retention. | `--label <tag>`, `--output-dir`, `--retention-days <N>`, `--schema-only` |
| [`restore-database.sh`](file:///c:/Users/ry729/.gemini/antigravity-ide/scratch/indian-railways-ai/deployment/scripts/restore-database.sh) | Safe database restoration with pre-restore safeguard snapshot. | `--file <path>`, `--force`, `--verify-only`, `--no-snapshot` |
| [`security-scan.sh`](file:///c:/Users/ry729/.gemini/antigravity-ide/scratch/indian-railways-ai/deployment/scripts/security-scan.sh) | SAST, secret leak scanner, CIS Docker linting, and CVE audit. | `--fail-on-high`, `--report-dir`, `--skip-dependencies` |
| [`performance-test.sh`](file:///c:/Users/ry729/.gemini/antigravity-ide/scratch/indian-railways-ai/deployment/scripts/performance-test.sh) | Multi-threaded concurrency load testing against SLA latency gates. | `--requests <N>`, `--concurrency <C>`, `--endpoint <URL>`, `--sla-p95 <ms>` |

---

## 3. Railway Infrastructure Deployment Options

### Option A: Railway.app Cloud Deployment

To deploy on [Railway.app](https://railway.app):

1. **Install Railway CLI**:
   ```bash
   npm install -g @railway/cli
   railway login
   ```
2. **Initialize Project**:
   ```bash
   railway init --name indian-railways-ai
   ```
3. **Provision Managed PostgreSQL & Redis**:
   ```bash
   railway add --plugin postgresql
   railway add --plugin redis
   ```
4. **Configure Environment Variables**:
   ```bash
   railway variables --set NODE_ENV=production
   railway variables --set AI_API_KEYS="ir-ai-prod-2026,cris-officer-token"
   railway variables --set LOG_LEVEL=INFO
   railway variables --set DEFAULT_TIMEZONE="Asia/Kolkata"
   ```
5. **Deploy Microservices**:
   ```bash
   ./deployment/scripts/setup-staging.sh --target railway
   ```

---

### Option B: On-Premises CRIS Enterprise Kubernetes Deployment

For Indian Railways data centers at CRIS Chanakyapuri (Delhi) and Secunderabad:

1. **Verify Kubernetes Cluster Connection**:
   ```bash
   kubectl config use-context cris-delhi-production
   ```
2. **Execute Production Rollout with Pre-Deployment Backup**:
   ```bash
   ./deployment/scripts/setup-production.sh --version-tag v1.2.0 --site CRIS-DELHI
   ```
3. **Inspect Pod Health & Rolling Status**:
   ```bash
   kubectl get pods -n ir-ai-production -o wide
   kubectl top pods -n ir-ai-production
   ```
4. **Autoscaling Configuration**:
   The `ai-priority-service` and `ai-traffic-service` are pre-configured with Kubernetes HPA (Horizontal Pod Autoscaler) scaling between 3 and 12 replicas when CPU exceeds 75% or memory exceeds 80%.

---

## 4. Disaster Recovery (DR) & Business Continuity Plan

- **RPO (Recovery Point Objective)**: $\le 15 \text{ minutes}$ (continuous PostgreSQL WAL archiving + daily scheduled backups via `backup-database.sh`).
- **RTO (Recovery Time Objective)**: $\le 5 \text{ minutes}$ (Active-Active secondary deployment at CRIS Secunderabad with DNS failover).
- **Manual Failover Execution**:
  ```bash
  # Step 1: Restore latest backup snapshot at DR site
  ./deployment/scripts/restore-database.sh --file database/backups/latest.sql.gz --force

  # Step 2: Reroute ingress traffic to Secunderabad cluster
  ./deployment/scripts/setup-production.sh --site CRIS-DR-SECUNDERABAD --version-tag v1.2.0
  ```

---

## 5. Security & SLA Quality Gates

Before any production deployment, execute the security and performance quality gates:

```bash
# 1. Run security vulnerability scan (must have 0 Critical / High findings)
./deployment/scripts/security-scan.sh --fail-on-high

# 2. Run concurrency benchmark (must pass P95 < 100ms)
./deployment/scripts/performance-test.sh --requests 500 --concurrency 25 --sla-p95 100
```
