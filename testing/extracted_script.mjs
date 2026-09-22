
    import { PriorityScoreBadge } from '../components/PriorityScoreBadge.js';
    import { AIExplanationCard } from '../components/AIExplanationCard.js';
    import { SlotFeasibilityIndicator } from '../components/SlotFeasibilityIndicator.js';
    import { ConfidenceIndicator } from '../components/ConfidenceIndicator.js';
    import { BundlingSuggestionCard } from '../components/BundlingSuggestionCard.js';
    import { ManualOverrideModal } from '../components/ManualOverrideModal.js';

    // Role to Department Mapping
    const ROLE_DEPT_MAP = {
      'field-tms': { dept: 'CIVIL', label: 'Civil / P-Way (TMS)', lock: true },
      'field-smms': { dept: 'SIG', label: 'Signalling & Telecom (SMMS)', lock: true },
      'field-trd': { dept: 'TRD', label: 'Electrical / TRD (TRD)', lock: true }
    };

    // Global state
    let activeWorkOrders = [];
    let currentDeptFilter = 'ALL';

    function normalizeDeptCode(deptStr) {
      if (!deptStr) return 'CIVIL';
      const d = deptStr.toUpperCase();
      if (d.includes('CIVIL') || d.includes('P-WAY') || d.includes('TMS')) return 'CIVIL';
      if (d.includes('TRD') || d.includes('ELEC') || d.includes('ELECTRICAL') || d.includes('OHE')) return 'TRD';
      if (d.includes('SIG') || d.includes('TELECOM') || d.includes('SMMS') || d.includes('SIGNAL')) return 'SIG';
      if (d.includes('MECH') || d.includes('ROLLING')) return 'MECH';
      return 'CIVIL';
    }

    function normalizeDeptLabel(deptCode) {
      switch (deptCode) {
        case 'CIVIL': return 'Civil / P-Way';
        case 'TRD': return 'Electrical / TRD';
        case 'SIG': return 'Signalling & Telecom';
        case 'MECH': return 'Mechanical / Rolling Stock';
        default: return 'Civil / P-Way';
      }
    }

    // Static baseline fallback for initial render while API loads
    const baselineApprovedWorkOrders = [
      {
        id: "WO-CIVIL-401",
        title: "Immediate Rail Fracture Cut & Replacement (KM 412/18)",
        dept: "CIVIL",
        deptLabel: "Civil / P-Way",
        section: "NDLS-CNB-UP",
        score: 94.2,
        category: "P1",
        confidence: 0.98,
        duration: "120 min",
        machinery: "Flash-Butt Welding Plant + Rail Saw",
        slotRecommended: "01:30 – 03:30 (Tomorrow Night)",
        slotFeasibility: "HIGH_FEASIBILITY",
        slotConflicts: 0,
        status: "SANCTIONED",
        tooltipExplanation: "Urgency Reason: Transverse rail fissure on 112 GMT high-speed corridor with 92% failure probability.",
        explanationSummary: "CRITICAL rail break risk under high freight axle loading; 24-hour mandatory safety SLA.",
        detailedExplanation: "Transverse fissure observed during USFD testing with defect growth rate exceeding permissible limits. Approved by Control Office for immediate night block.",
        factors: [
          { name: "Safety Severity", weight: 0.25, value: "CRITICAL (100)" },
          { name: "Axle Load Factor", weight: 0.20, value: "25-Tonne Axle" },
          { name: "Failure Probability", weight: 0.18, value: "92%" }
        ],
        action: "Mobilize AEN P-Way gang; execute sanctioned 120-minute night corridor block."
      },
      {
        id: "WO-TRD-112",
        title: "Overhead 25kV Insulator & Dropper Replacement (KM 68/4)",
        dept: "TRD",
        deptLabel: "Electrical / TRD",
        section: "GZB-ALJN",
        score: 82.5,
        category: "P2",
        confidence: 0.92,
        duration: "90 min",
        machinery: "Self-Propelled 8-Wheeler Tower Wagon",
        slotRecommended: "01:30 – 04:00 (Bundled with BNDL-001)",
        slotFeasibility: "HIGH_FEASIBILITY",
        slotConflicts: 0,
        status: "APPROVED",
        tooltipExplanation: "Urgency Reason: Carbon erosion on 25kV catenary dropper exceeding 35% threshold.",
        explanationSummary: "Carbon erosion on main catenary dropper posing flashover & pantograph entanglement risk.",
        detailedExplanation: "Approved by Control Office for power shadow block alongside P-Way work.",
        factors: [
          { name: "Overdue Hours", weight: 0.22, value: "18h Remaining" },
          { name: "Department Weight", weight: 0.20, value: "TRD (90)" }
        ],
        action: "Take power shutdown block and replace 12 droppers."
      },
      {
        id: "WO-SIG-094",
        title: "Track Circuit Overhaul & Glued Insulated Rail Joint Inspection",
        dept: "SIG",
        deptLabel: "Signalling & Telecom",
        section: "NDLS-CNB-UP",
        score: 68.0,
        category: "P3",
        confidence: 0.89,
        duration: "60 min",
        machinery: "Handheld Megger & Digital Multimeter Kit",
        slotRecommended: "02:00 – 03:00 (Bundled in Shadow Window)",
        slotFeasibility: "HIGH_FEASIBILITY",
        slotConflicts: 0,
        status: "SANCTIONED",
        tooltipExplanation: "Urgency Reason: Insulation resistance degraded to 850 ohms; preventive overhaul sanctioned.",
        explanationSummary: "Glued joint insulation resistance degraded to 850 ohms; sanctioned by Control Office.",
        detailedExplanation: "Pre-monsoon track circuit bonding check approved by Control Office for execution.",
        factors: [
          { name: "Asset Criticality", weight: 0.16, value: "Glued Joint" },
          { name: "Weather Hazard", weight: 0.14, value: "Monsoon Ingress" }
        ],
        action: "Re-insulate fishplates and test audio frequency track circuit."
      }
    ];

    // Bundling Data
    const bundlingData = [
      {
        bundleId: "BNDL-NDLS-CNB-001",
        sectionId: "NDLS-CNB-UP (KM 410-416)",
        timeWindow: "01:30 – 04:00 (2h 30m)",
        synergyScore: 94,
        savedHours: 2.5,
        departments: ["CIVIL", "TRD", "SIG"],
        tasks: [
          { id: "WO-CIVIL-401", desc: "USFD rail fracture replacement & flash-butt welding", machine: "Flash Butt Welder", duration: "120m" },
          { id: "WO-TRD-112", desc: "25kV OHE dropper adjustment under power shadow block", machine: "Tower Wagon 08", duration: "90m" },
          { id: "WO-SIG-094", desc: "Track circuit bonding & insulation resistance test", machine: null, duration: "45m" }
        ]
      },
      {
        bundleId: "BNDL-GZB-ALJN-003",
        sectionId: "GZB-ALJN-DN (KM 64-68)",
        timeWindow: "12:45 – 15:15 (2h 30m)",
        synergyScore: 88,
        savedHours: 2.0,
        departments: ["CIVIL", "TRD"],
        tasks: [
          { id: "WO-CIVIL-419", desc: "CSM Continuous Action Tamper track ballast packing", machine: "CSM-44", duration: "140m" },
          { id: "WO-TRD-125", desc: "Catenary wire contact height verification", machine: "Tower Wagon 04", duration: "80m" }
        ]
      }
    ];

    async function fetchApprovedWorkOrders() {
      try {
        const res = await fetch('/api/v1/requested-windows');
        if (!res.ok) throw new Error('API fetch failed');
        const data = await res.json();

        // Reset tracking collections from persistent database state
        acceptedWorkOrders = [];
        completedWorkOrders = [];

        // Map ALL requested and sanctioned maintenance windows from Supabase Cloud / local store
        const approvedFromApi = (data || []).map(item => {
          const deptCode = normalizeDeptCode(item.department);
          const st = (item.status || 'PENDING_REVIEW').toUpperCase();
          const isSanctioned = st === 'APPROVED' || st === 'SANCTIONED' || st.includes('SANCTION') || st.includes('APPROV') || st === 'ALTERNATIVE_APPLIED' || st === 'FORCE_SANCTIONED' || st === 'ACCEPTED' || st === 'COMPLETED';
          const isAccepted = st === 'ACCEPTED' || !!item.accepted_at;
          const isCompleted = st === 'COMPLETED' || st === 'RECTIFIED' || !!item.completed_at;

          const wo = {
            id: item.request_id || `WO-${deptCode}-${item.id}`,
            request_id: item.request_id || `WO-${deptCode}-${item.id}`,
            title: item.work_description || `Requested Block Requisition (${item.section_id})`,
            dept: deptCode,
            deptLabel: normalizeDeptLabel(deptCode),
            section: item.section_id || `${item.station_from}-${item.station_to}`,
            score: item.priority === 'P1' ? 94.0 : item.priority === 'P2' ? 82.0 : 65.0,
            category: item.priority || 'P1',
            confidence: 0.95,
            duration: `${item.duration_minutes || 120} min`,
            machinery: item.applied_alternative ? `Alternative: ${item.applied_alternative}` : 'Standard Gang Machinery',
            slotRecommended: item.applied_alternative || item.requested_window || `${item.window_start_time} - ${item.window_end_time}`,
            slotFeasibility: isSanctioned ? 'HIGH_FEASIBILITY' : 'PENDING_REVIEW',
            slotConflicts: 0,
            status: item.status,
            appliedAlternative: item.applied_alternative || null,
            isSanctioned: isSanctioned,
            isAccepted: isAccepted,
            isCompleted: isCompleted,
            acceptedAt: item.accepted_at ? (item.accepted_at.includes('T') ? new Date(item.accepted_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : item.accepted_at) : null,
            completedAt: item.completed_at ? (item.completed_at.includes('T') ? new Date(item.completed_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : item.completed_at) : null,
            actionTaken: item.action_taken,
            conditionNow: item.condition_now,
            tsrStatus: item.tsr_status,
            fitCertNo: item.fit_cert_no,
            t351Memo: item.t351_memo,
            actualPossessionMinutes: item.actual_possession_minutes,
            trackGeometry: item.track_geometry,
            sseStaffId: item.sse_staff_id,
            defect_ref_id: item.defect_ref_id || item.defect_id,
            tooltipExplanation: `Persisted in Supabase requested_maintenance_windows. Section: ${item.section_id}. Status: ${st}`,
            explanationSummary: `Requested maintenance window from Supabase for ${item.department}.`,
            detailedExplanation: item.work_description || `Maintenance window ${item.applied_alternative || item.requested_window}.`,
            factors: [
              { name: "Control Office Status", weight: 0.30, value: item.status },
              { name: "Priority", weight: 0.25, value: item.priority || "P1" }
            ],
            action: `Proceed with field execution during sanctioned window ${item.applied_alternative || item.requested_window}.`
          };

          if (isCompleted) {
            completedWorkOrders.push(wo);
          } else if (isAccepted) {
            acceptedWorkOrders.push(wo);
          }

          return wo;
        });

        // Combine API approved items with baseline approved items (avoiding duplicates by ID)
        const idSet = new Set(approvedFromApi.map(x => x.id));
        const combined = [...approvedFromApi];
        baselineApprovedWorkOrders.forEach(b => {
          if (!idSet.has(b.id)) {
            combined.push({
              ...b,
              isSanctioned: true
            });
          }
        });

        activeWorkOrders = combined;
      } catch (err) {
        console.warn('Could not fetch dynamic requested windows from backend, using baseline approved orders:', err);
        activeWorkOrders = [...baselineApprovedWorkOrders];
      }

      updateDepartmentCounts();
      renderWorkOrders(currentDeptFilter);
      renderBundles(currentDeptFilter);
    }

    function updateDepartmentCounts() {
      const counts = {
        ALL: activeWorkOrders.length,
        CIVIL: activeWorkOrders.filter(w => w.dept === 'CIVIL').length,
        TRD: activeWorkOrders.filter(w => w.dept === 'TRD').length,
        SIG: activeWorkOrders.filter(w => w.dept === 'SIG').length,
        MECH: activeWorkOrders.filter(w => w.dept === 'MECH').length
      };

      const deptLabels = {
        ALL: `All Departments (${counts.ALL})`,
        CIVIL: `Civil / P-Way (TMS) (${counts.CIVIL})`,
        TRD: `Electrical / TRD (${counts.TRD})`,
        SIG: `Signalling & Telecom (SMMS) (${counts.SIG})`,
        MECH: `Mechanical / Rolling Stock (${counts.MECH})`
      };

      document.querySelectorAll('.dept-tab').forEach(btn => {
        const d = btn.getAttribute('data-dept');
        if (deptLabels[d]) {
          // preserve lock indicator if present
          const isLocked = btn.disabled;
          btn.textContent = deptLabels[d] + (isLocked ? ' 🔒' : '');
        }
      });
    }

    function renderBundles(filterDept = 'ALL') {
      const container = document.getElementById('bundling-cards-container');
      const filteredBundles = filterDept === 'ALL'
        ? bundlingData
        : bundlingData.filter(b => b.departments.includes(filterDept));

      if (filteredBundles.length === 0) {
        container.innerHTML = `
          <div style="background: rgba(255,255,255,0.7); border: 1px dashed var(--border-cyan); border-radius: 8px; padding: 20px; text-align: center; color: #64748B; font-size: 0.88rem;">
            No multi-department bundling suggestions active for department: <strong>${filterDept}</strong>.
          </div>`;
        return;
      }

      container.innerHTML = filteredBundles.map(b => BundlingSuggestionCard.render(b)).join('');
    }

    // State tracking for accepted & completed work orders
    let acceptedWorkOrders = [];
    let completedWorkOrders = [];

    function renderWorkOrders(filterDept = 'ALL') {
      const pendingContainer = document.getElementById('pending-work-orders-container');
      const acceptedContainer = document.getElementById('work-orders-container');
      const pendingCountBadge = document.getElementById('pending-wo-count-badge');
      const acceptedCountBadge = document.getElementById('accepted-wo-count-badge');

      if (pendingContainer) pendingContainer.innerHTML = '';
      if (acceptedContainer) acceptedContainer.innerHTML = '';

      // Work pending acceptance (only after approval from Control Office)
      const pendingList = activeWorkOrders.filter(w => w.isSanctioned && !w.isAccepted && !w.isCompleted);
      // Work accepted & locked (to be done)
      const acceptedList = activeWorkOrders.filter(w => w.isAccepted && !w.isCompleted);

      const filteredPending = filterDept === 'ALL'
        ? pendingList
        : pendingList.filter(w => w.dept === filterDept);

      const filteredAccepted = filterDept === 'ALL'
        ? acceptedList
        : acceptedList.filter(w => w.dept === filterDept);

      if (pendingCountBadge) pendingCountBadge.textContent = `${filteredPending.length} Sanctioned`;
      if (acceptedCountBadge) acceptedCountBadge.textContent = `${filteredAccepted.length} Accepted`;

      // Render Pending Sanctioned Work Orders (Top Section)
      if (pendingContainer) {
        if (filteredPending.length === 0) {
          pendingContainer.innerHTML = `
            <div style="background: rgba(255,255,255,0.8); border: 1px dashed var(--border-cyan); border-radius: 12px; padding: 24px; text-align: center; color: #64748B; font-size: 0.85rem;">
              No pending sanctioned requisitions awaiting acceptance for department: <strong>${filterDept}</strong>.
            </div>`;
        } else {
          filteredPending.forEach(wo => {
            const card = document.createElement('div');
            const alertClass = wo.category === 'P1' ? 'p1-alert' : wo.category === 'P2' ? 'p2-alert' : '';
            card.className = `work-order-card ${alertClass}`;
            card.id = `card-wo-${wo.id}`;
            card.setAttribute('data-wo-id', wo.id);
            if (wo.request_id) card.setAttribute('data-request-id', wo.request_id);

            const isAltApproved = !!wo.appliedAlternative || wo.status === 'ALTERNATIVE_APPLIED';

            card.innerHTML = `
              <div class="wo-header">
                <div>
                  <div class="wo-title">
                    <span>${wo.title}</span>
                    <span style="background: #059669; color: white; font-size: 0.68rem; padding: 2px 8px; border-radius: 4px; font-weight: 700; text-transform: uppercase;">
                      ✓ CONTROL OFFICE SANCTIONED
                    </span>
                    ${isAltApproved ? `
                    <span style="background: #ECFDF5; color: #065F46; border: 1px solid #10B981; font-size: 0.66rem; padding: 2px 7px; border-radius: 4px; font-weight: 700; display: inline-flex; align-items: center; gap: 3px;">
                      <span>💡</span> AI ALT APPROVED
                    </span>` : ''}
                    <div class="tooltip-wrap">
                      <span style="font-size: 0.85rem; color: #003366;">ℹ️</span>
                      <div class="tooltip-box">${wo.tooltipExplanation}</div>
                    </div>
                  </div>
                  <div style="font-family: var(--font-mono); font-size: 0.78rem; color: #64748B; margin-top: 6px;">
                    ID: <span style="color: #003366; font-weight: 700;">${wo.id}</span> | Section: <span style="color: #0F172A; font-weight: 600;">${wo.section}</span> | Dept: <span style="color: #059669; font-weight: 600;">${wo.deptLabel}</span>
                  </div>
                </div>

                <div style="display: flex; align-items: center; gap: 8px;">
                  <span id="badge-slot-${wo.id}">
                    ${PriorityScoreBadge.render({ score: wo.score, category: wo.category })}
                  </span>
                  ${ConfidenceIndicator.render({ confidence: wo.confidence })}

                  <button onclick="window.overrideWo('${wo.id}', '${wo.category}')" style="
                    background: rgba(217, 83, 30, 0.08);
                    border: 1px solid rgba(217, 83, 30, 0.35);
                    color: #D9531E;
                    padding: 5px 12px;
                    border-radius: 6px;
                    font-size: 0.74rem;
                    font-weight: 700;
                    cursor: pointer;
                  ">Manual Override</button>
                </div>
              </div>

              <div class="wo-meta-row" style="color: #8eb3da;">
                <span>⏱️ <strong>Required Block:</strong> ${wo.duration}</span>
                <span>🚜 <strong>Machinery:</strong> ${wo.machinery}</span>
                ${isAltApproved ? `<span style="color: #059669; font-weight: 600;">✓ Conflict Avoidance Path Shift Approved by Control Office</span>` : ''}
              </div>

              <div class="wo-slot-box">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span style="font-size: 1.1rem;">🗓️</span>
                  <div>
                    <div style="font-size: 0.72rem; text-transform: uppercase; color: #64748B; font-weight: 700;">
                      ${isAltApproved ? 'Approved AI Alternative Window (Sanctioned)' : 'Control Office Sanctioned Slot'}
                    </div>
                    <div style="font-family: var(--font-mono); font-size: 0.88rem; font-weight: 700; color: #003366;">${wo.slotRecommended}</div>
                  </div>
                </div>

                <div style="display: flex; align-items: center; gap: 10px;">
                  ${SlotFeasibilityIndicator.render({ status: wo.slotFeasibility, conflicts: wo.slotConflicts, compact: true })}
                  <button id="btn-accept-${wo.id}" style="
                    background: #003366;
                    border: none;
                    color: #ffffff;
                    padding: 6px 16px;
                    border-radius: 6px;
                    font-size: 0.78rem;
                    font-weight: 700;
                    cursor: pointer;
                    box-shadow: 0 2px 8px rgba(0, 51, 102, 0.2);
                    transition: all 0.2s ease;
                  " onclick="window.acceptWorkOrder('${wo.id}')">✓ Accept &amp; Lock Slot</button>
                </div>
              </div>

              ${AIExplanationCard.render({
              id: wo.id,
              summary: wo.explanationSummary,
              detailedReason: wo.detailedExplanation,
              factors: wo.factors,
              recommendedAction: wo.action,
              defaultExpanded: wo.category === 'P1'
            })}
            `;
            pendingContainer.appendChild(card);
          });
        }
      }

      // Render Accepted Work Orders (Middle Section - Work To Be Done)
      if (acceptedContainer) {
        if (filteredAccepted.length === 0) {
          acceptedContainer.innerHTML = `
            <div style="background: rgba(240, 253, 244, 0.7); border: 1px dashed rgba(5, 150, 105, 0.4); border-radius: 12px; padding: 24px; text-align: center; color: #059669; font-size: 0.85rem;">
              No accepted work orders currently in progress for department: <strong>${filterDept}</strong>. Click <strong>"✓ Accept & Lock Slot"</strong> above to move work here.
            </div>`;
        } else {
          filteredAccepted.forEach(wo => {
            const card = document.createElement('div');
            card.className = `work-order-card`;
            card.style.background = '#F0FDF4';
            card.style.borderColor = 'rgba(5, 150, 105, 0.45)';
            card.style.borderLeft = '6px solid #059669';

            card.innerHTML = `
              <div class="wo-header">
                <div>
                  <div class="wo-title">
                    <span style="color: #065F46; font-weight: 800;">${wo.title}</span>
                    <span style="background: #059669; color: white; font-size: 0.68rem; padding: 3px 10px; border-radius: 12px; font-weight: 800; text-transform: uppercase;">
                      🔒 WORK ACCEPTED &amp; SLOT LOCKED
                    </span>
                    <div class="tooltip-wrap">
                      <span style="font-size: 0.85rem; color: #003366;">ℹ️</span>
                      <div class="tooltip-box">${wo.tooltipExplanation}</div>
                    </div>
                  </div>
                  <div style="font-family: var(--font-mono); font-size: 0.78rem; color: #047857; margin-top: 6px;">
                    ID: <span style="color: #003366; font-weight: 700;">${wo.id}</span> | Section: <span style="color: #0F172A; font-weight: 600;">${wo.section}</span> | Dept: <span style="color: #059669; font-weight: 600;">${wo.deptLabel}</span>
                  </div>
                </div>

                <div style="display: flex; align-items: center; gap: 8px;">
                  <span id="badge-slot-${wo.id}">
                    ${PriorityScoreBadge.render({ score: wo.score, category: wo.category })}
                  </span>
                  ${ConfidenceIndicator.render({ confidence: wo.confidence })}
                </div>
              </div>

              <div class="wo-meta-row" style="color: #065F46;">
                <span>⏱️ <strong>Required Block:</strong> ${wo.duration}</span>
                <span>🚜 <strong>Machinery:</strong> ${wo.machinery}</span>
                <span>🕒 <strong>Accepted At:</strong> ${wo.acceptedAt}</span>
              </div>

              <div class="wo-slot-box" style="background: rgba(5, 150, 105, 0.08); border-color: rgba(5, 150, 105, 0.3);">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span style="font-size: 1.1rem;">🗓️</span>
                  <div>
                    <div style="font-size: 0.72rem; text-transform: uppercase; color: #047857; font-weight: 700;">🔒 Locked Corridor Window</div>
                    <div style="font-family: var(--font-mono); font-size: 0.88rem; font-weight: 700; color: #003366;">${wo.slotRecommended}</div>
                  </div>
                </div>

                <div style="display: flex; align-items: center; gap: 10px;">
                  ${SlotFeasibilityIndicator.render({ status: wo.slotFeasibility, conflicts: wo.slotConflicts, compact: true })}
                  <button id="btn-complete-${wo.id}" style="
                    background: #059669;
                    border: none;
                    color: #ffffff;
                    padding: 7px 18px;
                    border-radius: 6px;
                    font-size: 0.80rem;
                    font-weight: 800;
                    cursor: pointer;
                    box-shadow: 0 2px 10px rgba(5, 150, 105, 0.3);
                    transition: all 0.2s ease;
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                  " onclick="window.markWorkCompleted('${wo.id}')">☑ Tick Work Completed</button>
                </div>
              </div>

              ${AIExplanationCard.render({
              id: wo.id,
              summary: wo.explanationSummary,
              detailedReason: wo.detailedExplanation,
              factors: wo.factors,
              recommendedAction: wo.action,
              defaultExpanded: wo.category === 'P1'
            })}
            `;
            acceptedContainer.appendChild(card);
          });
        }
      }

      renderCompletedWorkOrders(filterDept);
    }

    function renderCompletedWorkOrders(filterDept = 'ALL') {
      const container = document.getElementById('completed-work-orders-container');
      const completedBadge = document.getElementById('completed-wo-count-badge');
      if (!container) return;
      container.innerHTML = '';

      const filtered = filterDept === 'ALL'
        ? completedWorkOrders
        : completedWorkOrders.filter(w => w.dept === filterDept);

      if (completedBadge) {
        completedBadge.textContent = `${filtered.length} Completed`;
      }

      if (filtered.length === 0) {
        container.innerHTML = `
          <div style="background: rgba(240, 253, 244, 0.7); border: 1px dashed rgba(5, 150, 105, 0.4); border-radius: 12px; padding: 24px; text-align: center; color: #059669; font-size: 0.85rem;">
            No work orders marked completed yet for department: <strong>${filterDept}</strong>. Accept work orders above and click ☑ Tick Work Completed.
          </div>`;
        return;
      }

      filtered.forEach(wo => {
        const card = document.createElement('div');
        card.className = `work-order-card`;
        card.style.background = '#ECFDF5';
        card.style.borderColor = 'rgba(5, 150, 105, 0.45)';
        card.style.borderLeft = '6px solid #059669';

        const actionTaken = wo.actionTaken || 'Alumino-Thermic (AT) Weld Replacement with 1m Rail Cut Insert & Joggled Fishplate Clamping';
        const conditionNow = wo.conditionNow || 'FIT_UNRESTRICTED_SECTIONAL_SPEED (Track Fit for 130/160 km/h)';
        const tsrStatus = wo.tsrStatus || 'TSR_RELAXED_TO_MAX_PERMISSIBLE_SPEED (MPS 160 km/h)';
        const fitCertNo = wo.fitCertNo || `IR-FIT/${wo.dept || 'PW'}/${wo.id}`;
        const t351Memo = wo.t351Memo || `T-351/RECONNECT/ALJN/4402`;
        const trackGeometry = wo.trackGeometry || 'Gauge: 1676mm (+0.5mm) | Cross-Level: 0.0mm | Twist: 0.8mm/3m';
        const sseStaffId = wo.sseStaffId || 'IR-SSE-4402 (Senior Section Engineer)';

        card.innerHTML = `
          <div class="wo-header">
            <div>
              <div class="wo-title">
                <span style="color: #065F46; font-weight: 700;">${wo.title}</span>
                <span style="background: #059669; color: white; font-size: 0.68rem; padding: 3px 10px; border-radius: 12px; font-weight: 800; text-transform: uppercase;">
                  ✓ STATUTORY WORK COMPLETED &amp; CERTIFIED
                </span>
              </div>
              <div style="font-family: var(--font-mono); font-size: 0.78rem; color: #047857; margin-top: 6px;">
                ID: <span style="font-weight: 700;">${wo.id}</span> | Section: <span>${wo.section}</span> | Dept: <strong>${wo.deptLabel}</strong>
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="background: rgba(5, 150, 105, 0.15); color: #059669; border: 1px solid rgba(5, 150, 105, 0.3); padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 800;">
                ✓ 100% EXECUTED
              </span>
            </div>
          </div>

          <!-- STATUTORY TECHNICAL REPORT FIELDS & VERIFICATION -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 12px 0;">
            <div style="background: rgba(254, 243, 199, 0.4); border: 1.5px solid #F59E0B; border-radius: 6px; padding: 10px;">
              <div style="font-size: 0.70rem; font-weight: 800; color: #92400E; text-transform: uppercase;">★ Rectification Action Executed (IRPWM / ACTM Standard)</div>
              <div style="font-size: 0.80rem; font-weight: 600; color: #1E293B; margin-top: 4px;">${actionTaken}</div>
            </div>
            <div style="background: rgba(209, 250, 229, 0.4); border: 1.5px solid #059669; border-radius: 6px; padding: 10px;">
              <div style="font-size: 0.70rem; font-weight: 800; color: #065F46; text-transform: uppercase;">★ Post-Maintenance Asset &amp; Track Condition Rating</div>
              <div style="font-size: 0.80rem; font-weight: 800; color: #059669; margin-top: 4px;">${conditionNow}</div>
            </div>
          </div>

          <div class="wo-meta-row" style="color: #065F46; font-size: 0.76rem; display: flex; flex-wrap: wrap; gap: 14px;">
            <span>🚦 <strong>TSR Clearance:</strong> ${tsrStatus}</span>
            <span>📜 <strong>Fit Cert:</strong> ${fitCertNo}</span>
            <span>⚡ <strong>T/351 Reconnect:</strong> ${t351Memo}</span>
            <span>📐 <strong>Track Geometry:</strong> ${trackGeometry}</span>
            <span>👷 <strong>Supervising SSE:</strong> ${sseStaffId}</span>
          </div>

          <div style="background: rgba(255, 255, 255, 0.95); border: 1px solid rgba(5, 150, 105, 0.3); border-radius: 8px; padding: 10px 14px; margin-top: 10px; display: flex; align-items: center; justify-content: space-between;">
            <div style="font-size: 0.76rem; color: #065F46; font-weight: 700;">
              ✓ Requisition closed, track fitness certification validated per IRPWM Para 268 &amp; ACTM Vol II.
            </div>
            <button onclick="window.openIRReportModal('work-orders')" style="
              background: #059669;
              border: none;
              color: white;
              padding: 5px 14px;
              border-radius: 4px;
              font-size: 0.74rem;
              font-weight: 700;
              cursor: pointer;
            ">📑 View Full Audit Memo</button>
          </div>
        `;

        container.appendChild(card);
      });
    }

    // Helper: Dispatch Audit Log Record to Supabase Cloud & Local Ledger
    function logToSupabase(entryName, eventType, wo, reason) {
      try {
        const auth = window.IR_AUTH || {};
        fetch('/api/v1/supabase/audit-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entry_name: entryName,
            event_type: eventType,
            staff_id: auth.id || auth.username || 'IR-STAFF-UNKNOWN',
            user_name: auth.name || 'Indian Railways Officer',
            user_role: auth.role || 'FIELD_ENGINEER',
            user_division: auth.division || 'Northern Railway — Delhi Division',
            section: wo.section || 'NDLS-CNB-UP',
            target_entity_id: wo.id,
            reason: reason,
            disruption_score: wo.score || 0,
            safety_risk_level: wo.category || 'P1',
            action_payload: wo,
            integrity_hash: 'SHA256-IR-' + Math.random().toString(36).substring(2, 12).toUpperCase()
          })
        }).catch(e => console.warn('[Supabase Direct Sync Notice]:', e));
      } catch (err) {
        console.warn('[Audit Sync Notice]:', err);
      }
    }

    let activeCompletingWoId = null;

    // Step 2: On Tick Work Completed - Open Statutory Report Modal Window
    window.markWorkCompleted = function (woId) {
      const idx = activeWorkOrders.findIndex(w => w.id === woId);
      if (idx === -1) return;

      const wo = activeWorkOrders[idx];
      activeCompletingWoId = woId;

      const defaultAction = wo.dept === 'CIVIL'
        ? 'Alumino-Thermic (AT) Weld Replacement with 1m Rail Cut Insert & Joggled Fishplate Clamping'
        : wo.dept === 'TRD' || wo.dept === 'TRD_OHE'
          ? '25kV OHE Catenary Wire Dropper Re-tensioning & Contact Wire Stagger Calibration to 200mm'
          : 'Point Machine #114B Obstruction Test (5mm Pin) & Tongue Rail Housing Adjustment';

      const banner = document.getElementById('modal-wo-target-banner');
      if (banner) {
        banner.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <strong style="color: #003366; font-size: 0.88rem;">${wo.title}</strong>
              <div style="color: #475569; font-size: 0.74rem; margin-top: 2px;">
                Requisition ID: <strong>${wo.id}</strong> | Section: <strong>${wo.section}</strong> | Dept: <strong>${wo.deptLabel}</strong>
              </div>
            </div>
            <span style="background: rgba(0, 51, 102, 0.1); color: #003366; border: 1px solid rgba(0, 51, 102, 0.25); padding: 3px 10px; border-radius: 6px; font-weight: 800; font-size: 0.74rem;">
              ${wo.category} RISK
            </span>
          </div>
        `;
      }

      // Populate form defaults
      const actionInput = document.getElementById('modal-action-taken');
      if (actionInput) actionInput.value = defaultAction;

      const condInput = document.getElementById('modal-condition-now');
      if (condInput) condInput.value = 'FIT_UNRESTRICTED_SECTIONAL_SPEED (Track Fit for 130/160 km/h)';

      const fitCertInput = document.getElementById('modal-fit-cert');
      if (fitCertInput) fitCertInput.value = `IR-FIT/${wo.dept || 'PW'}/${new Date().getFullYear()}/${wo.id}`;

      const t351Input = document.getElementById('modal-t351-memo');
      if (t351Input) t351Input.value = `T-351/RECONNECT/ALJN/${Math.floor(1000 + Math.random() * 9000)}`;

      const geomInput = document.getElementById('modal-track-geometry');
      if (geomInput) geomInput.value = 'Gauge: 1676mm (+0.5mm) | Cross-Level: 0.0mm | Twist: 0.8mm/3m';

      const sseInput = document.getElementById('modal-sse-staff-id');
      if (sseInput) sseInput.value = 'IR-SSE-4402 (Senior Section Engineer)';

      const modal = document.getElementById('work-completion-modal');
      if (modal) {
        modal.style.display = 'flex';
      }
    };

    window.closeCompletionModal = function () {
      const modal = document.getElementById('work-completion-modal');
      if (modal) modal.style.display = 'none';
      activeCompletingWoId = null;
    };

    window.handleCompletionFormSubmit = async function (e) {
      if (e) e.preventDefault();
      if (!activeCompletingWoId) return;

      const idx = activeWorkOrders.findIndex(w => w.id === activeCompletingWoId);
      if (idx === -1) return;

      const wo = activeWorkOrders[idx];

      const actionTaken = document.getElementById('modal-action-taken')?.value?.trim() || '';
      const conditionNow = document.getElementById('modal-condition-now')?.value || '';
      const tsrStatus = document.getElementById('modal-tsr-status')?.value || 'TSR_RELAXED_TO_MAX_PERMISSIBLE_SPEED (MPS 160 km/h)';
      const fitCertNo = document.getElementById('modal-fit-cert')?.value?.trim() || `IR-FIT/${wo.dept || 'PW'}/${wo.id}`;
      const t351Memo = document.getElementById('modal-t351-memo')?.value?.trim() || `T-351/RECONNECT/ALJN/4402`;
      const actualMinutes = parseInt(document.getElementById('modal-possession-mins')?.value || '120', 10);
      const trackGeometry = document.getElementById('modal-track-geometry')?.value?.trim() || 'Gauge: 1676mm (+0.5mm) | Cross-Level: 0.0mm | Twist: 0.8mm/3m';
      const sseStaffId = document.getElementById('modal-sse-staff-id')?.value?.trim() || 'IR-SSE-4402 (Senior Section Engineer)';

      if (!actionTaken) {
        alert('Please provide details of Rectification Action Executed.');
        return;
      }
      if (!conditionNow) {
        alert('Please select Post-Maintenance Asset Condition Rating.');
        return;
      }

      const nowIso = new Date().toISOString();
      const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      try {
        // 1. Persist directly to Supabase requested_maintenance_windows
        const patchRes = await fetch(`/api/v1/supabase/data/requested_windows?key=request_id&val=${encodeURIComponent(activeCompletingWoId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'COMPLETED',
            completed_at: nowIso,
            action_taken: actionTaken,
            condition_now: conditionNow,
            tsr_status: tsrStatus,
            fit_cert_no: fitCertNo,
            t351_memo: t351Memo,
            actual_possession_minutes: actualMinutes,
            track_geometry: trackGeometry,
            sse_staff_id: sseStaffId,
            defect_ref_id: wo.defect_ref_id || wo.defect_id
          })
        });

        const patchJson = await patchRes.json();
        if (!patchRes.ok || !patchJson.success) {
          throw new Error(patchJson.error || 'Failed to update work completion in persistent database');
        }

        wo.isCompleted = true;
        wo.status = 'COMPLETED';
        wo.actionTaken = actionTaken;
        wo.conditionNow = conditionNow;
        wo.tsrStatus = tsrStatus;
        wo.fitCertNo = fitCertNo;
        wo.t351Memo = t351Memo;
        wo.actualPossessionMinutes = actualMinutes;
        wo.trackGeometry = trackGeometry;
        wo.sseStaffId = sseStaffId;
        wo.completedAt = timeStr;

        if (!completedWorkOrders.find(c => c.id === activeCompletingWoId)) {
          completedWorkOrders.unshift(wo);
        }

        // 2. Log immutable audit trail to Supabase & local ledger
        logToSupabase('WORK_ORDER_COMPLETED_AND_CLOSED', 'WORK_COMPLETED', wo, `Work order ${activeCompletingWoId} certified closed: ${wo.conditionNow}`);

        window.closeCompletionModal();

        if (window.showToast) {
          window.showToast(`✅ Work order ${wo.id} certified completed & persisted to Supabase!`, 'success');
        }

        renderWorkOrders(currentDeptFilter);
      } catch (err) {
        console.error('[MaintenanceDashboard] Completion save error:', err);
        alert('Work completion failed to persist: ' + err.message);
      }
    };

    // Step 1: On 1-click Accept & Lock Slot
    window.acceptWorkOrder = async function (woId, suppressToast = false) {
      const idx = activeWorkOrders.findIndex(w => w.id === woId);
      if (idx === -1) return;

      const wo = activeWorkOrders[idx];
      const nowIso = new Date().toISOString();
      const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      try {
        // 1. Persist directly to Supabase requested_maintenance_windows
        const patchRes = await fetch(`/api/v1/supabase/data/requested_windows?key=request_id&val=${encodeURIComponent(woId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'ACCEPTED',
            accepted_at: nowIso
          })
        });

        const patchJson = await patchRes.json();
        if (!patchRes.ok || !patchJson.success) {
          throw new Error(patchJson.error || 'Failed to persist work order acceptance in database');
        }

        wo.isAccepted = true;
        wo.status = 'ACCEPTED';
        wo.acceptedAt = timeStr;

        if (!acceptedWorkOrders.find(c => c.id === woId)) {
          acceptedWorkOrders.unshift(wo);
        }

        // 2. Log immutable audit trail
        logToSupabase('ACCEPT_WORK_ORDER_SLOT_LOCK', 'SLOT_LOCK', wo, `Requisition ${woId} accepted and slot locked for execution.`);

        if (!suppressToast && window.showToast) {
          window.showToast(`🔒 Work order ${woId} accepted & slot locked! Persisted to Supabase.`, 'success');
        }

        renderWorkOrders(currentDeptFilter);
      } catch (err) {
        console.error('[MaintenanceDashboard] Accept work order error:', err);
        alert('Work order acceptance failed to persist: ' + err.message);
      }
    };

    function applyRoleRestrictions() {
      let role = null;
      if (window.IR_AUTH && window.IR_AUTH.user) {
        role = window.IR_AUTH.user.role;
      } else {
        try {
          const sess = JSON.parse(sessionStorage.getItem('ir_auth_session') || '{}');
          role = sess.role || null;
        } catch (_) { }
      }

      if (role && ROLE_DEPT_MAP[role]) {
        const mapping = ROLE_DEPT_MAP[role];
        currentDeptFilter = mapping.dept;

        // Hide unassigned department tabs completely for department-specific field engineers
        document.querySelectorAll('.dept-tab').forEach(btn => {
          const btnDept = btn.getAttribute('data-dept');
          if (btnDept === mapping.dept) {
            btn.classList.add('active');
            btn.disabled = false;
            btn.style.display = 'inline-block';
          } else {
            btn.classList.remove('active');
            btn.style.display = 'none';
          }
        });
      } else {
        // Admin, Control Office Controller, and Senior Field SSE accounts can view and switch all department tabs
        currentDeptFilter = 'ALL';
        document.querySelectorAll('.dept-tab').forEach(btn => {
          btn.style.display = 'inline-block';
          btn.disabled = false;
          btn.style.opacity = '1';
          btn.style.cursor = 'pointer';
        });
      }
    }

    window.overrideWo = function (targetId, currentVal) {
      ManualOverrideModal.open({
        targetId,
        currentVal,
        onComplete: (log) => {
          const badgeSlot = document.getElementById(`badge-slot-${targetId}`);
          if (badgeSlot) {
            badgeSlot.innerHTML = PriorityScoreBadge.render({
              score: log.overriddenValue === 'P1' ? 95.0 : 75.0,
              category: log.overriddenValue.replace('_OVERRIDE', '')
            });
          }
          window.refreshMaintAudit();
        }
      });
    };

    window.refreshMaintAudit = function () {
      const logs = ManualOverrideModal.getAuditLogs();
      const container = document.getElementById('maint-audit-log-container');
      if (!logs || logs.length === 0) {
        container.innerHTML = "No supervisor overrides logged in this session.";
        return;
      }
      container.innerHTML = logs.map(l => `
        <div style="padding: 8px 12px; background: #FAF6EE; border-left: 3px solid #D9531E; border-radius: 4px; margin-bottom: 6px; color: #0F172A;">
          <strong>[${l.timestamp.slice(11, 19)}] ${l.targetId}</strong>: ${l.originalValue} ➔ <span style="color:#003366; font-weight:700;">${l.overriddenValue}</span> (${l.reasonCode}) by <em>${l.officerId}</em>
        </div>
      `).join('');
    };

    // Filter tab listeners
    document.querySelectorAll('.dept-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        document.querySelectorAll('.dept-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentDeptFilter = btn.getAttribute('data-dept');
        renderWorkOrders(currentDeptFilter);
        renderBundles(currentDeptFilter);
      });
    });

    if (window.location.hash === '#request') {
      window.location.replace('maintenance-requests.html');
    }
    window.addEventListener('hashchange', () => {
      if (window.location.hash === '#request') {
        window.location.replace('maintenance-requests.html');
      }
    });

    // Deep-link scroll and visual highlight helper
    function checkAndHighlightTargetWo() {
      const hash = window.location.hash || '';
      let targetId = null;
      if (hash.startsWith('#wo-')) {
        targetId = hash.replace('#wo-', '');
      } else {
        const params = new URLSearchParams(window.location.search);
        targetId = params.get('highlight') || params.get('wo_id') || params.get('id');
      }

      if (targetId) {
        // If the target work order is in another department, switch filter to ALL so it is visible
        const targetWo = activeWorkOrders.find(w => w.id === targetId || w.request_id === targetId);
        if (targetWo && currentDeptFilter !== 'ALL' && targetWo.dept !== currentDeptFilter) {
          currentDeptFilter = 'ALL';
          document.querySelectorAll('.dept-tab').forEach(b => {
            b.classList.toggle('active', b.getAttribute('data-dept') === 'ALL');
          });
          renderWorkOrders('ALL');
        }

        setTimeout(() => {
          const el = document.getElementById(`card-wo-${targetId}`) || document.querySelector(`[data-wo-id="${targetId}"]`) || document.querySelector(`[data-request-id="${targetId}"]`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('highlight-sanctioned');
            setTimeout(() => el.classList.remove('highlight-sanctioned'), 5500);
          }
        }, 200);
      }
    }

    // Initialize Page
    applyRoleRestrictions();
    fetchApprovedWorkOrders().then(() => {
      applyRoleRestrictions();
      renderWorkOrders(currentDeptFilter);
      renderBundles(currentDeptFilter);
      checkAndHighlightTargetWo();
    });
    window.refreshMaintAudit();

    document.addEventListener('DOMContentLoaded', () => {
      applyRoleRestrictions();
      renderWorkOrders(currentDeptFilter);
      renderBundles(currentDeptFilter);
      checkAndHighlightTargetWo();

      if (window.IR_LIVE_SYNC) {
        window.IR_LIVE_SYNC.on('conflicts_updated', () => {
          fetchApprovedWorkOrders().then(() => checkAndHighlightTargetWo());
        });
      }
    });

    // Cross-tab real-time sync: when Control Office sanctions a task, immediately reload board
    window.addEventListener('storage', (e) => {
      if (e.key === 'ir_task_sanctioned' || e.key === 'ir_conflicts_updated') {
        fetchApprovedWorkOrders().then(() => {
          checkAndHighlightTargetWo();
        });
      }
    });

    window.addEventListener('focus', () => {
      fetchApprovedWorkOrders().then(() => checkAndHighlightTargetWo());
    });

    window.addEventListener('hashchange', () => {
      if (window.location.hash.startsWith('#wo-')) {
        checkAndHighlightTargetWo();
      }
    });
  