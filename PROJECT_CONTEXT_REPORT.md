# Technical Project Context Report: RAKSHA PATH — AI Railway Maintenance & Block Coordination Platform

> **Document Type:** System Architecture & Technical Context Reference  
> **Target Audience:** AI Engineering Assistants & System Maintainers  
> **Environment:** Node.js (v20+), Python (FastAPI/CP-SAT/XGBoost), PostgreSQL / Supabase, Vanilla ES6+ Web Components  
> **Classification:** Technical Reference Manual (No credentials or secrets included)

---

## 1. PROJECT OVERVIEW

### 1.1 What This Application Does
**RAKSHA PATH (Railway Asset Knowledge & Safety Harmonic Automation)** is an enterprise Indian Railways operations platform designed to eliminate train headway delays, avoid collision of maintenance blocks with high-priority passenger rakes (such as Vande Bharat, Rajdhani, Shatabdi, and commuter EMUs), and orchestrate multi-department maintenance slot allocation across dense railway corridors (e.g., NDLS–CNB, GZB–ALJN).

### 1.2 Main Purpose
* **De-confliction & Block Window Optimization:** Calculate zero-disruption / low-disruption maintenance slots on active corridors using constraint satisfaction (Google OR-Tools CP-SAT) and live telemetry (RailRadar / COA).
* **Multi-Department Co-Possession Bundling:** Bundle civil track work (P-Way/TMS), overhead catenary maintenance (TRD/TDMS), and signaling overhauls (S&T/SMMS) into unified block possessions to minimize track closure time.
* **Tamper-Evident Audit & Safety Compliance:** Cryptographically hash-chain (SHA-256) all operator actions, overrides, slot sanctions, and statutory fitness certifications (`T-351`, `IR-FIT`).
* **Closed-Loop Asset Lifecycle:** Ensure maintenance requests flow strictly from initial field requisition $\to$ Control Office conflict evaluation $\to$ sanction/approval $\to$ field gang execution $\to$ statutory safety certification $\to$ defect rectification in persistent cloud storage.

### 1.3 Intended Users
1. **Section Controllers / Control Officers:** Monitor 24-hour corridor headway density, detect live train conflicts, sanction AI-recommended slots, apply alternative windows, or issue force-sanction overrides under operational exigency.
2. **Field Maintenance Engineers (Senior Section Engineers - SSEs / P-Way / TRD / S&T):** Submit possession requisitions, accept and lock sanctioned slots, execute physical track work, and certify post-maintenance track geometry.
3. **Divisional Operations Managers (DOM / Sr. DOM):** Review corridor efficiency, Post-Block Yield, Disruption Recovery Rates (DRR), and audit logs.
4. **System Administrators / MLOps Engineers:** Monitor AI model inference latency, drift metrics, and system telemetry.

### 1.4 Major Modules
* **Control Office Decision Suite (`control-office.html`):** 24-hr corridor headway density timeline, live train conflict alerts, AI alternative slot suggestions, force sanction overrides, machine balancers, and EDFC emergency reroutes.
* **Maintenance Requisition Portal (`maintenance-requests.html`):** Field submission of block possession requests, corridor selection, department tagging, and urgent priority markers.
* **Maintenance Execution Dashboard (`maintenance-dashboard.html`):** 3-stage visual kanban for Sanctioned Work Orders $\to$ Accepted/In-Progress Work $\to$ Completed & Certified Closures.
* **Preventive Maintenance (PM) Scheduler (`pm-schedules.html`):** Recurring asset maintenance calendar and bulk CSV import.
* **Surveillance & Track Defect Center (`surveillance-dashboard.html`):** Defect ingestion, USFD rail flaw reports, and GIS track maps.
* **AI Model MLOps Management (`ai-model-management.html`):** Model registry, shadow mode evaluation, feature importance, and retraining triggers.
* **Audit & Integrity Ledger:** SHA-256 immutable ledger tracking all operations across local JSONL storage and Supabase Cloud.

---

## 2. APPLICATION ARCHITECTURE

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   FRONTEND LAYER                                       │
│    Vanilla HTML5 / Modern ES6+ / CSS3 Glassmorphism / Chart.js / Leaflet GIS Maps      │
│  [control-office.html]  [maintenance-dashboard.html]  [maintenance-requests.html] etc. │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ HTTP REST / JSON Fetch / Long-Polling
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              NODE.JS WEB & API GATEWAY                                 │
│                                  (server.js :5000)                                     │
│  ├── Static File Server (HTML/CSS/JS/Assets)                                           │
│  ├── Supabase REST Data Gateway (`/api/v1/supabase/data/*`)                            │
│  ├── Control Office Handlers (`/api/v1/apply-alternative-window`, `/force-sanction...`) │
│  ├── Audit Ledger API (`/api/v1/supabase/audit-log`, `/audit-logs`)                    │
│  ├── Live Train Gateway Proxy (RailRadar IRCTC Telemetry / COA Timetable)              │
│  └── Python Dispatcher Proxy (`/api/v1/ai/*` ➔ 127.0.0.1:5001)                         │
└───────────────────────┬──────────────────────────────────────┬─────────────────────────┘
                        │                                      │
            Internal Service Calls                   FastAPI Proxy / JSON
                        │                                      │
                        ▼                                      ▼
┌──────────────────────────────────────────────┐  ┌──────────────────────────────────────┐
│       NODE.JS PERSISTENCE & AUDIT LAYER      │  │        PYTHON AI BACKEND             │
│   (backend/services/supabase-client.js)      │  │   (ai-models/inference/open_data_api │
│  ├── Supabase Cloud PostgREST Client         │  │    & priority-engine / block-opt)    │
│  ├── Table Schema Filter & Name Mapping      │  │  ├── CP-SAT Window Optimization     │
│  ├── Canonical Key Dispatcher                │  │  ├── XGBoost Priority Scorer         │
│  ├── SHA-256 Cryptographic Audit Chainer     │  │  └── Conflict Detection Engine       │
│  └── Local Mirror Cache (`supabase_tables`)  │  └──────────────────────────────────────┘
└───────────────────────┬──────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               DATABASE & PERSISTENCE LAYER                             │
│  1. PRIMARY (SOURCE OF TRUTH): Supabase Cloud PostgreSQL (PostgREST REST API)          │
│     Tables: requested_maintenance_windows, maintenance_defects, track_sections,        │
│             block_schedules, corridor_windows, immutable_action_audit_log              │
│  2. AUDIT TRAIL: Append-Only Immutable Ledger (`data/immutable_audit_ledger.jsonl`)    │
│  3. LOCAL MIRROR CACHE: Local JSON Store (`data/supabase_tables.json`)                 │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Technology Stack
* **Frontend:** Vanilla HTML5, ES6 Modules/Classes, CSS Variables, Custom Web Components, Chart.js, Leaflet.js (GIS), QRCode.js. No Tailwind runtime.
* **Primary Backend:** Node.js (Native HTTP server in `server.js`, port 5000).
* **AI/Optimization Backend:** Python 3.10+ (FastAPI, Google OR-Tools CP-SAT, XGBoost, Scikit-learn, port 5001).
* **Primary Database:** Supabase Cloud PostgreSQL with PostgREST Data API & Row Level Security (RLS).
* **Communication:** Asynchronous `fetch` HTTP REST queries with JSON payloads; periodic polling for conflict refresh and audit synchronizations.
* **Authentication/Authorization:** Client session persistence in `localStorage` (`ir_ai_session`, `ir_user_store`) with role-based UI restriction mapping (`ROLE_DEPT_MAP` in `main.js`).

---

## 3. FRONTEND STRUCTURE

```
frontend/
├── pages/
│   ├── login.html                   # Authentication entry point & role selector
│   ├── control-office.html          # Section Controller live decision & conflict center
│   ├── maintenance-dashboard.html   # 3-stage Work Order kanban & statutory certification
│   ├── maintenance-requests.html    # Maintenance window requisition portal
│   ├── pm-schedules.html            # Preventive maintenance schedules & bulk loader
│   ├── surveillance-dashboard.html  # Track defect surveillance, USFD & GIS view
│   ├── ai-model-management.html     # MLOps, model retraining, shadow evaluation
│   ├── admin-dashboard.html         # Executive system admin & access control
│   └── project-summary.html         # High-level architecture & KPI summaries
```

### 3.1 Key Pages Detail

#### A. Control Office (`control-office.html`)
* **Purpose:** Real-time train conflict resolution and corridor maintenance possession sanctioning.
* **Key User Actions:** "Sanction Block Window", "Apply AI Alternative", "Force Sanction", manual train regulation/rerouting.
* **Important JS Functions:**
  * `applyAlternativeSlot(conflictId, altWindow)`: Invokes `/api/v1/apply-alternative-window` to shift the window.
  * `forceSanctionConflict(conflictId)`: Invokes `/api/v1/force-sanction-window` to override conflicts.
  * `sanctionSlot(slotId, windowTime)`: Updates window to `SANCTIONED` in Supabase Cloud.
  * `fetchLiveConflicts()` / `fetchLiveRecommendedSlots()`: Fetches corridor conflicts from live RailRadar/COA API.
* **APIs Called:** `POST /api/v1/apply-alternative-window`, `POST /api/v1/force-sanction-window`, `PATCH /api/v1/supabase/data/requested_windows`, `POST /api/v1/supabase/audit-log`.
* **Database Entities:** `requested_maintenance_windows`, `immutable_action_audit_log`, `corridor_windows`.

#### B. Maintenance Dashboard (`maintenance-dashboard.html`)
* **Purpose:** Work order execution management across Civil (P-Way), Electrical (TRD), Signaling (S&T), and Mechanical departments.
* **Key User Actions:** Accept and lock sanctioned slots, execute physical work, certify statutory technical reports, log closure memos (`T-351`).
* **Important JS Functions:**
  * `fetchApprovedWorkOrders()`: Rehydrates dashboard state from Supabase Cloud `requested_maintenance_windows`.
  * `acceptWorkOrder(woId)`: Sends `PATCH` with `status: 'ACCEPTED'` to database.
  * `handleCompletionFormSubmit(e)`: Sends `PATCH` with `status: 'COMPLETED'`, records statutory safety data, and auto-triggers defect rectification.
  * `renderWorkOrders(filterDept)`: Renders 3 sections based on `isSanctioned`, `isAccepted`, and `isCompleted`.
* **APIs Called:** `GET /api/v1/requested-windows`, `PATCH /api/v1/supabase/data/requested_windows`, `POST /api/v1/supabase/audit-log`.
* **Database Entities:** `requested_maintenance_windows`, `maintenance_defects`, `immutable_action_audit_log`.

#### C. Maintenance Requests Portal (`maintenance-requests.html`)
* **Purpose:** Field requisition submission for track, catenary, and signal maintenance blocks.
* **Key User Actions:** Fill requisition modal, select section, times, department, submit to Control Office.
* **Important JS Functions:**
  * `handleCreateRequestSubmit(e)`: Inserts new record with `status: 'PENDING_REVIEW'`.
  * `loadPersistedRequests()`: Fetches submitted requests from database.
* **APIs Called:** `POST /api/v1/requested-windows`, `GET /api/v1/requested-windows`.
* **Database Entities:** `requested_maintenance_windows`.

---

## 4. BACKEND STRUCTURE

```
backend/
├── server.js                      # Central HTTP/REST API Gateway & static server
├── services/
│   ├── supabase-client.js         # Core database client, table mapper, schema filter & audit ledger
│   ├── ai-service-connector.js    # Node-to-Python HTTP bridge
│   ├── defect-validator.js        # Defect ingestion validation
│   ├── block-optimizer.js         # Fallback heuristics for slot optimization
│   └── priority-engine.js         # Fallback composite priority scorer
```

### 4.1 Key Backend Files

#### `server.js`
* Listens on `PORT=5000`.
* Serves static frontend assets (`.html`, `.js`, `.css`, `.png`, `.jpg`).
* Handles direct API routes:
  * `/api/v1/requested-windows` (GET, POST)
  * `/api/v1/apply-alternative-window` (POST)
  * `/api/v1/force-sanction-window` (POST)
  * `/api/v1/supabase/data/:table` (GET, POST, PATCH, PUT, DELETE)
  * `/api/v1/supabase/audit-log` & `/api/v1/supabase/audit-logs` (POST, GET)
  * `/api/v1/live-corridor-conflicts` (POST)
* Proxies unhandled `/api/v1/ai/*` calls to the Python backend on `127.0.0.1:5001`.

#### `backend/services/supabase-client.js`
* Encapsulates all PostgREST Cloud REST communication using Node `fetch`.
* Contains `mapTableName(table)` mapping alias `requested_windows` $\to$ PostgreSQL table `requested_maintenance_windows`.
* Contains `filterPayloadForTable(table, payload)` preventing `PGRST204` schema cache errors by ensuring only valid PostgreSQL columns are transmitted in cloud payloads.
* Contains `saveActionAuditRecord()` creating SHA-256 chained audit records in `immutable_action_audit_log` and local append-only `immutable_audit_ledger.jsonl`.
* Contains `updateRecord()` with automatic defect status synchronization (`maintenance_defects.status = 'RECTIFIED'`) when a work order completes.

---

## 5. DATABASE ARCHITECTURE

### 5.1 Technology & Cloud Setup
* **Database:** PostgreSQL (Hosted on Supabase Cloud).
* **Interface:** Supabase PostgREST REST API (`https://<project-ref>.supabase.co/rest/v1/<table_name>`).
* **Authentication:** PostgREST Bearer Token / Service Role Key configured in `.env` (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).

### 5.2 PostgreSQL Table Catalog

```
                                  DATABASE ENTITY MAP
┌─────────────────────────────────┐                 ┌─────────────────────────────────┐
│         track_sections          │                 │       maintenance_defects       │
│ PK: section_id (VARCHAR)        │◄────────────────┤ PK: defect_id (UUID)            │
│ Start/End Station, KM, Speed    │  Foreign Key    │ Ref: section_id                 │
└───────────────┬─────────────────┘                 │ Status: PENDING ➔ RECTIFIED     │
                │                                   └────────────────┬────────────────┘
                │ Foreign Key                                        │ Linked by defect_ref_id
                ▼                                                    ▼
┌─────────────────────────────────┐                 ┌─────────────────────────────────┐
│  requested_maintenance_windows  │                 │   immutable_action_audit_log    │
│ PK: id (BIGINT IDENTITY)        │                 │ PK: id (UUID)                   │
│ Business Key: request_id (TEXT) │                 │ target_entity_id (request_id)   │
│ Status: PENDING ➔ SANCTIONED    │                 │ prev_hash ➔ record_hash         │
│         ➔ ACCEPTED ➔ COMPLETED  │                 │ SHA-256 Tamper-Proof Chain      │
└─────────────────────────────────┘                 └─────────────────────────────────┘
```

#### Table 1: `requested_maintenance_windows`
* **Purpose:** Stores all field-submitted maintenance possession requests and their lifecycle progression.
* **Primary Key:** `id` (`BIGINT GENERATED BY DEFAULT AS IDENTITY`).
* **Business Key:** `request_id` (`TEXT UNIQUE NOT NULL`, e.g., `'REQ-CIV-1042'`).
* **Important Fields:** `request_id`, `section_id`, `station_from`, `station_to`, `start_km`, `end_km`, `requested_window`, `window_start_time`, `window_end_time`, `duration_minutes`, `department`, `work_description`, `priority`, `status`, `applied_alternative`, `created_at`, `updated_at`.
* **Important Statuses:** `PENDING_REVIEW`, `SANCTIONED`, `APPROVED`, `ALTERNATIVE_APPLIED`, `FORCE_SANCTIONED`, `ACCEPTED`, `COMPLETED`.

#### Table 2: `maintenance_defects`
* **Purpose:** Ingests asset flaws and degradation records from TMS (Track), SMMS (Signals), and TDMS (OHE).
* **Primary Key:** `defect_id` (`UUID DEFAULT gen_random_uuid()`).
* **Business Key:** `external_ref_id` (`VARCHAR(100)`, e.g., `'DEF-001'`, `'WO-2026-TRD-109'`).
* **Important Fields:** `defect_id`, `external_ref_id`, `source_system`, `department`, `section_id`, `start_km`, `end_km`, `defect_type`, `severity`, `criticality_score`, `priority_score`, `priority_category`, `required_track_closure`, `status`, `created_at`, `rectified_at`.
* **Important Statuses:** `PENDING`, `ACTIVE_DEFECT`, `ACCEPTED`, `SCHEDULED`, `IN_PROGRESS`, `RECTIFIED`.

#### Table 3: `immutable_action_audit_log`
* **Purpose:** Cryptographically sealed append-only ledger of all controller decisions and maintenance certifications.
* **Primary Key:** `id` (`UUID DEFAULT gen_random_uuid()`).
* **Business Key:** `target_entity_id` (matches `request_id`, `slot_id`, or `defect_id`).
* **Important Fields:** `id`, `entry_name`, `event_type`, `staff_id`, `user_name`, `user_role`, `user_division`, `section`, `target_entity_id`, `reason`, `disruption_score`, `delay_minutes`, `action_payload`, `prev_hash`, `record_hash`, `is_immutable`, `client_ip`, `created_at`.

#### Table 4: `track_sections`
* **Purpose:** Master physical railway infrastructure inventory.
* **Primary Key / Business Key:** `section_id` (`VARCHAR(50)`, e.g., `'NDLS-CNB-UP'`, `'GZB-ALJN-DN'`).
* **Important Fields:** `section_id`, `division`, `start_station`, `end_station`, `start_km`, `end_km`, `max_permissible_speed`, `line_type`, `traffic_density_gmt`.

#### Table 5: `block_schedules`
* **Purpose:** Multi-department coordinated block possessions.
* **Primary Key / Business Key:** `block_id` (`VARCHAR(50)`, e.g., `'SLOT-NDLS-01'`, `'BNDL-001'`).
* **Important Fields:** `block_id`, `section_id`, `start_km`, `end_km`, `start_time`, `end_time`, `duration_minutes`, `status`, `departments_involved`, `efficiency_score`.

---

## 6. CURRENT DATA FLOW & LIFECYCLE PROGRESSION

```
  STEP 1: FIELD REQUISITION
  [User: Maintenance SSE] ──(Fills Form in maintenance-requests.html)
        │
        ▼
  POST /api/v1/requested-windows
        │
        ▼
  supabaseClient.insertRecord('requested_windows', payload)
        │
        ▼
  Supabase Cloud PostgreSQL [requested_maintenance_windows] ➔ status: "PENDING_REVIEW"
  (Record waits in Control Office queue; NOT yet active on Work Orders board)

─────────────────────────────────────────────────────────────────────────────────────────────

  STEP 2: CONTROL OFFICE EVALUATION & SANCTION
  [User: Section Controller] ──(Reviews Headway Conflicts in control-office.html)
        │
        ├── Action A: Sanction Window ────► PATCH /api/v1/supabase/data/requested_windows ➔ status: "SANCTIONED"
        ├── Action B: Apply Alt Slot  ────► POST /api/v1/apply-alternative-window ➔ status: "ALTERNATIVE_APPLIED"
        └── Action C: Force Sanction  ────► POST /api/v1/force-sanction-window ➔ status: "FORCE_SANCTIONED"
        │
        ▼
  supabaseClient.saveActionAuditRecord(...) ➔ Logged to immutable_action_audit_log (SHA-256 sealed)
  Supabase Cloud PostgreSQL [requested_maintenance_windows] updated

─────────────────────────────────────────────────────────────────────────────────────────────

  STEP 3: WORK ORDER ACCEPTANCE & LOCK
  [User: Maintenance Engineer] ──(Opens maintenance-dashboard.html)
        │
        ▼
  fetchApprovedWorkOrders() queries GET /api/v1/requested-windows
        │
        ▼
  Requisition appears under: "📋 Control Office Sanctioned Work Requisitions (Pending Acceptance)"
        │
        ▼
  User clicks "✓ Accept & Lock Slot" ──► PATCH /api/v1/supabase/data/requested_windows ➔ status: "ACCEPTED"
        │
        ▼
  UI shifts Work Order to: "📌 Work Accepted & Locked Slots (To Be Done / In Progress)"

─────────────────────────────────────────────────────────────────────────────────────────────

  STEP 4: WORK EXECUTION, STATUTORY FITNESS & DEFECT CLOSURE
  [User: Maintenance Engineer] ──(Executes Track Work & Fills Safety Dossier in Modal)
        │
        ▼
  User clicks "☑ Tick Work Completed" ──► PATCH /api/v1/supabase/data/requested_windows ➔ status: "COMPLETED"
        │
        ▼
  supabaseClient.updateRecord(...) automatically triggers linked defect update:
  Supabase Cloud PostgreSQL [maintenance_defects] ➔ status: "RECTIFIED", rectified_at: NOW()
        │
        ▼
  supabaseClient.saveActionAuditRecord(...) ➔ Certified completion logged to immutable audit ledger
  UI shifts Work Order to: "✅ Work Completed & Closed Requisitions"
```

---

## 7. DATABASE PERSISTENCE MODEL

### 7.1 Source of Truth vs. Cache vs. Audit Ledger

| Component | Target Location | Authority Level | Primary Purpose |
| :--- | :--- | :--- | :--- |
| **Source of Truth** | Supabase Cloud PostgreSQL | **Authoritative Ground Truth** | Primary persistent store for all domain entities (`requested_maintenance_windows`, `maintenance_defects`, `track_sections`, `block_schedules`). All frontend mutations must succeed here. |
| **Audit Log** | `immutable_action_audit_log` (Cloud) + `data/immutable_audit_ledger.jsonl` (Local) | **Immutable Safety Ledger** | Append-only SHA-256 cryptographic chain storing every operational event. Non-destructive; records cannot be modified or deleted. |
| **Local Mirror Cache** | `data/supabase_tables.json` | **Secondary Local Mirror / Fallback** | Read-through cache to hydrate offline servers or recover from transient cloud network outages. Cloud writes take absolute precedence. |

### 7.2 Persistence Rules & Integrity Safeguards
1. **No Fake Success:** If a Supabase Cloud operation fails (e.g. network timeout or invalid schema), the backend returns HTTP 400/500 with the exact error. It does **not** mask the failure with a fake HTTP 200 response.
2. **Schema Sanitization:** `filterPayloadForTable()` strips non-column client properties before PostgREST requests, preventing PostgREST `PGRST204` schema cache errors while preserving client metadata in the audit ledger.
3. **Clean-Start Protection:** If `data/supabase_tables.json` is missing or cleared, the application queries live data from Supabase Cloud first before initializing default fallback templates, preventing accidental cloud data overwrites.

---

## 8. API INVENTORY

| Method | Endpoint | Purpose | Request Body / Query | Database Tables Affected |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/requested-windows` | Fetch all requested maintenance windows | `?key=request_id&val=REQ-101` (optional) | `requested_maintenance_windows` |
| `POST` | `/api/v1/requested-windows` | Submit new maintenance possession request | JSON: `request_id`, `section_id`, `requested_window`, `department`, `priority` | `requested_maintenance_windows` |
| `POST` | `/api/v1/apply-alternative-window` | Shift window to AI alternative & sanction | JSON: `request_id`, `alternative_window`, `officer_id`, `reason` | `requested_maintenance_windows`, `immutable_action_audit_log` |
| `POST` | `/api/v1/force-sanction-window` | Section controller force-sanction override | JSON: `request_id`, `officer_id`, `reason`, `disruption_score` | `requested_maintenance_windows`, `immutable_action_audit_log` |
| `GET` | `/api/v1/supabase/data/:table` | Generic table query gateway | Query params: `?select=*&filterKey=...&filterVal=...` | Any allowed domain table |
| `POST` | `/api/v1/supabase/data/:table` | Generic record creation gateway | JSON record payload | Specified table |
| `PATCH` | `/api/v1/supabase/data/:table` | Generic canonical record update gateway | Query: `?key=request_id&val=...` + JSON update payload | Specified table + linked `maintenance_defects` |
| `POST` | `/api/v1/supabase/audit-log` | Append immutable SHA-256 audit entry | JSON: `entry_name`, `event_type`, `staff_id`, `target_entity_id`, `reason` | `immutable_action_audit_log` |
| `GET` | `/api/v1/supabase/audit-logs` | Fetch chronological audit history | Query: `?limit=50` | `immutable_action_audit_log` |
| `POST` | `/api/v1/live-corridor-conflicts` | Calculate live train clashes for location & window | JSON: `station_from`, `station_to`, `start_time`, `duration_minutes` | Read-only RailRadar / Timetable |

---

## 9. STATUS & STATE MACHINES

### 9.1 Maintenance Window Status Progression (`requested_maintenance_windows.status`)

```
               [ 1. PENDING_REVIEW ]  (Requisition created by Maintenance Team)
                         │
        ┌────────────────┼────────────────┐
        │                │                │
(Sanction Block) (Apply Alt Slot)  (Force Sanction)
        │                │                │
        ▼                ▼                ▼
  [ SANCTIONED ]  [ ALTERNATIVE_APPLIED ]  [ FORCE_SANCTIONED ]
        │                │                │
        └────────────────┬────────────────┘
                         │
                         ▼  (Maintenance Engineer clicks "✓ Accept & Lock Slot")
                  [ 2. ACCEPTED ]
                         │
                         ▼  (Maintenance Engineer clicks "☑ Tick Work Completed")
                  [ 3. COMPLETED ]
```

### 9.2 Defect Status Progression (`maintenance_defects.status`)

```
  [ ACTIVE_DEFECT / PENDING ]  (Detected by USFD / Sensor / Track Inspection)
               │
               ▼  (Triggered when linked Work Order completes in Supabase)
         [ RECTIFIED ]         (Timestamped with rectified_at in Cloud Database)
```

---

## 10. IDENTIFIERS & DOMAIN KEYS

To prevent cross-table ID collisions, the codebase enforces canonical keys:

| Identifier | Domain Entity | Typical Format | Example | Usage Rule |
| :--- | :--- | :--- | :--- | :--- |
| `request_id` | Requested Maintenance Window | `REQ-<DEPT>-<NUM>` | `REQ-CIV-4892` | **Must** be used for all updates to `requested_maintenance_windows`. |
| `defect_id` | Maintenance Defect (Cloud UUID) | UUID v4 | `9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d` | Used when querying `maintenance_defects` by Cloud primary key. |
| `external_ref_id`| Maintenance Defect (Business Key) | `DEF-<NUM>` / `WO-...` | `DEF-TMS-104` | Used when matching defects from external TMS/SMMS/TDMS systems. |
| `section_id` | Physical Track Section | `<FROM>-<TO>-<DIR>` | `NDLS-CNB-UP` | Primary foreign key referencing physical railway track sections. |
| `block_id` | Corridor Block Schedule / Bundle | `SLOT-...` / `BNDL-...` | `SLOT-NDLS-01` | Used when referencing corridor time slots and bundled possessions. |
| `id` | PostgreSQL Internal Surrogate Key | `BIGINT` (Identity) | `1, 2, 3...` | Internal PostgreSQL sequence key; **never** overwrite with string IDs. |

---

## 11. AUDIT SYSTEM & CRYPTOGRAPHIC LEDGER

### 11.1 Architecture
The audit system implements a tamper-evident blockchain-style hash chain:
$$\text{record\_hash} = \text{SHA256}(\text{prev\_hash} \mid \text{entry\_name} \mid \text{staff\_id} \mid \text{user\_name} \mid \text{target\_entity\_id} \mid \text{timestamp} \mid \text{action\_payload})$$

* **Genesis Hash:** `0000000000000000000000000000000000000000000000000000000000000000`
* **Storage Locations:**
  1. Cloud Database table `immutable_action_audit_log`.
  2. Local append-only JSONL file `data/immutable_audit_ledger.jsonl`.
* **Verification:** `supabaseAuditService.verifyIntegrity()` traverses the hash chain sequentially to detect any tampered or deleted records.

---

## 12. AI / ML COMPONENTS

### 12.1 Constraint Satisfaction Optimization (OR-Tools CP-SAT)
* **Location:** `ai-models/block-optimizer/` & `ai-models/inference/open_data_api.py`.
* **Purpose:** Solves the Multi-Disciplinary Block Scheduling Problem (MBSP) by finding collision-free windows that minimize passenger train regulation and freight dwell penalties.
* **Inputs:** Corridor section headway schedule, track closure constraints, gang resource requirements.
* **Outputs:** Ranked feasible slots with disruption scores (0–100) and synergy ratings.

### 12.2 Track Defect Risk Priority Model (XGBoost)
* **Location:** `ai-models/priority-engine/` & `backend/services/priority-engine.js`.
* **Purpose:** Composite risk index scoring ($0.0 - 100.0$) and urgency categorization ($P1 \to P4$).
* **Inputs:** Defect severity, track line speed (km/h), gross million tonnes (GMT), days overdue, track geometry parameters.
* **Outputs:** Composite priority score and SLA recommendation.

---

## 13. EXTERNAL SERVICES

| Service | Purpose | Protocol / Endpoint |
| :--- | :--- | :--- |
| **Supabase Cloud PostgreSQL** | Ground-truth cloud database & PostgREST API | HTTPS REST (`/rest/v1/*`) |
| **RailRadar Live IRCTC Telemetry** | Real-time train location, delays, and platform tracking | HTTPS REST (`api.railradar.in/v1/stations/...`) |
| **COA Master Timetable Gateway** | Control Office Application timetable fallback | In-Memory Indian Railways master timetable |
| **OpenStreetMap / CartoDB** | GIS track and station rendering on Leaflet maps | Tile server HTTPS |

---

## 14. KNOWN ISSUES & TECHNICAL DEBT

### Confirmed Items & Safeguards
* **Table Mapping:** Application code maps `requested_windows` to actual PostgreSQL table `requested_maintenance_windows`. Any future code must continue using the `mapTableName()` helper in `supabase-client.js`.
* **PostgreSQL Identity Keys:** `requested_maintenance_windows.id` is a `BIGINT`. Inserts must never pass string values into the `id` field.
* **Schema Strictness:** PostgREST will reject payloads containing extra non-column fields. All database writes must pass through `filterPayloadForTable()`.

### Potential Risks & Recommendations
1. **Python AI Process Dependency:** If the Python backend on port 5001 is offline, `server.js` routes AI requests through built-in Node.js analytical fallback models.
2. **Client Session Expiry:** Authentication is currently held in client `sessionStorage` / `localStorage`. Production deployments should consider Supabase Auth JWT cookies with HTTP-only flags.

---

## 15. MOST IMPORTANT FILES

| File | Path | Importance & Core Responsibility |
| :--- | :--- | :--- |
| **`server.js`** | [server.js](file:///c:/Users/monte/.gemini/antigravity-ide/scratch/railway/server.js) | **CRITICAL.** Main web server, API route definitions, Control Office endpoints, proxy handlers. |
| **`supabase-client.js`** | [backend/services/supabase-client.js](file:///c:/Users/monte/.gemini/antigravity-ide/scratch/railway/backend/services/supabase-client.js) | **CRITICAL.** Cloud PostgREST database layer, table mapping, schema filter, canonical key routing, audit ledger. |
| **`control-office.html`** | [frontend/pages/control-office.html](file:///c:/Users/monte/.gemini/antigravity-ide/scratch/railway/frontend/pages/control-office.html) | **HIGH.** Controller decision suite, conflict checking, window sanctions, and alternative slot logic. |
| **`maintenance-dashboard.html`** | [frontend/pages/maintenance-dashboard.html](file:///c:/Users/monte/.gemini/antigravity-ide/scratch/railway/frontend/pages/maintenance-dashboard.html) | **HIGH.** 3-stage Work Order lifecycle board, slot acceptance, statutory safety certification. |
| **`maintenance-requests.html`** | [frontend/pages/maintenance-requests.html](file:///c:/Users/monte/.gemini/antigravity-ide/scratch/railway/frontend/pages/maintenance-requests.html) | **HIGH.** Field maintenance requisition submission and validation portal. |
| **`open_data_api.py`** | [ai-models/inference/open_data_api.py](file:///c:/Users/monte/.gemini/antigravity-ide/scratch/railway/ai-models/inference/open_data_api.py) | **MEDIUM.** Python FastAPI AI inference backend for constraint satisfaction and conflict ranking. |
| **`supabase_full_schema.sql`**| [database/supabase_full_schema.sql](file:///c:/Users/monte/.gemini/antigravity-ide/scratch/railway/database/supabase_full_schema.sql) | **MEDIUM.** Reference DDL schema, indexes, and RLS policies for the Supabase PostgreSQL database. |

---

## 16. PROJECT DIRECTORY MAP

```
railway/
├── backend/
│   ├── config/                     # Environment configuration loaders
│   ├── models/                     # Data schemas
│   └── services/
│       ├── supabase-client.js      # Core Supabase PostgREST database & audit service
│       ├── ai-service-connector.js # Python bridge connector
│       ├── defect-validator.js     # Defect schema validator
│       └── priority-engine.js      # Heuristic fallback priority engine
├── frontend/
│   ├── components/                 # Reusable UI component modules (cards, badges, modals)
│   ├── css/                        # Shared stylesheets & theme tokens
│   ├── js/                         # Client utilities & state helpers
│   └── pages/                      # Application portal pages
│       ├── control-office.html
│       ├── maintenance-dashboard.html
│       ├── maintenance-requests.html
│       ├── pm-schedules.html
│       ├── surveillance-dashboard.html
│       ├── ai-model-management.html
│       └── login.html
├── ai-models/                      # Python ML & OR-Tools optimization engine
│   ├── block-optimizer/            # CP-SAT constraint solvers
│   ├── priority-engine/            # XGBoost priority models
│   └── inference/open_data_api.py  # FastAPI inference server (Port 5001)
├── database/                       # SQL schemas, migration scripts, and seed files
│   ├── supabase_full_schema.sql
│   └── supabase_immutable_audit.sql
├── data/                           # Local mirror caches & local audit ledger files
│   ├── immutable_audit_ledger.jsonl
│   └── supabase_tables.json
├── testing/                        # Automated end-to-end verification suites
│   ├── verify_all_priorities.js
│   └── test_maintenance_lifecycle_chain.js
├── server.js                       # Primary Node.js HTTP Server & API Gateway (Port 5000)
└── package.json                    # Project dependencies & startup scripts
```

---

## 17. CURRENT SYSTEM SUMMARY

1. **What does the website do?** De-conflicts railway maintenance block possessions with high-speed passenger traffic, bundles multi-department track work, and ensures end-to-end statutory safety compliance for Indian Railways.
2. **Major modules:** Control Office Real-Time Decision Suite, Maintenance Requisition Portal, Maintenance Work Order Kanban & Certification Dashboard, PM Calendar, AI MLOps Center, and Immutable Audit Ledger.
3. **Technologies:** Vanilla HTML5/CSS/JavaScript (Frontend), Node.js (API Gateway), Python FastAPI + OR-Tools CP-SAT (AI Backend), Supabase PostgreSQL (Cloud Database).
4. **Database:** Supabase Cloud PostgreSQL accessed via PostgREST REST API.
5. **Source of truth:** Supabase Cloud PostgreSQL database tables (`requested_maintenance_windows`, `maintenance_defects`, `track_sections`, `block_schedules`).
6. **Key API flow:** `Field Requisition (PENDING_REVIEW)` $\to$ `Control Office Sanction (SANCTIONED / ALTERNATIVE_APPLIED)` $\to$ `Work Order Acceptance (ACCEPTED)` $\to$ `Work Completion & Defect Closure (COMPLETED & RECTIFIED)`.
7. **Key database entities:** `requested_maintenance_windows` (keyed by `request_id`), `maintenance_defects` (keyed by `defect_id` / `external_ref_id`), `immutable_action_audit_log` (keyed by `target_entity_id`).
8. **Key technical rules:** Never overwrite identity bigint `id` with strings; always map `requested_windows` to `requested_maintenance_windows`; sanitize payloads with `filterPayloadForTable()` before cloud write; ensure audit log remains append-only.
