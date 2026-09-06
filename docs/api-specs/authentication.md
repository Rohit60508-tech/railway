# Indian Railways AI Platform — API Authentication & Security

## 1. Authentication Architecture

All inbound requests to the Indian Railways AI Maintenance Platform must be authenticated. The platform implements multi-scheme authentication accommodating both automated machine-to-machine integrations (e.g. TMS, USFD IoT telemetry cars) and human operator web sessions (Zonal Control Office, Chief Track Engineers).

```mermaid
sequenceDiagram
    autonumber
    actor Client as Consumer (Dashboard / USFD / TMS)
    participant Gateway as Node.js AI API Gateway
    participant Auth as Auth & RBAC Middleware
    participant Core as AI Inference Engine

    Client->>Gateway: POST /api/v1/ai/prioritize/defect<br/>Header: X-API-Key / Authorization
    Gateway->>Auth: Extract credentials & verify signature
    alt Invalid or Missing Token
        Auth-->>Client: 401 Unauthorized (UNAUTHORIZED)
    else Insufficient Role / Scope
        Auth-->>Client: 403 Forbidden (FORBIDDEN)
    else Authenticated & Authorized
        Auth->>Gateway: Attach req.auth context (role, user, division)
        Gateway->>Core: Execute ML Inference
        Core-->>Gateway: Result
        Gateway-->>Client: 200 OK + Standard Envelope
    end
```

---

## 2. Supported Authentication Schemes

### Scheme A: API Key Header (`X-API-Key`)
Recommended for automated daemon integrations, scheduled cron jobs, and field IoT telemetry gateways.

```http
POST /api/v1/ai/prioritize/defect HTTP/1.1
Host: ai.maintenance.railnet.gov.in
X-API-Key: ir-ai-prod-9a8b7c6d5e4f3a2b1c0d
Content-Type: application/json
```

### Scheme B: Bearer Token (`Authorization`)
Standard RFC 6750 Bearer authentication using JSON Web Tokens (JWT) issued by the CRIS Single Sign-On (SSO) authority.

```http
GET /api/v1/ai/models/info HTTP/1.1
Host: ai.maintenance.railnet.gov.in
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json
```

---

## 3. Role-Based Access Control (RBAC) Matrix

Every authenticated identity carries a designated role controlling permissible endpoint actions:

| API Endpoint Scope | `FIELD_ENGINEER` | `SECTION_CONTROLLER` | `MLOPS_ADMIN` | `SOC_AUDITOR` |
|---|:---:|:---:|:---:|:---:|
| **Single Defect Prioritization** | ✅ Allowed | ✅ Allowed | ✅ Allowed | 👁️ Read-Only |
| **Batch Defect Prioritization** | ✅ Allowed | ✅ Allowed | ✅ Allowed | 👁️ Read-Only |
| **Corridor Slots Discovery** | ❌ Forbidden | ✅ Allowed | ✅ Allowed | 👁️ Read-Only |
| **Best Slots Recommendation** | ❌ Forbidden | ✅ Allowed | ✅ Allowed | 👁️ Read-Only |
| **Block Schedule Optimization** | ❌ Forbidden | ✅ Allowed | ✅ Allowed | 👁️ Read-Only |
| **Task Bundling Evaluation** | ✅ Allowed | ✅ Allowed | ✅ Allowed | 👁️ Read-Only |
| **Model Info & Health** | ✅ Allowed | ✅ Allowed | ✅ Allowed | ✅ Allowed |
| **Trigger Model Retraining** | ❌ Forbidden | ❌ Forbidden | ✅ Allowed | ❌ Forbidden |
| **Telemetry & Drift Metrics** | ❌ Forbidden | 👁️ Read-Only | ✅ Allowed | ✅ Allowed |

---

## 4. JWT Token Payload Structure

Tokens issued by CRIS Central Identity Provider (`https://sso.railnet.gov.in`) contain standardized claims:

```json
{
  "iss": "https://sso.railnet.gov.in",
  "sub": "EMP-NR-549102",
  "name": "Rajesh Kumar (Senior Section Engineer)",
  "zone": "NR",
  "division": "DLI",
  "roles": ["SECTION_CONTROLLER", "FIELD_ENGINEER"],
  "iat": 1788665400,
  "exp": 1788708600
}
```

---

## 5. Security & Credential Best Practices

1. **Transport Layer Security (TLS)**: All traffic must be encrypted with TLS 1.3 in transit. Plain HTTP requests are automatically redirected with HSTS.
2. **Key Rotation Schedule**: API keys must be rotated every 90 days. The gateway supports seamless dual-key grace periods during rotation.
3. **Secret Storage**: Keys must never be committed to source code. In Kubernetes, store keys in SealedSecrets or HashiCorp Vault.
4. **Intrusion Detection**: Repeated authentication failures (> 5 attempts per minute) trigger automated IP rate limiting and dispatch alert notifications directly to the **Indian Railways Cyber SOC**.
