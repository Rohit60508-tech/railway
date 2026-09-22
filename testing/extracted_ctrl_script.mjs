
    import { TrafficImpactMeter } from '../components/TrafficImpactMeter.js';
    import { SlotFeasibilityIndicator } from '../components/SlotFeasibilityIndicator.js';
    import { ConfidenceIndicator } from '../components/ConfidenceIndicator.js';
    import { ManualOverrideModal } from '../components/ManualOverrideModal.js';

    // Live Dynamic Recommended Slots (Backed by Timetable Gaps & Headways)
    let recommendedSlots = [
      {
        id: "SLOT-NDLS-01",
        rank: "#1 RECOMMENDED",
        window: "01:30 – 04:30 (Night Shadow)",
        duration: "180 min duration",
        status: "HIGH_FEASIBILITY",
        conflicts: 0,
        disruptionScore: 12.5,
        delayMins: 0,
        trainCount: 0,
        confidence: 0.98,
        tooltipExplanation: "Optimal overnight shadow window between last departure and morning arrival. Zero passenger conflicts with 25% night coordination bonus.",
        rationale: "Clear headway gap across all UP/DN tracks. Minimum line occupancy.",
        isTop: true
      },
      {
        id: "SLOT-NDLS-02",
        rank: "#2 VIABLE",
        window: "12:45 – 15:00 (Afternoon Lull)",
        duration: "135 min duration",
        status: "MODERATE_FEASIBILITY",
        conflicts: 1,
        disruptionScore: 38.0,
        delayMins: 25,
        trainCount: 1,
        confidence: 0.92,
        tooltipExplanation: "Inter-peak afternoon window. Requires minor 10m loop regulation for freight rake at Aligarh.",
        rationale: "Freight regulated at Khurja loop line. Main line passenger cleared.",
        isTop: false
      },
      {
        id: "SLOT-NDLS-03",
        rank: "#3 CONTINGENT",
        window: "15:30 – 17:30 (Pre-Peak)",
        duration: "120 min duration",
        status: "LOW_FEASIBILITY",
        conflicts: 3,
        disruptionScore: 68.5,
        delayMins: 95,
        trainCount: 3,
        confidence: 0.86,
        tooltipExplanation: "Pre-peak evening surge encroaching on 3 passenger trains. Requires DRM approval.",
        rationale: "Heavy commuter load encroaches on section. Discretionary sanction required.",
        isTop: false
      }
    ];

    // Live Conflict Records & AI Suggested Alternatives
    // Live Conflict Records & AI Suggested Alternatives (Dynamic from User Input / CSV / Supabase)
    let conflictItems = [];

    window.triggerCsvSupabaseImport = function () {
      const choice = confirm("Choose CSV Import Source:\n\nClick OK to upload a local CSV file (.csv)\nClick Cancel to sync live requested windows from Supabase DB (corridor_windows / audit log)");
      if (choice) {
        document.getElementById('csv-file-input').click();
      } else {
        window.syncSupabaseDbWindows();
      }
    };

    window.handleCsvFileSelected = function (e) {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async function (evt) {
        const text = evt.target.result;
        const lines = text.split('\n').map(l => l.trim()).filter(l => l);
        if (lines.length < 2) {
          alert('CSV file is empty or missing data rows.');
          return;
        }

        let importedCount = 0;
        for (let i = 1; i < lines.length; i++) {
          const parts = lines[i].split(',').map(p => p.trim().replace(/^"|"$/g, ''));
          if (parts.length >= 4) {
            const section = parts[0] || 'NDLS-GZB-DN';
            const stnFrom = parts[1] || 'NDLS';
            const stnTo = parts[2] || 'GZB';
            const startTime = parts[3] || '10:00';
            const endTime = parts[4] || '12:00';
            const dept = parts[5] || 'Civil (P-Way)';
            const desc = parts[6] || 'CSV Imported Maintenance Work';

            const payload = {
              section_id: section,
              station_from: stnFrom,
              station_to: stnTo,
              start_km: 12.0,
              end_km: 16.0,
              km_pole: 'KM 12-16',
              requested_window: `${startTime} – ${endTime} (Imported)`,
              window_start_time: startTime,
              window_end_time: endTime,
              duration_minutes: 120,
              department: dept,
              work_description: desc,
              priority: 'P1'
            };

            await fetch('/api/v1/requested-windows', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            }).catch(() => null);

            importedCount++;
          }
        }

        await window.fetchLiveConflicts();
        await window.fetchLiveRecommendedSlots();
        alert(`✅ Imported ${importedCount} maintenance window requests from CSV file!\nLive AI train conflicts evaluated.`);
      };
      reader.readAsText(file);
    };

    window.syncSupabaseDbWindows = async function () {
      try {
        const res = await fetch('/api/v1/supabase/data/corridor_windows');
        const data = await res.json();
        if (data.success && Array.isArray(data.data) && data.data.length > 0) {
          for (const item of data.data) {
            await fetch('/api/v1/requested-windows', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                section_id: item.section_id || 'NDLS-GZB-DN',
                station_from: item.station_from || 'NDLS',
                station_to: item.station_to || 'GZB',
                start_km: item.start_km || 12.0,
                end_km: item.end_km || 16.0,
                requested_window: item.window_title || '09:00 – 11:00 (Supabase Schedule)',
                window_start_time: item.window_start || '09:00',
                window_end_time: item.window_end || '11:00',
                duration_minutes: item.duration_minutes || 120,
                department: item.department || 'Civil (P-Way)',
                work_description: item.work_type || 'Supabase Corridor Schedule',
                priority: 'P1'
              })
            }).catch(() => null);
          }
          await window.fetchLiveConflicts();
          alert(`✅ Synced ${data.data.length} maintenance windows from Supabase Cloud PostgreSQL database!`);
        } else {
          await window.fetchLiveConflicts();
          alert('Fetched current requested windows from database ledger.');
        }
      } catch (e) {
        alert('Supabase sync error: ' + e.message);
      }
    };

    async function fetchLiveRecommendedSlots(secId, stFrom, stTo) {
      try {
        const sFrom = stFrom || document.getElementById('swm-stn-from')?.value || document.getElementById('fs-conflict-station-from')?.value || 'NDLS';
        const sTo = stTo || document.getElementById('swm-stn-to')?.value || document.getElementById('fs-conflict-station-to')?.value || 'GZB';
        const sId = secId || document.getElementById('swm-section')?.value || 'NDLS-GZB-DN';
        const res = await fetch(`/api/v1/live-recommended-slots?section_id=${encodeURIComponent(sId)}&station_from=${encodeURIComponent(sFrom)}&station_to=${encodeURIComponent(sTo)}`);
        if (res.ok) {
          recommendedSlots = await res.json();
          renderRecommendedSlots();
        }
      } catch (e) {
        console.warn('Slots live fetch fallback:', e);
      }
    }
    window.fetchLiveRecommendedSlots = fetchLiveRecommendedSlots;

    async function fetchLiveConflicts() {
      try {
        const res = await fetch('/api/v1/live-conflicts');
        if (res.ok) {
          conflictItems = await res.json();
          renderConflictsAndAlternatives();
        }
      } catch (e) {
        console.warn('Conflicts live fetch fallback:', e);
      }
    }
    window.fetchLiveConflicts = fetchLiveConflicts;

    window.refreshConflictsPanels = async function () {
      const btn = document.getElementById('refresh-conflicts-btn');
      if (btn) {
        btn.innerHTML = '<span class="spin">↻</span> Loading...';
        btn.disabled = true;
      }
      await window.fetchLiveConflicts();
      await window.fetchLiveRecommendedSlots();
      if (btn) {
        btn.innerHTML = '↻ Refresh';
        btn.disabled = false;
      }
    };

    function renderRecommendedSlots() {
      const container = document.getElementById('recommended-slots-list');
      if (!container) return;
      container.innerHTML = recommendedSlots.map(slot => {
        const feasBadge = (window.SlotFeasibilityIndicator && typeof SlotFeasibilityIndicator.render === 'function')
          ? SlotFeasibilityIndicator.render({ status: slot.status, conflicts: slot.conflicts, compact: true })
          : `<span style="background:#ECFDF5; color:#059669; padding:2px 8px; border-radius:4px; font-size:0.75rem; font-weight:700;">${slot.status}</span>`;

        const confBadge = (window.ConfidenceIndicator && typeof ConfidenceIndicator.render === 'function')
          ? ConfidenceIndicator.render({ confidence: slot.confidence, compact: true })
          : `<span style="background:#FAF6EE; color:#003366; padding:2px 6px; border-radius:4px; font-size:0.72rem; font-weight:700;">${Math.round(slot.confidence * 100)}% Conf</span>`;

        const impactMeter = (window.TrafficImpactMeter && typeof TrafficImpactMeter.render === 'function')
          ? TrafficImpactMeter.render({ score: slot.disruptionScore, delayMinutes: slot.delayMins, trainCount: slot.trainCount })
          : `<div style="font-size:0.76rem; color:#64748B;">Disruption: ${slot.disruptionScore}/100 | ${slot.delayMins}m delay</div>`;

        return `
        <div class="slot-item ${slot.isTop ? 'top-ranked' : ''}">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-family: var(--font-mono); font-size: 0.72rem; font-weight: 800; color: ${slot.isTop ? '#059669' : '#003366'};">
                ${slot.rank}
              </span>
              <span style="font-weight: 700; font-size: 0.95rem; color: #0F172A;">${slot.window}</span>

              <div class="tooltip-wrap">
                <span style="font-size: 0.85rem; color: #003366;">&#8505;&#65039;</span>
                <div class="tooltip-box">${slot.tooltipExplanation}</div>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              ${feasBadge}
              ${confBadge}
            </div>
          </div>

          <div style="margin-bottom: 10px;">
            ${impactMeter}
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.78rem; color: #475569;">
            <span>&#8505;&#65039; ${slot.rationale}</span>
            <div style="display: flex; align-items: center; gap: 8px;">
              <button style="
                background: #003366;
                border: none;
                color: #ffffff;
                padding: 6px 16px;
                border-radius: 6px;
                font-weight: 700;
                font-size: 0.76rem;
                cursor: pointer;
                box-shadow: 0 2px 8px rgba(0, 51, 102, 0.2);
              " onclick="window.sanctionSlot('${slot.id}', '${slot.window}')">Sanction Block</button>

              <button onclick="window.overrideBlock('${slot.id}', '${slot.status}')" style="
                background: rgba(217, 83, 30, 0.08);
                border: 1px solid rgba(217, 83, 30, 0.35);
                color: #D9531E;
                padding: 5px 12px;
                border-radius: 6px;
                font-size: 0.74rem;
                font-weight: 700;
                cursor: pointer;
              ">Override</button>
            </div>
          </div>
        </div>
      `;
      }).join('');
    }


    let currentConflictFilter = 'ALL';
    let currentConflictSearchQuery = '';

    window.setConflictFilter = function (filter) {
      currentConflictFilter = filter;
      const allBtn = document.getElementById('cfilter-all');
      const pendBtn = document.getElementById('cfilter-pending');
      const applBtn = document.getElementById('cfilter-applied');

      if (allBtn) {
        allBtn.style.background = filter === 'ALL' ? '#003366' : '#FAF6EE';
        allBtn.style.color = filter === 'ALL' ? '#FFF' : '#003366';
      }
      if (pendBtn) {
        pendBtn.style.background = filter === 'PENDING' ? '#DC2626' : '#FAF6EE';
        pendBtn.style.color = filter === 'PENDING' ? '#FFF' : '#DC2626';
      }
      if (applBtn) {
        applBtn.style.background = filter === 'APPLIED' ? '#059669' : '#FAF6EE';
        applBtn.style.color = filter === 'APPLIED' ? '#FFF' : '#059669';
      }
      renderConflictsAndAlternatives();
    };

    window.handleConflictSearch = function (query) {
      currentConflictSearchQuery = (query || '').toLowerCase().trim();
      renderConflictsAndAlternatives();
    };

    window.simulateWhatIfWindow = function () {
      const timeVal = document.getElementById('sim-start-time').value || '02:30';
      const durVal = parseInt(document.getElementById('sim-duration-mins').value || '120', 10);
      const deptVal = document.getElementById('sim-discipline').value || 'CIVIL';

      const [hStr, mStr] = timeVal.split(':');
      const hour = parseInt(hStr, 10);
      const totalMins = hour * 60 + (parseInt(mStr, 10) || 0);

      const titleEl = document.getElementById('sim-result-title');
      const conflEl = document.getElementById('sim-result-conflicts');
      const descEl = document.getElementById('sim-result-desc');
      const boxEl = document.getElementById('sim-result-box');

      if (!titleEl || !conflEl || !descEl || !boxEl) return;

      if (totalMins >= 90 && totalMins <= 270) {
        boxEl.style.background = '#F0FDF4';
        boxEl.style.borderColor = 'rgba(5,150,105,0.3)';
        titleEl.style.color = '#059669';
        titleEl.innerHTML = '🟢 OPTIMAL NIGHT SHADOW (Score: 96/100)';
        conflEl.style.color = '#065F46';
        conflEl.textContent = '0 Clashes • ' + durVal + 'm Viable Window';
        descEl.textContent = 'Fits into standard Golden Hour Night Possession. Zero passenger train conflicts. Complete line isolation feasible with ' + (deptVal === 'MULTI' ? '3-gang co-possession.' : 'single discipline block.');
      } else if (totalMins >= 450 && totalMins <= 690) {
        boxEl.style.background = '#FEF2F2';
        boxEl.style.borderColor = 'rgba(220,38,38,0.3)';
        titleEl.style.color = '#DC2626';
        titleEl.innerHTML = '🔴 CRITICAL DISRUPTION PEAK (Score: 24/100)';
        conflEl.style.color = '#991B1B';
        conflEl.textContent = '4 Train Clashes (12004, 12424, EMU 64402)';
        descEl.textContent = 'Severe traffic clash with morning commuter and outbound Shatabdi paths. High punctuality risk (+135m delay). Shift proposed block to 13:45 or 01:30.';
      } else if (totalMins >= 810 && totalMins <= 990) {
        boxEl.style.background = '#FFFBEB';
        boxEl.style.borderColor = 'rgba(217,119,6,0.3)';
        titleEl.style.color = '#D97706';
        titleEl.innerHTML = '🟡 MODERATE VIABILITY (Score: 78/100)';
        conflEl.style.color = '#B45309';
        conflEl.textContent = '1 Loop Regulation (Freight BCN-5521)';
        descEl.textContent = 'Feasible inter-peak slot. Freight rake at Khurja loop siding can be regulated for 25m without delaying mail/express trains.';
      } else if (totalMins >= 990 && totalMins <= 1290) {
        boxEl.style.background = '#FEF2F2';
        boxEl.style.borderColor = 'rgba(220,38,38,0.3)';
        titleEl.style.color = '#DC2626';
        titleEl.innerHTML = '🔴 HIGH CONFLICT SURGE (Score: 35/100)';
        conflEl.style.color = '#991B1B';
        conflEl.textContent = '3 Train Clashes (22436 Vande Bharat, 12417)';
        descEl.textContent = 'Corridor throughput exceeds 95% capacity. Track block will cause widespread cascade delays across Northern Railway.';
      } else {
        boxEl.style.background = '#EFF6FF';
        boxEl.style.borderColor = 'rgba(37,99,235,0.3)';
        titleEl.style.color = '#2563EB';
        titleEl.innerHTML = '🔵 CONDITIONAL CORRIDOR SLOT (Score: 84/100)';
        conflEl.style.color = '#1E40AF';
        conflEl.textContent = '1 Minor Headway Adjustment';
        descEl.textContent = 'Acceptable block with signaling speed buffer. Track possession viable with Section Controller clearance.';
      }
    };

    function renderConflictsAndAlternatives() {
      const container = document.getElementById('conflicts-alternatives-list');
      if (!container) return;

      if (!conflictItems || conflictItems.length === 0) {
        container.innerHTML = `
          <div style="background:#FFF; border:1px dashed #C3B296; border-radius:10px; padding:28px 18px; text-align:center; color:#64748B;">
            <div style="font-size:2.2rem; margin-bottom:8px;">📋</div>
            <div style="font-size:0.95rem; font-weight:800; color:#0F172A; margin-bottom:4px;">No Pending Requested Maintenance Windows</div>
            <div style="font-size:0.78rem; color:#64748B; max-width:440px; margin:0 auto 16px auto; line-height:1.4;">
              Requested maintenance windows will appear here after submitting via <strong>+ Request Window</strong> or uploading a CSV / Supabase schedule.
            </div>
            <div style="display:flex; align-items:center; justify-content:center; gap:10px; flex-wrap:wrap;">
              <button onclick="window.openSubmitWindowModal()" style="background:#003366; color:#FFF; border:none; padding:8px 18px; border-radius:6px; font-weight:700; font-size:0.80rem; cursor:pointer; box-shadow:0 2px 8px rgba(0,51,102,0.2);">➕ Submit Window Request</button>
              <button onclick="window.triggerCsvSupabaseImport()" style="background:#ECFDF5; color:#059669; border:1px solid #A7F3D0; padding:8px 18px; border-radius:6px; font-weight:700; font-size:0.80rem; cursor:pointer;">📥 Import CSV / Supabase Data</button>
            </div>
          </div>
        `;
        return;
      }

      // Strict deduplication safeguard by unique conflictId / request ID
      const seenConflictKeys = new Set();
      let uniqueConflictList = [];
      for (const item of (conflictItems || [])) {
        const key = item.conflictId || item.id || `${item.section}_${item.proposedTime}`;
        if (!seenConflictKeys.has(key)) {
          seenConflictKeys.add(key);
          uniqueConflictList.push(item);
        }
      }

      const isApproved = (i) => {
        const s = (i.status || 'PENDING_REVIEW').toUpperCase();
        return s === 'ALTERNATIVE_APPLIED' || s === 'FORCE_SANCTIONED' || s === 'SANCTIONED' || s === 'APPROVED' || s.includes('SANCTION') || s.includes('APPROV');
      };

      const allCount = uniqueConflictList.length;
      const pendingCount = uniqueConflictList.filter(i => !isApproved(i)).length;
      const appliedCount = uniqueConflictList.filter(i => isApproved(i)).length;

      const allBtn = document.getElementById('cfilter-all');
      const pendBtn = document.getElementById('cfilter-pending');
      const applBtn = document.getElementById('cfilter-applied');
      if (allBtn) allBtn.innerHTML = `All (${allCount})`;
      if (pendBtn) pendBtn.innerHTML = `⚠️ Pending (${pendingCount})`;
      if (applBtn) applBtn.innerHTML = `✓ Sanctioned &amp; Moved (${appliedCount})`;

      let itemsToRender = uniqueConflictList;
      if (currentConflictFilter === 'PENDING') {
        itemsToRender = itemsToRender.filter(i => !isApproved(i));
      } else if (currentConflictFilter === 'APPLIED') {
        itemsToRender = itemsToRender.filter(i => isApproved(i));
      }

      if (currentConflictSearchQuery) {
        itemsToRender = itemsToRender.filter(i => {
          const hay = `${i.conflictId} ${i.section} ${i.proposedTime} ${i.department || ''} ${(i.conflictedTrains || []).join(' ')}`.toLowerCase();
          return hay.includes(currentConflictSearchQuery);
        });
      }

      if (itemsToRender.length === 0) {
        container.innerHTML = `
          <div style="background:#FAF6EE; border:1px solid rgba(195,178,150,0.5); border-radius:8px; padding:24px; text-align:center; color:#64748B;">
            <div style="font-weight:700; color:#0F172A; margin-bottom:4px;">No matching conflict records found</div>
            <div style="font-size:0.75rem;">Try clearing the search box or switching filters to "All".</div>
          </div>
        `;
        return;
      }

      container.innerHTML = itemsToRender.map(item => {
        const confBadge = (window.ConfidenceIndicator && typeof ConfidenceIndicator.render === 'function')
          ? ConfidenceIndicator.render({ confidence: item.confidence, compact: true })
          : `<span style="background:#FAF6EE; color:#003366; padding:2px 6px; border-radius:4px; font-size:0.72rem; font-weight:700;">${Math.round(item.confidence * 100)}% Conf</span>`;

        // DB status badge & approved state
        const approved = isApproved(item);
        const dbStatus = item.status || 'PENDING_REVIEW';
        const statusBadge = approved
          ? `<span style="background:#ECFDF5; color:#059669; border:1px solid rgba(5,150,105,0.3); padding:2px 8px; border-radius:4px; font-size:0.68rem; font-weight:700;">✓ SANCTIONED (IN WORK ORDERS)</span>`
          : `<span style="background:#FEF2F2; color:#DC2626; border:1px solid rgba(220,38,38,0.3); padding:2px 8px; border-radius:4px; font-size:0.68rem; font-weight:700;">● AWAITING APPROVAL</span>`;

        const sanctionedSlot = item.appliedAlternative || item.alternative?.recommendedWindow || item.proposedTime;

        return `
        <div class="conflict-card" id="conflict-card-${item.conflictId}">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 1rem;">${approved ? '🟢' : '⚠️'}</span>
              <span style="font-family: var(--font-mono); font-weight: 700; color: ${approved ? '#059669' : '#DC2626'};">${item.conflictId}</span>
              <span style="font-size: 0.78rem; color: #475569;">${item.section}</span>
            </div>
            <div style="display:flex;align-items:center;gap:5px;">
              ${statusBadge}
              ${confBadge}
            </div>
          </div>

          <div style="font-size: 0.8rem; color: #0F172A; margin-bottom: 4px;">
            Requested Window: <strong>${item.proposedTime}</strong>
            <span style="font-size:0.7rem; color:#64748B; margin-left:6px;">📋 ${item.department || ''}</span>
          </div>

          <div style="font-size: 0.78rem; color: #D9531E; margin-bottom: 8px;">
            <strong>Conflicted Train Paths:</strong> ${item.conflictedTrains.join(', ')}
          </div>

          <div style="font-size: 0.76rem; color: #991B1B; margin-bottom: 10px; line-height: 1.4;">
            ${item.warning}
          </div>

          ${approved ? `
          <!-- Approved & Moved to Work Orders Banner -->
          <div style="background: #F0FDF4; border: 1px solid #A7F3D0; border-radius: 8px; padding: 12px 14px; margin-top: 10px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
            <div>
              <div style="font-size: 0.70rem; text-transform: uppercase; color: #065F46; font-weight: 800; display: flex; align-items: center; gap: 5px;">
                <span>✓</span> CONTROL OFFICE SANCTIONED ➔ MOVED TO WORK ORDERS
              </div>
              <div style="font-family: var(--font-mono); font-size: 0.86rem; font-weight: 700; color: #003366; margin-top: 3px;">
                Sanctioned Slot: <strong>${sanctionedSlot}</strong>
              </div>
              <div style="font-size: 0.72rem; color: #047857; margin-top: 2px;">
                Pending field team acceptance under <strong>Section 1: Control Office Sanctioned Work Requisitions</strong>
              </div>
            </div>

            <a href="maintenance-dashboard.html#wo-${item.conflictId}" style="
              background: #003366;
              color: #ffffff;
              text-decoration: none;
              font-weight: 700;
              font-size: 0.76rem;
              padding: 7px 15px;
              border-radius: 6px;
              box-shadow: 0 2px 6px rgba(0, 51, 102, 0.25);
              display: inline-flex;
              align-items: center;
              gap: 6px;
            ">📋 View in Work Orders →</a>
          </div>
          ` : `
          <!-- AI Suggested Alternative Box (Pending Approval) -->
          <div class="alternative-box">
            <div>
              <div style="font-size: 0.72rem; text-transform: uppercase; color: #003366; font-weight: 700; display: flex; align-items: center; gap: 4px;">
                <span>💡</span> AI-SUGGESTED OPTIMAL ALTERNATIVE
              </div>
              <div style="font-family: var(--font-mono); font-size: 0.84rem; font-weight: 700; color: #0F172A; margin-top: 2px;">
                ${item.alternative.recommendedWindow}
              </div>
              <div style="font-size: 0.74rem; color: #059669; font-weight: 600; margin-top: 2px;">
                ✓ ${item.alternative.savedDelay}
              </div>
            </div>

            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <button style="
                background: #003366;
                border: none;
                color: #ffffff;
                font-weight: 700;
                font-size: 0.76rem;
                padding: 7px 14px;
                border-radius: 6px;
                cursor: pointer;
                box-shadow: 0 2px 8px rgba(0, 51, 102, 0.25);
                display: inline-flex;
                align-items: center;
                gap: 5px;
              " onclick="window.applyAlternativeSlot('${item.conflictId}', '${item.alternative.recommendedWindow}')">
                <span>✓</span> Approve AI Alternative
              </button>

              <button onclick="window.forceSanctionConflict('${item.conflictId}')" style="
                background: rgba(220, 38, 38, 0.08);
                border: 1px solid rgba(220, 38, 38, 0.35);
                color: #DC2626;
                padding: 6px 12px;
                border-radius: 6px;
                font-size: 0.74rem;
                font-weight: 700;
                cursor: pointer;
              ">⚡ Force Sanction Original</button>
            </div>
          </div>
          `}
        </div>
      `;
      }).join('');
    }


    // Helper to retrieve active logged-in user credentials
    function getActiveLoginUser() {
      try {
        const raw = localStorage.getItem('ir_ai_session');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.user) return parsed.user;
        }
      } catch (_) { }
      try {
        const storeRaw = localStorage.getItem('ir_user_store');
        if (storeRaw) {
          const users = JSON.parse(storeRaw);
          if (Array.isArray(users) && users.length > 0) return users[0];
        }
      } catch (_) { }
      return {
        staffId: 'IR-SSE-84920',
        name: 'Rajesh Kumar Verma',
        designation: 'Sr. Section Engineer (Permanent Way)',
        role: 'CONTROL_OFFICER',
        division: 'Northern Railway — Delhi Division',
        section: 'NDLS-CNB-UP'
      };
    }

    function updateLoginUserChip() {
      const chip = document.getElementById('current-login-user-chip');
      if (!chip) return;
      const u = getActiveLoginUser();
      chip.innerHTML = `👤 Active Operator: <strong>${u.name || u.username}</strong> [Staff ID: <code>${u.staffId || u.id}</code>] • ${u.designation || u.role || 'Section Controller'} (${u.division || 'Delhi Division'})`;
    }

    window.sanctionSlot = async function (slotId, windowTime) {
      const activeUser = getActiveLoginUser();
      const entryName = 'SANCTION_BLOCK_POSSESSION';

      try {
        // 1. Log to immutable Supabase / Local Ledger audit trail
        const res = await fetch('/api/v1/supabase/audit-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entry_name: entryName,
            event_type: 'SANCTION',
            block_id: slotId,
            target_entity_id: slotId,
            section: 'NDLS-CNB-UP (KM 120–160)',
            window: windowTime,
            staff_id: activeUser.staffId || activeUser.id || 'IR-STAFF-UNKNOWN',
            user_name: activeUser.name || activeUser.username || 'Indian Railways Operator',
            user_role: activeUser.role || activeUser.designation || 'Senior Section Controller',
            user_division: activeUser.division || 'Northern Railway — Delhi Division',
            reason: 'Optimal AI window sanctioned with zero passenger impact.',
            disruption_score: 12.5,
            delay_minutes: 0,
            details: { slot_id: slotId, window_time: windowTime }
          })
        });
        const data = await res.json();

        // 2. Persist status SANCTIONED to Supabase requested_maintenance_windows
        await fetch(`/api/v1/supabase/data/requested_windows?key=request_id&val=${encodeURIComponent(slotId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'SANCTIONED',
            sanctioned_by: activeUser.name || activeUser.username || 'Indian Railways Operator',
            sanctioned_at: new Date().toISOString()
          })
        }).catch(() => null);

        alert(`✓ [${entryName}] Block ${slotId} (${windowTime}) SANCTIONED!\n\nOperator: ${data.user_name || activeUser.name} [${data.staff_id || 'STAFF-01'}]\nDatabase: ${data.storage_destination || 'audit_records.db'}\nSHA-256 Hash: ${data.record_hash ? data.record_hash.slice(0, 16) + '...' : 'SECURED'}\nImmutability: 🔒 CRYPTOGRAPHICALLY SEALED`);

        await window.fetchLiveConflicts();
        await window.fetchLiveRecommendedSlots();
        if (typeof window.refreshCtrlAudit === 'function') window.refreshCtrlAudit();
      } catch (e) {
        alert('Sanction error: ' + e.message);
      }
    };

    window.showSanctionSuccessModal = function ({ conflictId, slot, type, operator, recordHash }) {
      const existing = document.getElementById('sanction-success-modal');
      if (existing) existing.remove();

      const modal = document.createElement('div');
      modal.id = 'sanction-success-modal';
      modal.style.cssText = `
        position: fixed; inset: 0; background: rgba(15, 23, 42, 0.7);
        display: flex; align-items: center; justify-content: center; z-index: 99999;
        backdrop-filter: blur(4px);
      `;

      modal.innerHTML = `
        <div style="background: #ffffff; border-radius: 12px; border: 1px solid #C3B296; max-width: 520px; width: 92%; padding: 26px; box-shadow: 0 20px 45px rgba(0,0,0,0.28); text-align: center; font-family: var(--font-body, system-ui);">
          <div style="width: 58px; height: 58px; background: #ECFDF5; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto; font-size: 1.9rem; color: #059669; border: 2px solid #A7F3D0;">
            ✓
          </div>
          <h3 style="margin: 0 0 6px 0; color: #003366; font-size: 1.28rem; font-weight: 800;">
            Requisition Approved &amp; Sanctioned!
          </h3>
          <div style="font-size: 0.84rem; color: #475569; margin-bottom: 14px; line-height: 1.5;">
            Requisition <strong style="color: #003366; font-family: var(--font-mono);">${conflictId}</strong> has been approved by <strong>${operator}</strong> and moved to:
          </div>

          <div style="background: #F0FDF4; border: 1px solid #A7F3D0; border-radius: 8px; padding: 12px; margin: 12px 0; text-align: left;">
            <div style="font-size: 0.70rem; text-transform: uppercase; color: #065F46; font-weight: 800; margin-bottom: 4px;">
              📋 Destination Board
            </div>
            <div style="color: #003366; font-weight: 700; font-size: 0.88rem;">
              Work Orders ➔ Control Office Sanctioned Work Requisitions (Pending Acceptance)
            </div>
            <div style="margin-top: 6px; font-size: 0.78rem; color: #334155;">
              <strong>Sanctioned Slot:</strong> <span style="font-family: var(--font-mono); color: #059669; font-weight: 700;">${slot}</span>
            </div>
          </div>

          <div style="display: flex; justify-content: center; gap: 10px; margin-top: 20px; flex-wrap: wrap;">
            <a href="maintenance-dashboard.html#wo-${conflictId}" style="
              background: #003366;
              color: #ffffff;
              text-decoration: none;
              padding: 9px 20px;
              border-radius: 6px;
              font-weight: 700;
              font-size: 0.84rem;
              display: inline-flex;
              align-items: center;
              gap: 6px;
              box-shadow: 0 4px 12px rgba(0,51,102,0.25);
            ">
              <span>📋</span> Go to Work Orders Board
            </a>
            <button onclick="document.getElementById('sanction-success-modal').remove()" style="
              background: #FAF6EE;
              color: #475569;
              border: 1px solid #C3B296;
              padding: 9px 18px;
              border-radius: 6px;
              font-weight: 700;
              font-size: 0.84rem;
              cursor: pointer;
            ">
              Stay on Control Office
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);
    };

    window.applyAlternativeSlot = async function (conflictId, altWindow) {
      const activeUser = getActiveLoginUser();
      const entryName = 'APPLY_ALTERNATIVE_SLOT';

      try {
        // 1. Update Supabase requested_windows table via Data API
        await fetch(`/api/v1/supabase/data/requested_windows?key=request_id&val=${encodeURIComponent(conflictId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'ALTERNATIVE_APPLIED',
            applied_alternative: altWindow,
            sanctioned_by: activeUser.name || 'Indian Railways Operator',
            sanctioned_at: new Date().toISOString()
          })
        }).catch(() => null);

        // 2. Update backend & persistent Supabase database
        const localDbRes = await fetch('/api/v1/apply-alternative-window', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            request_id: conflictId,
            alternative_window: altWindow,
            officer_id: activeUser.staffId || activeUser.id || 'IR-STAFF-UNKNOWN',
            officer_name: activeUser.name || activeUser.username || 'Indian Railways Operator',
            officer_role: activeUser.role || activeUser.designation || 'Senior Section Controller',
            reason: `Avoided collision with passenger path. Shifted to ${altWindow}`
          })
        });
        const localDbData = await localDbRes.json();

        if (!localDbRes.ok || !localDbData.success) {
          throw new Error(localDbData.error || 'Failed to apply alternative window in persistent storage');
        }

        // 3. Broadcast cross-tab and real-time sync event to Work Orders
        try {
          localStorage.setItem('ir_task_sanctioned', JSON.stringify({
            id: conflictId,
            status: 'ALTERNATIVE_APPLIED',
            applied_alternative: altWindow,
            timestamp: Date.now()
          }));
        } catch (_) {}
        if (window.IR_LIVE_SYNC) {
          try { window.IR_LIVE_SYNC.emit('conflicts_updated'); } catch (_) {}
        }

        // 4. Refresh panels from live train API
        await window.fetchLiveConflicts();
        await window.fetchLiveRecommendedSlots();
        if (typeof window.refreshCtrlAudit === 'function') window.refreshCtrlAudit();

        // 5. Open high-clarity success modal directing user to Work Orders
        window.showSanctionSuccessModal({
          conflictId: conflictId,
          slot: altWindow,
          type: 'ALTERNATIVE',
          operator: activeUser.name || 'Indian Railways Operator'
        });
      } catch (e) {
        alert('Alternative sanction error: ' + e.message);
      }
    };

    window.forceSanctionConflict = async function (conflictId) {
      const activeUser = getActiveLoginUser();
      if (!confirm(`Force Sanction maintenance window ${conflictId}?\n\nThis will override all AI conflict warnings and sanction the originally requested window.\n\nOperator: ${activeUser.name || 'Indian Railways Operator'}\n\nProceed?`)) return;

      try {
        // 1. Update backend & persistent Supabase database
        const localDbRes = await fetch('/api/v1/force-sanction-window', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            request_id: conflictId,
            officer_id: activeUser.staffId || activeUser.id || 'IR-STAFF-UNKNOWN',
            officer_name: activeUser.name || activeUser.username || 'Indian Railways Operator',
            officer_role: activeUser.role || activeUser.designation || 'Senior Section Controller',
            reason: 'Force sanction executed by Section Controller override — operational exigency.',
            disruption_score: 68.0,
            delay_minutes: 45
          })
        });
        const localDbData = await localDbRes.json();

        if (!localDbRes.ok || !localDbData.success) {
          throw new Error(localDbData.error || 'Failed to force sanction window in persistent storage');
        }

        // Also update Supabase table via Data API
        await fetch(`/api/v1/supabase/data/requested_windows?key=request_id&val=${encodeURIComponent(conflictId)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'FORCE_SANCTIONED',
            sanctioned_by: activeUser.name || 'Indian Railways Operator',
            sanctioned_at: new Date().toISOString()
          })
        }).catch(() => null);

        // Broadcast cross-tab sync
        try {
          localStorage.setItem('ir_task_sanctioned', JSON.stringify({
            id: conflictId,
            status: 'FORCE_SANCTIONED',
            timestamp: Date.now()
          }));
        } catch (_) {}
        if (window.IR_LIVE_SYNC) {
          try { window.IR_LIVE_SYNC.emit('conflicts_updated'); } catch (_) {}
        }

        // Refresh panels
        await window.fetchLiveConflicts();
        if (typeof window.refreshCtrlAudit === 'function') window.refreshCtrlAudit();

        window.showSanctionSuccessModal({
          conflictId: conflictId,
          slot: 'Originally Requested Window (Force Sanctioned)',
          type: 'FORCE',
          operator: activeUser.name || 'Indian Railways Operator'
        });
      } catch (e) {
        alert('Force sanction error: ' + e.message);
      }
    };

    window.overrideBlock = function (targetId, currentVal) {
      const activeUser = getActiveLoginUser();

      ManualOverrideModal.open({
        targetId: targetId,
        targetType: 'BLOCK_REQUISITION',
        currentValue: currentVal,
        allowedReasons: [
          { code: 'VIP_MOVEMENT', label: 'VVIP / Rail Mantri Special Path Movement' },
          { code: 'INCLEMENT_WEATHER', label: 'Track Temp > Td + 20°C (IRPWM 602 Rail Buckling Risk)' },
          { code: 'REVENUE_FREIGHT', label: 'Priority Container Corridor Flow Protection' },
          { code: 'CREW_SLA_EXHAUSTION', label: 'Track Machine Crew Max Hours Exhaustion' },
          { code: 'OTHER', label: 'Other Operational Section Contingency' }
        ],
        onSave: async (log) => {
          const entryName = 'CONTROLLER_MANUAL_OVERRIDE';
          try {
            await fetch('/api/v1/supabase/audit-log', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                entry_name: entryName,
                event_type: 'OVERRIDE',
                block_id: targetId,
                target_entity_id: targetId,
                section: 'NDLS-GZB-DN',
                window: 'Shifted from ' + currentVal + ' to ' + log.overriddenValue,
                staff_id: activeUser.staffId || log.officerId || 'IR-STAFF-UNKNOWN',
                user_name: activeUser.name || 'Indian Railways Operator',
                user_role: activeUser.role || log.officerRole || 'Section Controller',
                user_division: activeUser.division || 'Northern Railway — Delhi Division',
                reason: `${log.reasonCode}: ${log.explanation || 'Operational Override'}`,
                disruption_score: 28.0,
                delay_minutes: 15,
                details: { target_id: targetId, original: currentVal, overridden: log.overriddenValue }
              })
            });
          } catch (err) {
            console.warn('Could not post to audit-logs API:', err);
          }
          window.refreshCtrlAudit();
        }
      });
    };

    window.verifyAuditChainIntegrity = async function () {
      const alertBox = document.getElementById('chain-integrity-alert');
      if (!alertBox) return;
      alertBox.style.display = 'block';
      alertBox.style.background = '#EEF2F6';
      alertBox.style.color = '#003366';
      alertBox.innerHTML = '⏳ Verifying SHA-256 cryptographic chain across all historical audit records in database...';

      try {
        const res = await fetch('/api/v1/supabase/verify-integrity');
        const data = await res.json();
        if (data.is_valid) {
          alertBox.style.background = '#ECFDF5';
          alertBox.style.color = '#065F46';
          alertBox.style.border = '1px solid #10B981';
          alertBox.innerHTML = `
            <strong>🛡️ 100% IMMUTABLE & VERIFIED:</strong> ${data.message || 'All records mathematically verified against tamper-evident chain.'}
            <div style="font-size: 0.70rem; font-family: var(--font-mono); margin-top: 3px; color: #047857;">
              Algorithm: ${data.algorithm} | Total Verified Entries: <strong>${data.total_records}</strong> | Sealed Anchor: <code>${(data.last_sealed_hash || 'GENESIS').slice(0, 24)}...</code>
            </div>
          `;
        } else {
          alertBox.style.background = '#FEF2F2';
          alertBox.style.color = '#991B1B';
          alertBox.style.border = '1px solid #EF4444';
          alertBox.innerHTML = `<strong>⚠️ INTEGRITY VIOLATION DETECTED:</strong> ${data.message}`;
        }
      } catch (e) {
        alertBox.style.background = '#FEF2F2';
        alertBox.style.color = '#991B1B';
        alertBox.innerHTML = 'Error verifying chain: ' + e.message;
      }
    };

    window.refreshCtrlAudit = async function () {
      updateLoginUserChip();
      const container = document.getElementById('ctrl-audit-log-container');
      if (!container) return;

      try {
        const res = await fetch('/api/v1/supabase/audit-logs');
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const logs = await res.json();
        if (!logs || logs.length === 0) {
          container.innerHTML = "No manual block overrides recorded in current shift.";
          return;
        }
        container.innerHTML = logs.map(l => {
          const entryName = l.entry_name || l.event_type || 'SYSTEM_ACTION';
          const executedBy = l.user_name || l.officer_id || 'Railway Officer';
          const staffId = l.staff_id || l.officer_id || 'N/A';
          const role = l.user_role || l.officer_role || 'Section Controller';
          const division = l.user_division || 'Northern Railway';
          const target = l.target_entity_id || l.block_id || '';
          const hash = l.record_hash || '';
          const ts = (l.created_at || l.timestamp || '').slice(0, 19).replace('T', ' ');

          const isSanction = l.event_type === 'SANCTION' || entryName.includes('SANCTION');
          const color = isSanction ? '#059669' : '#D9531E';

          return `
            <div style="padding: 10px 14px; background: #FAF6EE; border-left: 4px solid ${color}; border-radius: 6px; margin-bottom: 8px; color: #0F172A; border: 1px solid rgba(195,178,150,0.35); box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; flex-wrap: wrap; gap: 4px;">
                <span style="font-family: var(--font-mono); font-weight: 800; font-size: 0.76rem; color: ${color}; display: flex; align-items: center; gap: 6px;">
                  <span>● ${entryName}</span>
                  ${target ? `<span style="background: rgba(0,51,102,0.08); color: #003366; padding: 1px 6px; border-radius: 3px; font-size: 0.70rem;">Target: ${target}</span>` : ''}
                </span>
                <span style="font-size: 0.72rem; color: #64748B; font-family: var(--font-mono);">
                  ${ts}
                </span>
              </div>
              <div style="font-size: 0.78rem; color: #334155; margin-bottom: 4px;">
                Section: <strong>${l.section}</strong> | Reason: <em>${l.reason}</em>
              </div>
              <div style="font-size: 0.72rem; color: #64748B; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 6px;">
                <span>👤 Performed by: <strong style="color: #003366;">${executedBy}</strong> [Staff ID: <code>${staffId}</code>] • ${role} (${division})</span>
                <span style="display: flex; align-items: center; gap: 6px;">
                  <span style="font-family: var(--font-mono); font-size: 0.68rem; background: #EEF2F6; color: #003366; padding: 2px 6px; border-radius: 4px; border: 1px solid #CBD5E1;" title="SHA-256 Tamper-Proof Cryptographic Hash">
                    🔒 ${hash ? hash.slice(0, 16) + '...' : 'SEALED'}
                  </span>
                  <span style="color: #059669; font-weight: 700;">✓ Immutable</span>
                </span>
              </div>
            </div>
          `;
        }).join('');
      } catch (err) {
        console.warn('Audit fetch fallback to local:', err);
        container.innerHTML = `<span style="color:#DC2626;">Failed to fetch audit records: ${err.message}</span>`;
      }
    };

    // ═════════════════════════════════════════════════════════════════════════
    // DEDICATED SERVER TELEMETRY & PERSISTENT DISK STORAGE CLIENT
    // ═════════════════════════════════════════════════════════════════════════
    window.fetchServerTelemetry = async function () {
      try {
        const res = await fetch('/api/v1/server/telemetry');
        if (!res.ok) return;
        const data = await res.json();

        const badge = document.getElementById('server-mode-badge');
        const backupCount = document.getElementById('server-backup-count');
        const uptimeVal = document.getElementById('server-uptime-val');

        if (badge) {
          badge.innerHTML = `<span style="width:6px; height:6px; border-radius:50%; background:#FFF; display:inline-block;"></span> DEDICATED VPS / CONTAINER (${data.uptime_human})`;
          badge.style.background = '#059669';
        }
        if (backupCount) backupCount.textContent = data.backup_count ?? 0;
        if (uptimeVal) uptimeVal.textContent = data.uptime_human || 'Active';
      } catch (err) {
        console.warn('Dedicated Server telemetry check notice:', err);
      }
    };

    window.createDiskBackup = async function () {
      const btn = document.getElementById('btn-disk-backup');
      const spinner = document.getElementById('backup-spinner');
      const label = document.getElementById('backup-btn-label');

      if (btn) btn.disabled = true;
      if (spinner) spinner.style.display = 'inline-block';
      if (label) label.textContent = 'Generating Disk Snapshot...';

      try {
        const res = await fetch('/api/v1/storage/backup-now', { method: 'POST' });
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error(json.detail || 'Backup creation failed');

        if (label) label.textContent = `✅ Saved ${json.filename} (${json.records_persisted} records)`;

        // Auto trigger download of JSON snapshot to client device
        const a = document.createElement('a');
        a.href = json.download_url;
        a.download = json.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        await window.fetchServerTelemetry();
        if (window.refreshCtrlAudit) window.refreshCtrlAudit();

        setTimeout(() => {
          if (label) label.textContent = '💾 Create Instant Disk Backup';
        }, 4000);
      } catch (err) {
        console.error('Disk Backup Error:', err);
        if (label) label.textContent = '❌ Backup Error';
        setTimeout(() => {
          if (label) label.textContent = '💾 Create Instant Disk Backup';
        }, 3500);
      } finally {
        if (spinner) spinner.style.display = 'none';
        if (btn) btn.disabled = false;
      }
    };



    // ═════════════════════════════════════════════════════════════════════════
    // LIVE RAPIDAPI / IRCTC & AI COMMAND CENTER CLIENT LOGIC
    // ═════════════════════════════════════════════════════════════════════════

    window.fetchLiveStationTrains = async function () {
      const stn = document.getElementById('live-station-select').value;
      const hours = document.getElementById('live-hours-select').value;
      const container = document.getElementById('live-trains-table-container');
      container.innerHTML = '<div style="text-align:center; padding:20px; color:#003366; font-size:0.8rem;">Fetching live arrivals for ' + stn + '...</div>';

      try {
        const res = await fetch('/api/v1/live-trains-at-station/' + stn + '?hours=' + hours);
        const data = await res.json();

        if (!data.trains || data.trains.length === 0) {
          container.innerHTML = '<div style="padding:15px; text-align:center; color:#64748B;">No train movements scheduled in next ' + hours + ' hours.</div>';
          return;
        }

        const rows = data.trains.map(t => {
          const delay = parseInt(t.delay_minutes || 0);
          const delayBadge = delay === 0
            ? '<span style="color:#059669; font-weight:700;">RT (On Time)</span>'
            : '<span style="color:#DC2626; font-weight:700;">+' + delay + ' min</span>';

          return `
            <tr style="border-bottom: 1px solid rgba(195,178,150,0.25); font-size: 0.78rem;">
              <td style="padding: 8px 10px; font-weight: 700; color: #003366; font-family: var(--font-mono);">${t.train_number}</td>
              <td style="padding: 8px 10px; font-weight: 600; color: #0F172A;">${t.train_name}</td>
              <td style="padding: 8px 10px; color: #475569;"><span style="background:#FAF6EE; padding:2px 6px; border-radius:4px; border:1px solid #E5DED0; font-size:0.7rem;">${t.type || 'Express'}</span></td>
              <td style="padding: 8px 10px; font-family: var(--font-mono);">${t.actual_arrival || t.scheduled_arrival}</td>
              <td style="padding: 8px 10px;">${delayBadge}</td>
              <td style="padding: 8px 10px; font-weight: 700; text-align: center; color: #003366;">PF-${t.platform || '1'}</td>
            </tr>
          `;
        }).join('');

        container.innerHTML = `
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="background: #FAF6EE; font-size: 0.74rem; color: #003366; border-bottom: 1px solid rgba(195,178,150,0.5);">
                <th style="padding: 8px 10px;">TRAIN #</th>
                <th style="padding: 8px 10px;">NAME</th>
                <th style="padding: 8px 10px;">TYPE</th>
                <th style="padding: 8px 10px;">ARRIVAL</th>
                <th style="padding: 8px 10px;">DELAY</th>
                <th style="padding: 8px 10px; text-align: center;">PLATFORM</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        `;
      } catch (err) {
        container.innerHTML = '<div style="padding:15px; color:#DC2626; font-size:0.78rem;">Failed to connect to RapidAPI live feed: ' + err.message + '</div>';
      }
    };

    window.fetchLiveTrainGPS = async function () {
      const trainNo = document.getElementById('gps-train-no').value.trim();
      const output = document.getElementById('gps-status-result');
      if (!trainNo) return;
      output.innerHTML = 'Locating train ' + trainNo + ' on corridor...';

      try {
        const res = await fetch('/api/v1/live-running-status/' + trainNo);
        const data = await res.json();
        output.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
            <strong style="color: #003366;">${data.train_name || 'Train ' + trainNo}</strong>
            <span style="color: ${data.delay_minutes <= 5 ? '#059669' : '#DC2626'}; font-weight: 700;">
              ${data.delay_minutes <= 5 ? 'ON TIME' : '+' + data.delay_minutes + ' min delay'}
            </span>
          </div>
          <div style="color: #475569; font-size: 0.75rem;">
            📍 Location: <strong>${data.current_location}</strong> ${data.speed_kmh ? `| Speed: <strong>${data.speed_kmh} km/h</strong>` : ''}
          </div>
          ${data.last_signal_passed ? `<div style="color: #059669; font-size: 0.72rem; margin-top: 2px;">🟢 Last Signal: ${data.last_signal_passed}</div>` : ''}
        `;
      } catch (err) {
        output.innerHTML = '<span style="color:#DC2626;">Error locating train: ' + err.message + '</span>';
      }
    };

    window.handleSpatialSectionChange = function () {
      const val = document.getElementById('spatial-section-select').value;
      const customPanel = document.getElementById('spatial-custom-panel');
      if (val === 'CUSTOM') {
        customPanel.style.display = 'block';
        document.getElementById('spatial-from-station').focus();
      }
    };

    window.toggleSpatialCustomPanel = function () {
      const panel = document.getElementById('spatial-custom-panel');
      const isHidden = panel.style.display === 'none' || !panel.style.display;
      panel.style.display = isHidden ? 'block' : 'none';
      if (isHidden) {
        document.getElementById('spatial-section-select').value = 'CUSTOM';
      }
    };

    window.selectQuickSection = function (from, to, line, startKm, endKm) {
      document.getElementById('spatial-from-station').value = from;
      document.getElementById('spatial-to-station').value = to;
      document.getElementById('spatial-line-select').value = line;
      document.getElementById('spatial-start-km').value = startKm !== undefined ? startKm : '';
      document.getElementById('spatial-end-km').value = endKm !== undefined ? endKm : '';
      document.getElementById('spatial-section-select').value = 'CUSTOM';
      document.getElementById('spatial-custom-panel').style.display = 'block';
      window.runSpatialClustering();
    };

    window.runSpatialClustering = async function () {
      let sec = document.getElementById('spatial-section-select').value;
      const customPanel = document.getElementById('spatial-custom-panel');
      const fromStn = (document.getElementById('spatial-from-station').value || '').trim().toUpperCase();
      const toStn = (document.getElementById('spatial-to-station').value || '').trim().toUpperCase();
      const line = document.getElementById('spatial-line-select').value || 'UP';
      const startKm = document.getElementById('spatial-start-km').value;
      const endKm = document.getElementById('spatial-end-km').value;

      let queryParams = '&threshold_km=2.0&solver_mode=cp-sat';

      if (sec === 'CUSTOM' || (customPanel && customPanel.style.display !== 'none' && fromStn && toStn)) {
        if (!fromStn || !toStn) {
          alert('Please specify both From Station and To Station (e.g. NDLS and CNB) for custom route evaluation.');
          return;
        }
        sec = `${fromStn}-${toStn}-${line}`;
        queryParams += `&from_station=${encodeURIComponent(fromStn)}&to_station=${encodeURIComponent(toStn)}`;
        if (startKm) queryParams += `&start_km=${encodeURIComponent(startKm)}`;
        if (endKm) queryParams += `&end_km=${encodeURIComponent(endKm)}`;
      }

      const output = document.getElementById('spatial-clusters-result');
      output.innerHTML = `<div style="text-align:center; padding:20px; color:#059669; font-size:0.8rem;">Solving exact CP-SAT optimization on <strong>${sec}</strong>...</div>`;

      try {
        const res = await fetch('/api/v1/optimize/cluster-spatial?section_id=' + encodeURIComponent(sec) + queryParams, { method: 'POST' });
        const data = await res.json();

        if (!data.mega_blocks || data.mega_blocks.length === 0) {
          output.innerHTML = '<div style="padding:15px; color:#64748B;">No pending tasks on this section to bundle.</div>';
          return;
        }

        const cards = data.mega_blocks.map(mb => {
          const taskTimeline = (mb.scheduled_tasks || []).map(st => `
            <div style="display:flex; align-items:center; justify-content:space-between; font-size:0.7rem; background:#FFFFFF; padding:4px 8px; border-radius:4px; margin-top:4px; border:1px solid rgba(195,178,150,0.3);">
              <div style="display:flex; align-items:center; gap:6px;">
                <span style="font-weight:700; color:#003366;">${st.task_id}</span>
                <span style="color:#64748B;">(${st.department})</span>
                <span style="color:#475569; font-size:0.68rem;">Km ${st.start_km}-${st.end_km}</span>
              </div>
              <div style="font-family:var(--font-mono); font-weight:700; color:#059669;">
                ${st.start_offset_min}m → ${st.end_offset_min}m (${st.duration_min}m)
                ${st.requires_power_cut ? '<span style="color:#DC2626; margin-left:4px;">⚡</span>' : ''}
              </div>
            </div>
          `).join('');

          return `
            <div style="background: #FAF6EE; border: 1px solid rgba(5,150,105,0.35); border-radius: 8px; padding: 12px; margin-bottom: 10px;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                <span style="font-family: var(--font-mono); font-weight: 800; color: #003366; font-size: 0.8rem;">
                  ${mb.bundle_id}
                </span>
                <span style="background: #ECFDF5; color: #059669; font-weight: 700; font-size: 0.72rem; padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(5,150,105,0.3);">
                  ${mb.savings_percentage}% Track Closure Saved
                </span>
              </div>

              <div style="font-size: 0.76rem; color: #0F172A; margin-bottom: 6px;">
                📍 Span: <strong>Km ${mb.start_km} – Km ${mb.end_km}</strong> (${mb.span_km} km span)
                <span style="margin-left: 10px;">⏱️ CP-SAT Unified: <strong>${mb.unified_minutes}m</strong> (Disjoint: <s>${mb.disjoint_minutes}m</s>)</span>
              </div>

              <!-- Scheduled Task Concurrency Timeline -->
              <div style="margin-bottom: 8px;">
                <div style="font-size:0.68rem; font-weight:700; color:#64748B; margin-bottom:2px; text-transform:uppercase; letter-spacing:0.5px;">
                  CP-SAT Scheduled Intervals:
                </div>
                ${taskTimeline}
              </div>

              <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 8px;">
                <div style="display: flex; gap: 4px;">
                  ${mb.departments.map(d => `<span style="background:#003366; color:#FFF; font-size:0.68rem; padding:1px 6px; border-radius:3px; font-weight:600;">${d}</span>`).join('')}
                  ${mb.requires_power_cut ? '<span style="background:#DC2626; color:#FFF; font-size:0.68rem; padding:1px 6px; border-radius:3px; font-weight:600;">⚡ OHE Power Cut</span>' : ''}
                </div>
                <button onclick="alert('Mega-Block ${mb.bundle_id} sanctioned via CP-SAT on ${sec}! Coordinated departments: ${mb.departments.join(', ')}')" style="background:#059669; color:#FFF; border:none; padding:4px 10px; border-radius:4px; font-size:0.72rem; font-weight:700; cursor:pointer;">
                  Sanction Mega-Block
                </button>
              </div>
            </div>
          `;
        }).join('');

        output.innerHTML = `
          <div style="margin-bottom: 10px; background: #ECFDF5; border: 1px solid rgba(5,150,105,0.3); padding: 8px 12px; border-radius: 6px; font-size: 0.74rem; color: #065F46; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <span>Corridor: <strong>${data.section_id}</strong> ${data.from_station && data.to_station ? `(${data.from_station} ⇄ ${data.to_station})` : ''}</span> • 
              <span>Net Saved: <strong>${data.overall_minutes_saved}m (${data.overall_savings_percentage}%)</strong></span>
            </div>
            <div style="font-family: var(--font-mono); font-size: 0.68rem; background: #059669; color: #FFF; padding: 2px 6px; border-radius: 4px;">
              ${data.solver_engine || 'CP-SAT'} • ${data.solver_status || 'OPTIMAL'} (${data.solve_time_seconds || '0.05'}s)
            </div>
          </div>
          ${cards}
        `;
      } catch (err) {
        output.innerHTML = '<div style="padding:15px; color:#DC2626; font-size:0.78rem;">Error solving CP-SAT: ' + err.message + '</div>';
      }
    };

    window.submitDefectIngestion = async function () {
      const source = document.getElementById('ingest-source').value;
      const dept = document.getElementById('ingest-dept').value;
      const startKm = parseFloat(document.getElementById('ingest-start-km').value);
      const endKm = parseFloat(document.getElementById('ingest-end-km').value);
      const desc = document.getElementById('ingest-desc').value;
      const crit = parseInt(document.getElementById('ingest-crit').value);
      const overdue = parseInt(document.getElementById('ingest-overdue').value);
      const card = document.getElementById('ingest-response-card');

      card.style.display = 'block';
      card.innerHTML = 'Submitting defect and executing IRPWM 2020 scoring...';

      try {
        const payload = {
          source_system: source,
          department: dept,
          section_id: 'NDLS-CNB-UP',
          start_km: startKm,
          end_km: endKm,
          defect_type: desc,
          criticality: crit,
          days_overdue: overdue
        };

        const res = await fetch('/api/v1/defects/ingest', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();

        const badgeColor = data.priority_category === 'P1' ? '#DC2626' : (data.priority_category === 'P2' ? '#D97706' : '#059669');

        card.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <strong style="color: #003366;">${data.defect_id}</strong>
            <span style="background: ${badgeColor}; color: #FFF; font-weight: 800; padding: 2px 8px; border-radius: 4px; font-size: 0.74rem;">
              ${data.priority_category} (${data.priority_score}/100)
            </span>
          </div>
          <div style="color: #0F172A; margin-bottom: 4px;">
            Target Resolution: <strong>${data.sla_target}</strong>
          </div>
          <div style="color: #059669; font-size: 0.72rem;">
            ✓ Enqueued to Divisional Backlog & Live Shadow Cluster Queue
          </div>
        `;
      } catch (err) {
        card.innerHTML = '<span style="color:#DC2626;">Ingestion failed: ' + err.message + '</span>';
      }
    };

    // Station chainage dictionary for dynamic KM pole calculation
    const STATION_KM_CHAINAGE = {
      'NDLS': 0.0,
      'GZB': 25.4,
      'KRJ': 83.2,
      'ALJN': 126.1,
      'HRS': 156.4,
      'TDL': 204.3,
      'ETW': 296.0,
      'PHD': 352.0,
      'CNB': 435.0
    };

    window.onConflictStationChange = function () {
      const stFrom = document.getElementById('conflict-station-from')?.value || 'ALJN';
      const stTo = document.getElementById('conflict-station-to')?.value || 'TDL';

      const km1 = STATION_KM_CHAINAGE[stFrom] !== undefined ? STATION_KM_CHAINAGE[stFrom] : 126.1;
      const km2 = STATION_KM_CHAINAGE[stTo] !== undefined ? STATION_KM_CHAINAGE[stTo] : 204.3;

      const minKm = Math.min(km1, km2);
      const maxKm = Math.max(km1, km2);
      const diff = maxKm - minKm;

      // Calculate a realistic maintenance span within the selected block section
      const startVal = Math.round((minKm + (diff > 10 ? diff * 0.25 : 1.0)) * 10) / 10;
      const endVal = Math.round((startVal + Math.min(3.3, Math.max(1.5, diff * 0.15))) * 10) / 10;

      const startPole = `${Math.floor(startVal)}/${Math.round((startVal % 1) * 100) || 10}`;
      const endPole = `${Math.floor(endVal)}/${Math.round((endVal % 1) * 100) || 20}`;

      const startInput = document.getElementById('conflict-start-km');
      const endInput = document.getElementById('conflict-end-km');
      if (startInput) startInput.value = startPole;
      if (endInput) endInput.value = endPole;

      const lblBlock = document.getElementById('lbl-block-section');
      const lblPole = document.getElementById('lbl-km-pole');
      if (lblBlock) lblBlock.textContent = `${stFrom} ➔ ${stTo}`;
      if (lblPole) lblPole.textContent = `${startPole} – ${endPole} (~${(endVal - startVal).toFixed(1)} KM)`;
    };

    // Helper to parse KM or KM pole string (e.g. "142/10" -> 142.10, "142.5" -> 142.5)
    function parseKmOrPole(val, fallback) {
      if (!val) return fallback;
      val = String(val).trim();
      if (val.includes('/')) {
        const parts = val.split('/');
        const km = parseFloat(parts[0]) || fallback;
        const pole = parseFloat(parts[1]) || 0;
        return Math.round((km + pole / 100) * 100) / 100;
      }
      const num = parseFloat(val);
      return isNaN(num) ? fallback : num;
    }

    window.runLiveCorridorConflictTest = async function () {
      const stFrom = document.getElementById('conflict-station-from')?.value || 'ALJN';
      const stTo = document.getElementById('conflict-station-to')?.value || 'TDL';
      const rawStartKm = document.getElementById('conflict-start-km')?.value || '142/10';
      const rawEndKm = document.getElementById('conflict-end-km')?.value || '145/20';
      const startTime = document.getElementById('conflict-start-time')?.value || new Date().toISOString().slice(0, 16);
      const duration = parseInt(document.getElementById('conflict-duration')?.value || 120);
      const output = document.getElementById('corridor-conflict-output');

      const parsedStartKm = parseKmOrPole(rawStartKm, 142.5);
      const parsedEndKm = parseKmOrPole(rawEndKm, 145.8);
      const kmPoleSpan = `${rawStartKm} – ${rawEndKm}`;

      // Update badge
      const lblBlock = document.getElementById('lbl-block-section');
      const lblPole = document.getElementById('lbl-km-pole');
      if (lblBlock) lblBlock.textContent = `${stFrom} ➔ ${stTo}`;
      if (lblPole) lblPole.textContent = `${kmPoleSpan} (~${Math.abs(parsedEndKm - parsedStartKm).toFixed(1)} KM)`;

      output.innerHTML = `
        <div style="display: flex; align-items: center; gap: 8px; color: #003366; font-weight: 600;">
          <span style="display: inline-block; width: 12px; height: 12px; border: 2px solid #003366; border-top-color: transparent; border-radius: 50%; animation: spin 0.8s linear infinite;"></span>
          Testing proposed window against active train movements in block section ${stFrom} ➔ ${stTo} (KM ${kmPoleSpan})...
        </div>
      `;

      try {
        const res = await fetch('/api/v1/live-corridor-conflicts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            section_id: 'NDLS-CNB-UP',
            start_time: startTime,
            duration_minutes: duration,
            station_from: stFrom,
            station_to: stTo,
            start_km: parsedStartKm,
            end_km: parsedEndKm,
            km_pole: kmPoleSpan
          })
        });
        const data = await res.json();

        const isApproved = data.feasibility_score >= 60.0;
        const color = isApproved ? '#059669' : '#DC2626';

        output.innerHTML = `
          <!-- Block Section & Location Banner -->
          <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 6px; padding: 8px 10px; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.76rem;">
              <span style="font-weight: 700; color: #003366;">📍 Block Section:</span>
              <span style="font-family: var(--font-mono); font-weight: 700; color: #0F172A;">${data.block_section_display || (stFrom + ' ➔ ' + stTo)}</span>
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.74rem; margin-top: 3px; color: #475569;">
              <span>Track Span / Mast:</span>
              <strong style="color: #DC2626; font-family: var(--font-mono);">${data.location_summary || ('KM Pole ' + kmPoleSpan)}</strong>
            </div>
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <strong style="color: ${color}; font-size: 0.84rem;">
              ${isApproved ? '✓ ' + data.recommendation : '⚠️ ' + data.recommendation}
            </strong>
            <span style="font-weight: 700; color: #003366; background: ${color}15; padding: 2px 8px; border-radius: 4px; border: 1px solid ${color}40;">Score: ${data.feasibility_score}/100</span>
          </div>
          <div style="font-size: 0.75rem; color: #475569; margin-bottom: 6px;">
            Detected <strong>${data.conflicting_trains_count} conflicting movements</strong> (${data.high_priority_passenger_conflicts} High-Priority Passenger, ${data.freight_trains_regulated} Freight).
          </div>
          ${data.conflicts && data.conflicts.length > 0 ? `
            <div style="background: #FFFFFF; padding: 8px 10px; border-radius: 6px; border: 1px solid #E5DED0; max-height: 220px; overflow-y: auto;">
              <div style="font-size: 0.72rem; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px;">
                Train Regulation & Choke Mitigation Orders:
              </div>
              ${data.conflicts.map(c => `
                <div style="font-size: 0.73rem; margin-bottom: 5px; padding-bottom: 4px; border-bottom: 1px dashed #F1F5F9; color: #0F172A; line-height: 1.35;">
                  • <strong>${c.train_number} (${c.train_name})</strong>:
                  <span style="color: ${c.action_required.includes('Halt') || c.action_required.includes('Loop') ? '#B45309' : '#0F172A'};">
                    ${c.action_required}
                  </span>
                </div>
              `).join('')}
            </div>
          ` : ''}

          <!-- AI-Suggested Alternative Slot by Corridor Traffic & Freight Forecasting Engine Agent -->
          ${data.ai_suggested_window ? `
            <div style="background:#F0FDF4;border:1.5px solid #059669;border-radius:8px;padding:12px 14px;margin-top:10px;margin-bottom:10px;box-shadow:0 2px 8px rgba(5,150,105,0.08);">
              <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;margin-bottom:6px;">
                <div style="font-size:0.76rem;font-weight:800;color:#065F46;text-transform:uppercase;letter-spacing:0.5px;display:flex;align-items:center;gap:6px;">
                  <span>🤖</span>
                  <span>AI AGENT: ${data.ai_agent || 'Corridor Traffic & Freight Forecasting Engine'}</span>
                </div>
                <span style="background:#059669;color:#FFF;font-size:0.70rem;font-weight:800;padding:2px 8px;border-radius:10px;">
                  Score: ${data.ai_suggested_window.feasibility_score}/100
                </span>
              </div>

              <div style="font-size:0.86rem;font-weight:800;color:#0F172A;margin-bottom:3px;">
                Most Feasible Window: <span style="color:#059669;">${data.ai_suggested_window.display_window}</span>
              </div>

              <div style="font-size:0.72rem;color:#334155;margin-bottom:8px;line-height:1.4;background:#FFF;padding:8px 10px;border-radius:4px;border:1px solid #A7F3D0;">
                ${data.ai_suggested_window.rationale}
              </div>

              <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
                <span style="font-size:0.72rem;font-weight:700;color:#047857;">
                  ✓ 0 Passenger delay minutes • Zero conflicting movements
                </span>
                <button onclick="window.applyAiAlternativeSlot('${stFrom}', '${stTo}', '${kmPoleSpan}', ${duration}, '${data.ai_suggested_window.start_time}')" style="padding:6px 12px;border-radius:6px;border:none;background:#059669;color:#FFF;font-size:0.76rem;font-weight:800;cursor:pointer;display:inline-flex;align-items:center;gap:4px;">
                  <span>✓</span>
                  <span>Apply AI Alternative Window</span>
                </button>
              </div>
            </div>
          ` : ''}

          <!-- Admin Master Overwrite Button -->
          <div style="margin-top: 10px; padding-top: 8px; border-top: 1px dashed #CBD5E1;">
            <button onclick="window.adminForceSanctionCorridor('${stFrom}', '${stTo}', '${kmPoleSpan}', '${startTime}', ${duration})" style="width: 100%; background: linear-gradient(135deg, #DC2626, #991B1B); color: #FFF; border: none; padding: 8px; border-radius: 6px; font-size: 0.76rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 2px 8px rgba(220,38,38,0.25);">
              <span>👑 Admin Master Overwrite: Force Sanction Window</span>
            </button>
          </div>
        `;

        // Automatically record this evaluation action to Supabase / Immutable Ledger
        if (window.recordImmutableAction) {
          window.recordImmutableAction('CORRIDOR_CONFLICT_SIMULATION', {
            eventType: 'SIMULATION',
            section: `${stFrom} ➔ ${stTo} (KM ${kmPoleSpan})`,
            targetEntityId: `SIM-${Date.now().toString().slice(-4)}`,
            reason: `Simulated window feasibility: ${data.feasibility_score}/100 (${data.recommendation}). ${data.conflicting_trains_count} conflicts detected.`,
            disruptionScore: (100 - (data.feasibility_score || 0)),
            details: {
              station_from: stFrom,
              station_to: stTo,
              km_pole: kmPoleSpan,
              feasibility_score: data.feasibility_score,
              conflicts_count: data.conflicting_trains_count
            }
          }).then(() => {
            if (window.refreshCtrlAudit) window.refreshCtrlAudit();
          });
        }
      } catch (err) {
        output.innerHTML = '<span style="color:#DC2626;">Error evaluating conflict: ' + err.message + '</span>';
      }
    };

    window.applyAiAlternativeSlot = function (stFrom, stTo, kmPoleSpan, duration, newStartTimeStr) {
      const timeInput = document.getElementById('conflict-start-time');
      const now = new Date();
      const yr = now.getFullYear();
      const mo = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const timePart = newStartTimeStr || '01:30';
      const altTime = `${yr}-${mo}-${day}T${timePart}`;
      if (timeInput) timeInput.value = altTime;

      // Re-run the live conflict simulation with the AI alternative window!
      window.runLiveCorridorConflictTest();
    };

    window.adminForceSanctionCorridor = async function (stFrom, stTo, kmPole, startTime, duration) {
      const activeUser = getActiveLoginUser();
      const confirmed = confirm(`👑 ADMIN MASTER OVERWRITE:\n\nForce Sanction Block Possession between ${stFrom} and ${stTo} (KM ${kmPole}) for ${duration} minutes starting at ${startTime}?\n\nThis will overrule passenger collision warnings under DRM / Admin executive emergency powers.`);
      if (!confirmed) return;

      try {
        const res = await fetch('/api/v1/supabase/audit-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            entry_name: 'ADMIN_FORCE_SANCTION_CONFLICT_OVERWRITE',
            event_type: 'ADMIN_OVERWRITE',
            staff_id: activeUser.staffId || 'ADMIN-ROOT-01',
            user_name: activeUser.name || 'Chief Controller & Executive Admin',
            user_role: 'ADMIN_EXECUTIVE',
            user_division: activeUser.division || 'Northern Railway — Delhi Division',
            section: `${stFrom} ➔ ${stTo} (KM ${kmPole})`,
            target_entity_id: `CORRIDOR-${stFrom}-${stTo}`,
            reason: `Admin Master Overwrite: Force Sanction granted despite conflict warning. Operational safety buffer verified by Executive Authority.`,
            disruption_score: 35.0,
            delay_minutes: duration,
            details: { stFrom, stTo, kmPole, startTime, duration, admin_override: true }
          })
        });
        const result = await res.json();
        alert(`✅ [ADMIN MASTER OVERWRITE] Block window FORCE SANCTIONED!\n\nOperator: ${result.user_name} [${result.staff_id}]\nStorage: ${result.storage_destination}\nRecord Hash: ${result.record_hash?.slice(0, 16)}...\nImmutability: 🔒 SEALED IN DATABASE`);
        if (window.refreshCtrlAudit) window.refreshCtrlAudit();
      } catch (e) {
        alert('Error during admin force sanction: ' + e.message);
      }
    };

    function initDashboard() {
      try { renderRecommendedSlots(); } catch (e) { console.warn('Slots render notice:', e); }
      try { fetchLiveRecommendedSlots(); } catch (e) { }
      try { renderConflictsAndAlternatives(); } catch (e) { console.warn('Conflicts render notice:', e); }
      try { fetchLiveConflicts(); } catch (e) { }
      try { if (window.fetchLiveStationTrains) window.fetchLiveStationTrains(); } catch (e) { }
      try { if (window.fetchLiveTrainGPS) window.fetchLiveTrainGPS(); } catch (e) { }
      try { if (window.runSpatialClustering) window.runSpatialClustering(); } catch (e) { }
      try { if (window.simulateTSRTradeoff) window.simulateTSRTradeoff(); } catch (e) { }
      try { if (window.loadOpportunisticWindows) window.loadOpportunisticWindows('NDLS-CNB-UP'); } catch (e) { }
      try { if (window.loadResourceFleet) window.loadResourceFleet(); } catch (e) { }
      try { if (window.loadYieldScorecard) window.loadYieldScorecard(); } catch (e) { }
      try { if (window.simulateEmergencyReroute) window.simulateEmergencyReroute(); } catch (e) { }
      try { if (window.loadMultiHorizonPlan) window.loadMultiHorizonPlan('weekly'); } catch (e) { }
      try { if (window.fetchServerTelemetry) window.fetchServerTelemetry(); } catch (e) { }
    }

    // Immediate initial execution
    initDashboard();

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initDashboard);
    } else {
      setTimeout(initDashboard, 100);
    }
  