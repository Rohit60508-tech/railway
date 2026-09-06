# UAT Scenario 1: Emergency Rail Fracture & P1 SLA Enforcement

## 1. Scenario Identification
- **Test ID**: `UAT-IR-01`
- **Feature Area**: Defect Ingestion, Risk Scoring, SLA Tracking, and Emergency Sanction
- **Actor(s)**: USFD Operator, Track Inspector, Section Controller, DRM Executive
- **Target Route**: `NDLS-CNB-UP` (KM 145.2)

---

## 2. Business Context & Objective
Verify that an emergency transverse rail fracture detected by ultrasonic testing is automatically classified as **P1 Critical**, triggers automated 24-hour SLA countdown, dispatches high-priority notifications to the Section Controller, and provides an audited emergency block sanction workflow.

---

## 3. Step-by-Step Test Procedure

| Step | Action | Expected Result | Pass/Fail Criteria |
|:---:|---|---|---|
| **1** | USFD operator submits ultrasonic flaw record with depth $18.2\text{ mm}$ via Railsewak mobile app. | Record accepted with correlation ID. Defect status set to `NEW`. | HTTP 200 returned with valid JSON structure. |
| **2** | DefectPrioritizer executes risk evaluation across 10 domain features. | Priority score calculated $\ge 90.0$. Category assigned as **`P1 Critical`**. | `priority_category === 'P1'`, SLA = 24h. |
| **3** | AlertService dispatches emergency alert. | Alert HUD flashes on Section Controller console and DRM dashboard. | Event emitted to Railway SOC and incident tray updated. |
| **4** | Section Controller opens Control Office dashboard. | Proposed emergency block window shows immediate 20 km/h temporary speed restriction (TSR). | Visual feasibility badge indicates emergency line occupation. |
| **5** | Controller clicks "Force Sanction (Emergency Override)" and inputs reason code `TRACK_EMERGENCY`. | Block window locked; audit log written to disk. | `alerts_ledger.json` updated with officer credential. |
| **6** | Maintenance gang clears track and logs rail replacement completion. | Flaw marked `RESOLVED`. SLA timer stopped within 24h. | Resolution timestamp logged; health index restored. |

---

## 4. Acceptance Criteria
- [x] Priority category must be strictly `P1`.
- [x] SLA hours must be fixed at 24 hours per IRPWM guidelines.
- [x] Manual override must mandate reason code and officer credentials.
- [x] Event must be forwarded to Railway SOC SIEM event collector.
