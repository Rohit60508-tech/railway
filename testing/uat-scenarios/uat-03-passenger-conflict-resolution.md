# UAT Scenario 3: Passenger Train Conflict Detection & Rescheduling

## 1. Scenario Identification
- **Test ID**: `UAT-IR-03`
- **Feature Area**: Traffic Predictor, Timetable Collision Detection & Alternative Recommendation
- **Actor(s)**: Section Controller, Deputy Chief Controller
- **Target Route**: `NDLS-AGC-DN` (Palwal section)

---

## 2. Business Context & Objective
Verify that when a proposed maintenance block conflicts with high-priority passenger services (*12002 Bhopal Shatabdi* and *22436 Vande Bharat Express*), the system marks the slot `INFEASIBLE`, flashes conflict alerts, and automatically suggests alternative windows with minimal disruption.

---

## 3. Step-by-Step Test Procedure

| Step | Action | Expected Result | Pass/Fail Criteria |
|:---:|---|---|---|
| **1** | A maintenance block is proposed on `NDLS-AGC-DN` from `06:30` to `08:30`. | Proposed block logged. | Status received. |
| **2** | TrafficAnalyzer calculates section occupancy against live timetable feeds. | Direct path overlap detected with *12002 Shatabdi* (06:45) and *22436 Vande Bharat* (07:15). | Conflict count $= 2$, projected delay $> 180\text{ mins}$. |
| **3** | Slot feasibility evaluated. | Slot categorized as **`INFEASIBLE`** (Disruption Score $> 85.0$). | Feasibility indicator displays Red badge with warning text. |
| **4** | Conflict Warning HUD displays in Control Office. | Red alert flashes: `ALERT: Train 22436 vs 12050 at Palwal`. | Audio warning triggers on operator terminal. |
| **5** | Controller clicks "View AI Suggested Alternatives". | Platform returns top 3 alternative slots (e.g. night window `01:30 – 03:30`). | Zero conflict with premium passenger trains; disruption score $< 15.0$. |
| **6** | Controller accepts the alternative window. | Block rescheduled without passenger delay. | Timetable updated; conflict resolved. |

---

## 4. Acceptance Criteria
- [x] Infeasible slots colliding with premium passenger trains must be rejected with prominent visual warning.
- [x] Suggested alternatives must provide lower cumulative disruption score.
- [x] Section choke penalty must decrease upon accepting the alternative slot.
