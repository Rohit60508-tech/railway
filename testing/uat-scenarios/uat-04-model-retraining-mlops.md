# UAT Scenario 4: MLOps Model Retraining & Zero-Downtime Hot-Reload

## 1. Scenario Identification
- **Test ID**: `UAT-IR-04`
- **Feature Area**: Model Lifecycle, Concept Drift Monitoring & Hot-Reload
- **Actor(s)**: MLOps Engineer, Chief Track Engineer
- **Target Route**: Platform-Wide

---

## 2. Business Context & Objective
Verify that when new seasonal inspection records are ingested, the system monitors concept drift (Population Stability Index - PSI), triggers automated retraining with stratified cross-validation, validates safety quality gates ($F_1 \ge 0.88$, P1 recall $\ge 98\%$), and executes atomic zero-downtime hot-reloading into RAM.

---

## 3. Step-by-Step Test Procedure

| Step | Action | Expected Result | Pass/Fail Criteria |
|:---:|---|---|---|
| **1** | MLOps engineer navigates to AI Model Management console (`ai-model-management.html`). | Displays active model cards (Priority v1.2.0, Traffic v1.1.4, Optimizer v2.0.1). | Accuracy, F1, and last training date rendered correctly. |
| **2** | Review telemetry health indicators. | Concept Drift PSI $= 0.041$ (Stable), P95 Latency $= 24.5\text{ ms}$, Error Rate $= 0.0\%$. | Health status reads `HEALTHY / SERVING`. |
| **3** | Click "Trigger Retraining Pipeline" button. | Retraining pipeline initiates with animated 5-stage progress indicator. | Button disables; progress increments through all 5 stages. |
| **4** | Pipeline executes 5-fold stratified cross-validation on 3,000 verified inspection samples. | Accuracy scores computed ($94.1\%$), P1 recall validated ($99.3\%$). | Quality gates pass ($F_1 > 0.88$, P1 Recall $> 98\%$). |
| **5** | Model weights serialized and hot-reloaded into memory. | Active model version updates to `v1.3.0`. Inferences continue without dropped requests. | Zero 5xx errors during hot-reload transition. |

---

## 4. Acceptance Criteria
- [x] Model retraining must enforce hard quality gates before serving live traffic.
- [x] P1 recall must exceed $98\%$ to ensure zero critical safety defects are downgraded.
- [x] Hot-reload must occur atomically in memory without restarting active server processes.
