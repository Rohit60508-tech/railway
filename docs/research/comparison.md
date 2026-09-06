# System Comparison: Current vs. Proposed Maintenance Planning

## Overview

This document provides a structured, dimension-by-dimension comparison between the **current decentralized maintenance planning approach** and the **proposed AI-powered Maintenance Orchestration Platform** across technical, operational, organizational, and safety dimensions.

---

## 1. Architecture Comparison

### Current System Architecture

```
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│   TMS    │  │  SMMS    │  │  TDMS    │  │  BDMS    │
│(Railways)│  │  (S&T)   │  │  (Civil) │  │  (Civil) │
└────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘
     │              │              │              │
     │  NO INTEGRATION — MANUAL COORDINATION    │
     │              │              │              │
     ▼              ▼              ▼              ▼
┌──────────────────────────────────────────────────────┐
│           HUMAN PLANNER (spreadsheets, calls)        │
│           Acts as manual integration layer           │
└──────────────────────────────────────────────────────┘
```

### Proposed System Architecture

```
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│   TMS    │  │  SMMS    │  │  TDMS    │  │  BDMS    │
└────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘
     └──────────────┴──────────────┴──────────────┘
                         │
              ┌──────────▼──────────┐
              │ Integration Gateway  │
              │ (Real-time, unified) │
              └──────────┬──────────┘
                         │
              ┌──────────▼──────────┐
              │   AI Orchestration  │
              │      Engine         │
              └──────────┬──────────┘
                         │
              ┌──────────▼──────────┐
              │  Unified Dashboards │
              │  + Mobile Apps      │
              └─────────────────────┘
```

---

## 2. Feature-by-Feature Comparison

### 2.1 Data Management

| Feature | Current System | Proposed Platform |
|---------|---------------|-------------------|
| Data sources integrated | 1–2 per department | 15+ unified |
| Data latency | 12–72 hours (batch) | Near real-time (< 5 min) |
| Data format | Heterogeneous, incompatible | Normalized, unified schema |
| Asset health model | Fragmented per system | Single unified health score |
| Historical trend analysis | Manual, ad-hoc | Automated, continuous |
| Sensor data integration | None / isolated | SCADA, weather, structural sensors |
| Drone/video data | Ad-hoc, manual review | AI-analyzed, auto-flagged |

### 2.2 Maintenance Planning

| Feature | Current System | Proposed Platform |
|---------|---------------|-------------------|
| Planning horizon | 1–2 weeks (rolling) | 12 months (strategic) + rolling |
| Planning trigger | Inspection cycles, failures | Predictive data + inspection cycles |
| Cross-department coordination | Manual phone/email | Automated, platform-driven |
| Block conflict detection | After-the-fact | Proactive, at-point-of-request |
| Block utilization | 55–65% | 75–90% (target) |
| Work prioritization | Senior engineer judgment | AI-ranked by risk, traffic impact |
| Multi-department blocks | Rare, hard to coordinate | Standard, automatically optimized |

### 2.3 Approval Workflows

| Feature | Current System | Proposed Platform |
|---------|---------------|-------------------|
| Approval process | Paper/email/phone chain | Digital, rule-based automation |
| Standard block approval time | 24–48 hours | < 2 hours |
| Emergency block approval | 4–8 hours (best case) | < 30 minutes |
| Approval visibility | Opaque to requestor | Real-time status tracking |
| Audit trail | Paper registers | Tamper-proof digital log |
| Mobile approval | Not available | Full mobile approval capability |
| Rule-based auto-approval | Not available | Yes, for standard cases |

### 2.4 Field Operations

| Feature | Current System | Proposed Platform |
|---------|---------------|-------------------|
| Work order delivery | Paper/verbal briefing | Digital mobile app |
| Real-time field-to-control comms | Radio, manual | App-based, GPS-tracked |
| Completion reporting | Paper, next-day entry | Real-time digital form |
| Defect reporting from field | Verbal → paper → system | Direct digital entry with photo |
| Offline capability | Always offline | Full offline, auto-sync |
| Safety briefing delivery | Pre-work paper check | Digital safety checklist in app |
| GPS location tracking | None | Real-time for all field teams |

### 2.5 Monitoring & Situational Awareness

| Feature | Current System | Proposed Platform |
|---------|---------------|-------------------|
| Active block visibility (OCC) | Radio updates | Real-time digital dashboard |
| Maintenance health overview | None (division-wide) | Live health score dashboard |
| Defect tracking | Per-system, siloed | Unified defect lifecycle tracking |
| KPI monitoring | Monthly reports | Real-time, role-based dashboards |
| Early warning alerts | Ad-hoc | Automated threshold-based alerts |
| Traffic impact visibility | Manual calculation | Automated scenario modelling |

### 2.6 Predictive & AI Capabilities

| Feature | Current System | Proposed Platform |
|---------|---------------|-------------------|
| Predictive maintenance | Not available | AI-driven failure prediction |
| Asset degradation modelling | None | Machine learning models per asset class |
| Remaining useful life (RUL) | Not calculated | Continuously updated per asset |
| Anomaly detection | Manual inspection | Automated, multi-source |
| Recommendation engine | None | AI-generated work priorities |
| Cross-network learning | None | Continuous, across all zones |
| Schedule optimization | Manual heuristics | Mathematical optimization |

---

## 3. Organizational Impact Comparison

| Dimension | Current State | With Platform |
|-----------|--------------|---------------|
| Planning staff effort | 50–70% on coordination | < 20% on coordination |
| Senior engineer time | Approval processing | Strategic decisions |
| Field team clarity | Often conflicting instructions | Clear, single digital work order |
| Cross-department trust | Low (frequent conflicts) | Improved (transparent shared system) |
| Knowledge retention | Lost when engineers retire | Captured in system / AI models |
| Training requirements | Department-specific systems | Single unified platform |
| Performance accountability | Difficult to measure | KPI dashboards per individual/team |

---

## 4. Safety Comparison

| Safety Dimension | Current State | With Platform |
|-----------------|--------------|---------------|
| Defect-to-action time | 24–72 hours | < 1 hour (critical), < 4 hours (routine) |
| Inspection coverage | Gaps frequent | Tracked, gap-alerted |
| Track failure incidents | Baseline | -40–50% (Year 3 projection) |
| Emergency Speed Restrictions | Reactive, frequent | Predictive, fewer needed |
| Safety compliance reporting | Manual, periodic | Automated, continuous |
| Pre-work safety briefing | Paper-based | Digital checklist with sign-off |
| Block restoration certification | Verbal/radio | Digital, GPS-verified |
| RDSO norm compliance tracking | Manual audit | Automated, real-time |

---

## 5. Cost Comparison

| Cost Category | Current State | With Platform |
|---------------|--------------|---------------|
| Emergency repair premium | 30–50% of maintenance budget | Reduced to < 15% |
| Planning overhead cost | High (20–30% of planner time) | Significantly reduced |
| Material procurement | Emergency buying common | Planned, lower cost |
| Block window waste | 35–45% of blocks underused | < 10% waste |
| Gang idle time cost | 15–25% of working hours | < 5% idle time |
| IT maintenance (multiple systems) | Multiple vendor contracts | Consolidated platform |

---

## 6. Implementation Risk Comparison

| Risk Dimension | Current State | Transition Risk | Steady State |
|----------------|--------------|-----------------|--------------|
| Single point of failure | Multiple manual dependencies | Integration complexity | Mitigated by redundancy |
| Data loss risk | High (paper records) | Migration effort | Near-zero (cloud backup) |
| User adoption | N/A | Change management | High (better UX) |
| System downtime | N/A | Parallel running period | High availability design |
| Regulatory compliance | Manual, error-prone | Audit during transition | Automated, lower risk |

---

## 7. Summary Scorecard

| Dimension | Current System Score | Proposed Platform Score | Improvement |
|-----------|---------------------|------------------------|-------------|
| Data Integration | 2/10 | 9/10 | +7 |
| Planning Intelligence | 2/10 | 9/10 | +7 |
| Approval Efficiency | 3/10 | 9/10 | +6 |
| Field Operations | 3/10 | 9/10 | +6 |
| Safety Proactivity | 3/10 | 9/10 | +6 |
| Cost Efficiency | 4/10 | 8/10 | +4 |
| Compliance Automation | 2/10 | 9/10 | +7 |
| Stakeholder Visibility | 2/10 | 9/10 | +7 |
| **Overall** | **2.6/10** | **8.9/10** | **+6.3** |

---

## 8. Transition Path: Current → Proposed

The migration from the current system to the proposed platform does not require a big-bang cutover. The recommended path is incremental:

1. **Phase 1 (Months 1–6)**: Deploy Integration Gateway, begin data ingestion from existing systems. Run in parallel with current processes.
2. **Phase 2 (Months 6–12)**: Activate planning and conflict detection features. Pilot approval workflows in one division.
3. **Phase 3 (Year 2)**: Roll out field mobile app. Expand to additional divisions based on Phase 2 learnings.
4. **Phase 4 (Year 2–3)**: Activate predictive AI features as historical data accumulates. Cross-division rollout.
5. **Phase 5 (Year 3+)**: Full platform operation. Legacy systems progressively decommissioned where platform has replaced functionality.

At each phase, the current system remains operational as a fallback — ensuring zero disruption to railway operations during the transition.
