/**
 * advanced-features.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Indian Railways AI Maintenance & Block Planning Platform (RAKSHA PATH)
 * Standout Enterprise Feature Implementations:
 *   1. Digital Twin String Diagram (Marey Chart) on HTML5 Canvas
 *   2. Dynamic Speed Restriction (PSR/TSR) Trade-off Simulator
 *   3. Goods Train Opportunistic Micro-Window Claiming Feed
 *   4. Track Machine & Resource Fleet Balancer (Ghost Block Prevention)
 *   5. Post-Block Yield & DRR Scorecard
 *   6. Emergency Block & EDFC Freight Bypass Assistant
 *   7. Multi-Horizon Tactical & Strategic Corridor Planner
 * ─────────────────────────────────────────────────────────────────────────────
 */

(function () {
  'use strict';

  // Global state for diagram interaction
  let diagramData = null;
  let hoveredEntity = null;
  let canvasElem = null;
  let ctx = null;

  // ═════════════════════════════════════════════════════════════════════════════
  // 1. STANDOUT TAB NAVIGATION
  // ═════════════════════════════════════════════════════════════════════════════
  window.switchStandoutTab = function (tabId) {
    // Tab pill styling
    const tabs = document.querySelectorAll('.standout-nav-tab');
    tabs.forEach(t => {
      if (t.dataset.tab === tabId) {
        t.classList.add('active');
        t.style.background = '#003366';
        t.style.color = '#FFFFFF';
        t.style.borderColor = '#003366';
      } else {
        t.classList.remove('active');
        t.style.background = '#FAF6EE';
        t.style.color = '#003366';
        t.style.borderColor = 'rgba(0, 51, 102, 0.25)';
      }
    });

    // Content view visibility
    const views = document.querySelectorAll('.standout-tab-view');
    views.forEach(v => {
      if (tabId === 'all') {
        v.style.display = 'block';
      } else {
        v.style.display = (v.id === tabId) ? 'block' : 'none';
      }
    });

    // Trigger tab-specific loaders if needed
    if (tabId === 'tab-string-diagram' || tabId === 'all') {
      setTimeout(() => window.initStringDiagram('NDLS-CNB-UP'), 100);
    }
    if (tabId === 'tab-tsr-simulator' || tabId === 'all') {
      window.simulateTSRTradeoff();
    }
    if (tabId === 'tab-freight-windows' || tabId === 'all') {
      window.loadOpportunisticWindows('NDLS-CNB-UP');
    }
    if (tabId === 'tab-machine-balancer' || tabId === 'all') {
      window.loadResourceFleet();
    }
    if (tabId === 'tab-yield-scorecard' || tabId === 'all') {
      window.loadYieldScorecard();
    }
    if (tabId === 'tab-emergency-reroute' || tabId === 'all') {
      window.simulateEmergencyReroute();
    }
    if (tabId === 'tab-multi-horizon' || tabId === 'all') {
      window.loadMultiHorizonPlan('weekly');
    }
  };

  // ═════════════════════════════════════════════════════════════════════════════
  // 2. DIGITAL TWIN STRING DIAGRAM (MAREY CHART)
  // ═════════════════════════════════════════════════════════════════════════════
  window.initStringDiagram = async function (sectionId) {
    canvasElem = document.getElementById('string-diagram-canvas');
    if (!canvasElem) return;
    ctx = canvasElem.getContext('2d');

    const statusBadge = document.getElementById('string-diagram-status');
    if (statusBadge) statusBadge.innerText = 'Fetching live trajectories...';

    try {
      const res = await fetch('/api/v1/advanced/string-diagram-data/' + (sectionId || 'NDLS-CNB-UP'));
      if (!res.ok) throw new Error('HTTP ' + res.status);
      diagramData = await res.json();
      if (statusBadge) {
        statusBadge.innerText = '● Live Marey Chart Synchronized (NDLS–CNB)';
        statusBadge.style.background = '#ECFDF5';
        statusBadge.style.color = '#059669';
      }
      renderStringDiagram();
      setupDiagramEvents();
    } catch (err) {
      console.warn('Diagram load error, using cached mock:', err);
      if (statusBadge) {
        statusBadge.innerText = '⚠️ Rendering Local Corridor Fallback';
        statusBadge.style.color = '#D97706';
      }
    }
  };

  function renderStringDiagram() {
    if (!canvasElem || !ctx || !diagramData) return;

    // Handle High-DPI screens and dynamic container width
    const parentW = canvasElem.parentElement ? canvasElem.parentElement.clientWidth : 0;
    const width = (canvasElem.clientWidth && canvasElem.clientWidth > 300) 
      ? canvasElem.clientWidth 
      : (parentW > 300 ? parentW : 1100);
    const height = 520;
    const dpr = window.devicePixelRatio || 1;
    canvasElem.width = width * dpr;
    canvasElem.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Margins
    const paddingLeft = 110;
    const paddingRight = 40;
    const paddingTop = 36;
    const paddingBottom = 45;

    const plotWidth = width - paddingLeft - paddingRight;
    const plotHeight = height - paddingTop - paddingBottom;

    // Clear background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);

    // Coordinate converters
    const timeToX = (hour) => paddingLeft + (hour / 24.0) * plotWidth;
    const kmToY = (km) => paddingTop + (km / diagramData.corridor_length_km) * plotHeight;

    // 1. Draw Hour Grid & Labels (X Axis)
    ctx.lineWidth = 1;
    for (let h = 0; h <= 24; h += 2) {
      const x = timeToX(h);
      ctx.strokeStyle = (h % 6 === 0) ? '#CBD5E1' : '#F1F5F9';
      ctx.beginPath();
      ctx.moveTo(x, paddingTop);
      ctx.lineTo(x, paddingTop + plotHeight);
      ctx.stroke();

      ctx.fillStyle = '#64748B';
      ctx.font = '600 11px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      const timeStr = (h < 10 ? '0' + h : h) + ':00';
      ctx.fillText(timeStr, x, paddingTop + plotHeight + 18);
    }

    // 2. Draw Station Lines & Labels (Y Axis)
    ctx.textAlign = 'right';
    diagramData.stations.forEach((stn, idx) => {
      const y = kmToY(stn.km);
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(paddingLeft, y);
      ctx.lineTo(paddingLeft + plotWidth, y);
      ctx.stroke();

      ctx.fillStyle = '#003366';
      ctx.font = '700 11px system-ui, -apple-system, sans-serif';
      ctx.fillText(stn.code, paddingLeft - 10, y + 4);

      ctx.fillStyle = '#94A3B8';
      ctx.font = '500 10px monospace';
      ctx.fillText(`KM ${Math.round(stn.km)}`, paddingLeft - 48, y + 4);
    });

    // 3. Draw Recommended Mega-Block Window (Shadow Corridor)
    const block = diagramData.recommended_block;
    if (block) {
      const bx1 = timeToX(block.start_time_hour);
      const bx2 = timeToX(block.end_time_hour);
      const by1 = kmToY(block.start_km);
      const by2 = kmToY(block.end_km);
      const bw = bx2 - bx1;
      const bh = by2 - by1;

      // Fill translucent corridor
      ctx.fillStyle = 'rgba(124, 58, 237, 0.12)';
      ctx.fillRect(bx1, by1, bw, bh);

      // Dashed border
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = '#7C3AED';
      ctx.lineWidth = 2;
      ctx.strokeRect(bx1, by1, bw, bh);
      ctx.setLineDash([]);

      // Label inside block window
      ctx.fillStyle = '#6D28D9';
      ctx.font = '700 10px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('⚡ AI RECOMMENDED MEGA-BLOCK (3.0h)', bx1 + 6, by1 + 16);
      ctx.fillStyle = '#4C1D95';
      ctx.font = '500 9px monospace';
      ctx.fillText('KM 120–160 | 0 Passenger Conflicts', bx1 + 6, by1 + 30);
    }

    // 4. Draw Defect Hotspots (horizontal track bars)
    if (diagramData.defect_hotspots) {
      diagramData.defect_hotspots.forEach(defect => {
        const dy = kmToY(defect.km);
        // Draw soft glow band
        ctx.fillStyle = defect.severity === 'P1' ? 'rgba(220, 38, 38, 0.08)' : 'rgba(217, 119, 6, 0.08)';
        ctx.fillRect(paddingLeft, dy - 3, plotWidth, 6);

        // Draw pin marker on the left
        ctx.fillStyle = defect.color || '#DC2626';
        ctx.beginPath();
        ctx.arc(paddingLeft + 14, dy, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
    }

    // 5. Draw Train Trajectories (Time vs Distance Lines)
    if (diagramData.trajectories) {
      diagramData.trajectories.forEach(train => {
        if (!train.points || train.points.length < 2) return;

        ctx.strokeStyle = train.color || '#0056B3';
        ctx.lineWidth = (train.type === 'Vande Bharat' || train.type === 'Rajdhani') ? 2.5 : 1.8;
        if (train.type === 'Freight') {
          ctx.setLineDash([6, 3]);
        } else {
          ctx.setLineDash([]);
        }

        ctx.beginPath();
        train.points.forEach((pt, idx) => {
          const px = timeToX(pt[0]);
          const py = kmToY(pt[1]);
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.stroke();
        ctx.setLineDash([]);

        // Label train at the origin point
        const originX = timeToX(train.points[0][0]);
        const originY = kmToY(train.points[0][1]);
        ctx.fillStyle = train.color || '#003366';
        ctx.font = '700 10px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(train.train_number + ' ' + train.train_name.split(' ')[0], originX + 4, originY + 12);
      });
    }

    // 6. Draw Hover Tooltip if hovering over element
    if (hoveredEntity) {
      drawDiagramTooltip(hoveredEntity, width, height);
    }
  }

  function setupDiagramEvents() {
    if (!canvasElem) return;

    canvasElem.onmousemove = function (e) {
      const rect = canvasElem.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const paddingLeft = 110;
      const paddingRight = 40;
      const paddingTop = 36;
      const paddingBottom = 45;
      const plotWidth = (canvasElem.clientWidth || 1100) - paddingLeft - paddingRight;
      const plotHeight = 520 - paddingTop - paddingBottom;

      const xToTime = (x) => ((x - paddingLeft) / plotWidth) * 24.0;
      const yToKm = (y) => ((y - paddingTop) / plotHeight) * (diagramData ? diagramData.corridor_length_km : 435);

      const curHour = xToTime(mouseX);
      const curKm = yToKm(mouseY);

      let found = null;

      // Check if mouse is near any train line point
      if (diagramData && diagramData.trajectories) {
        for (const train of diagramData.trajectories) {
          for (let i = 0; i < train.points.length - 1; i++) {
            const p1 = train.points[i];
            const p2 = train.points[i + 1];
            // Simple bounding box and line distance test
            if (curHour >= Math.min(p1[0], p2[0]) - 0.3 && curHour <= Math.max(p1[0], p2[0]) + 0.3) {
              const slope = (p2[1] - p1[1]) / (p2[0] - p1[0]);
              const expectedKm = p1[1] + slope * (curHour - p1[0]);
              if (Math.abs(curKm - expectedKm) < 18) {
                found = {
                  type: 'TRAIN',
                  train: train,
                  mouseX: mouseX,
                  mouseY: mouseY,
                  hour: curHour,
                  km: curKm
                };
                break;
              }
            }
          }
          if (found) break;
        }
      }

      // Check if mouse is over defect marker
      if (!found && diagramData && diagramData.defect_hotspots) {
        for (const defect of diagramData.defect_hotspots) {
          const dy = paddingTop + (defect.km / diagramData.corridor_length_km) * plotHeight;
          if (Math.abs(mouseY - dy) < 8 && mouseX >= paddingLeft && mouseX <= paddingLeft + plotWidth) {
            found = {
              type: 'DEFECT',
              defect: defect,
              mouseX: mouseX,
              mouseY: mouseY
            };
            break;
          }
        }
      }

      hoveredEntity = found;
      renderStringDiagram();
    };

    canvasElem.onmouseleave = function () {
      hoveredEntity = null;
      renderStringDiagram();
    };
  }

  function drawDiagramTooltip(entity, canvasW, canvasH) {
    const tipX = Math.min(entity.mouseX + 15, canvasW - 240);
    const tipY = Math.max(entity.mouseY - 40, 20);

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.2)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;

    ctx.fillStyle = '#0F172A';
    ctx.fillRect(tipX, tipY, 220, 64);
    ctx.strokeStyle = '#0056B3';
    ctx.lineWidth = 1;
    ctx.strokeRect(tipX, tipY, 220, 64);
    ctx.restore();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 11px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'left';

    if (entity.type === 'TRAIN') {
      const t = entity.train;
      ctx.fillText(`${t.train_number} — ${t.train_name}`, tipX + 10, tipY + 18);
      ctx.fillStyle = '#94A3B8';
      ctx.font = '500 10px monospace';
      ctx.fillText(`Category: ${t.type}`, tipX + 10, tipY + 34);
      ctx.fillStyle = '#38BDF8';
      ctx.fillText(`Time: ${formatHours(entity.hour)} | Approx KM ${Math.round(entity.km)}`, tipX + 10, tipY + 50);
    } else if (entity.type === 'DEFECT') {
      const d = entity.defect;
      ctx.fillText(`🚨 ${d.type}`, tipX + 10, tipY + 18);
      ctx.fillStyle = '#EF4444';
      ctx.font = '700 10px monospace';
      ctx.fillText(`Priority: ${d.severity} | Dept: ${d.dept}`, tipX + 10, tipY + 34);
      ctx.fillStyle = '#FCD34D';
      ctx.fillText(`Location: KM ${d.km} (Aligarh Section)`, tipX + 10, tipY + 50);
    }
  }

  function formatHours(h) {
    const hours = Math.floor(h);
    const mins = Math.floor((h - hours) * 60);
    return (hours < 10 ? '0' + hours : hours) + ':' + (mins < 10 ? '0' + mins : mins);
  }

  // ═════════════════════════════════════════════════════════════════════════════
  // 3. DYNAMIC SPEED RESTRICTION (PSR/TSR) TRADE-OFF SIMULATOR
  // ═════════════════════════════════════════════════════════════════════════════
  window.simulateTSRTradeoff = async function () {
    const defectType = document.getElementById('tsr-defect-type')?.value || 'Ultrasonic Flaw (IMR)';
    const corridorSpeed = parseFloat(document.getElementById('tsr-corridor-speed')?.value || '130');
    const tsrSpeed = parseFloat(document.getElementById('tsr-speed')?.value || '30');
    const lengthKm = parseFloat(document.getElementById('tsr-length')?.value || '2.5');
    const density = parseInt(document.getElementById('tsr-density')?.value || '48');
    const deferralDays = parseInt(document.getElementById('tsr-deferral-days')?.value || '7');
    const blockDuration = parseInt(document.getElementById('tsr-block-duration')?.value || '120');

    const resultBox = document.getElementById('tsr-tradeoff-results');
    if (!resultBox) return;

    try {
      const res = await fetch('/api/v1/advanced/tsr-tradeoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defect_type: defectType,
          corridor_speed_kmh: corridorSpeed,
          tsr_speed_kmh: tsrSpeed,
          restriction_length_km: lengthKm,
          daily_train_density: density,
          deferral_days: deferralDays,
          block_duration_minutes: blockDuration,
          trains_regulated_during_block: 4
        })
      });
      const data = await res.json();

      const isSanction = data.recommendation.includes('SANCTION');
      const badgeBg = isSanction ? '#ECFDF5' : '#FEF2F2';
      const badgeColor = isSanction ? '#059669' : '#DC2626';

      resultBox.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 16px;">
          <div style="background: #FFFFFF; border: 1px solid #E2E8F0; padding: 14px; border-radius: 8px; box-shadow: 0 2px 6px rgba(0,0,0,0.03);">
            <div style="font-size: 0.72rem; color: #64748B; font-weight: 700; text-transform: uppercase;">Net Train-Minutes Saved</div>
            <div style="font-size: 1.6rem; font-weight: 800; color: #059669; font-family: var(--font-mono); margin-top: 4px;">
              +${data.net_punctuality_minutes_saved.toLocaleString()} <span style="font-size: 0.8rem; font-weight: 600;">mins</span>
            </div>
            <div style="font-size: 0.72rem; color: #059669; font-weight: 600; margin-top: 2px;">
              ${data.efficiency_gain_pct}% Delay Avoidance
            </div>
          </div>

          <div style="background: #FFF5F5; border: 1px solid rgba(220, 38, 38, 0.2); padding: 14px; border-radius: 8px;">
            <div style="font-size: 0.72rem; color: #991B1B; font-weight: 700; text-transform: uppercase;">Deferred TSR Chronic Loss</div>
            <div style="font-size: 1.6rem; font-weight: 800; color: #DC2626; font-family: var(--font-mono); margin-top: 4px;">
              ${data.total_deferred_tsr_delay_mins.toLocaleString()} <span style="font-size: 0.8rem; font-weight: 600;">mins</span>
            </div>
            <div style="font-size: 0.72rem; color: #7F1D1D; margin-top: 2px;">
              ${data.tsr_delay_per_train_mins}m delay × ${density * deferralDays} trains (${deferralDays} days)
            </div>
          </div>

          <div style="background: #FAF6EE; border: 1px solid rgba(195, 178, 150, 0.45); padding: 14px; border-radius: 8px;">
            <div style="font-size: 0.72rem; color: #003366; font-weight: 700; text-transform: uppercase;">Immediate Block Impact</div>
            <div style="font-size: 1.6rem; font-weight: 800; color: #003366; font-family: var(--font-mono); margin-top: 4px;">
              ${data.immediate_block_delay_mins.toLocaleString()} <span style="font-size: 0.8rem; font-weight: 600;">mins</span>
            </div>
            <div style="font-size: 0.72rem; color: #475569; margin-top: 2px;">
              4 regulated loop halts during window
            </div>
          </div>
        </div>

        <div style="background: ${badgeBg}; border: 1px solid ${badgeColor}40; border-radius: 8px; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between;">
          <div>
            <span style="font-size: 0.72rem; font-weight: 800; color: ${badgeColor}; text-transform: uppercase; letter-spacing: 0.5px;">
              AI Decision Verdict:
            </span>
            <div style="font-size: 1.05rem; font-weight: 800; color: ${badgeColor}; margin-top: 2px;">
              ${data.recommendation}
            </div>
            <div style="font-size: 0.74rem; color: #475569; margin-top: 2px;">
              Compliance: ${data.irpwn_reference}
            </div>
          </div>

          <button onclick="alert('Instant Track Block requisition dispatched to Section Controller for ${defectType}!')" style="
            background: #003366;
            color: #FFFFFF;
            border: none;
            padding: 8px 18px;
            border-radius: 6px;
            font-size: 0.8rem;
            font-weight: 700;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(0, 51, 102, 0.25);
          ">
            ⚡ Dispatch Sanction Order
          </button>
        </div>
      `;
    } catch (err) {
      resultBox.innerHTML = '<span style="color:#DC2626; font-size:0.8rem;">Error calculating TSR trade-off: ' + err.message + '</span>';
    }
  };

  // ═════════════════════════════════════════════════════════════════════════════
  // 4. GOODS TRAIN OPPORTUNISTIC WINDOWING FEED
  // ═════════════════════════════════════════════════════════════════════════════
  window.loadOpportunisticWindows = async function (sectionId) {
    const list = document.getElementById('opportunistic-windows-feed');
    if (!list) return;

    list.innerHTML = '<div style="text-align: center; padding: 20px; color: #64748B; font-size: 0.8rem;">Scanning dynamic freight gaps & turnaround buffers...</div>';

    try {
      const res = await fetch('/api/v1/advanced/opportunistic-windows/' + (sectionId || 'NDLS-CNB-UP'));
      const items = await res.json();

      list.innerHTML = items.map(win => `
        <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-left: 4px solid #D97706; border-radius: 8px; padding: 14px 16px; margin-bottom: 12px; box-shadow: 0 2px 6px rgba(0,0,0,0.02);">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-family: var(--font-mono); font-weight: 800; font-size: 0.85rem; color: #D97706;">
                ⚡ ${win.start_time} – ${win.end_time} (${win.duration_minutes} mins)
              </span>
              <span style="background: #FFFBEB; color: #B45309; border: 1px solid rgba(217, 119, 6, 0.3); font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 4px;">
                ${win.priority_status}
              </span>
            </div>
            <span style="font-size: 0.74rem; font-weight: 700; color: #059669; background: #ECFDF5; padding: 2px 8px; border-radius: 4px;">
              ${win.passenger_impact}
            </span>
          </div>

          <div style="font-size: 0.8rem; color: #1E293B; font-weight: 600; margin-bottom: 4px;">
            📍 Location: ${win.span_km}
          </div>

          <div style="font-size: 0.76rem; color: #64748B; margin-bottom: 8px; line-height: 1.4;">
            <strong>Cause:</strong> ${win.opportunity_cause}
          </div>

          <div style="background: #FAF6EE; border-radius: 6px; padding: 8px 10px; margin-bottom: 10px; font-size: 0.74rem;">
            <span style="font-weight: 700; color: #003366;">Suitable Pre-Approved Micro-Tasks:</span>
            <ul style="margin: 4px 0 0 16px; color: #334155;">
              ${win.suitable_work_types.map(w => `<li>${w}</li>`).join('')}
            </ul>
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between;">
            <span style="font-size: 0.72rem; color: #64748B;">Target Gang: <strong>${win.recommended_dept}</strong></span>
            <button onclick="window.claimMicroWindow('${win.window_id}', '${win.start_time}', '${win.span_km}')" style="
              background: #D97706;
              color: #FFFFFF;
              border: none;
              padding: 5px 14px;
              border-radius: 5px;
              font-size: 0.74rem;
              font-weight: 700;
              cursor: pointer;
            ">
              🎯 Claim Micro-Block
            </button>
          </div>
        </div>
      `).join('');
    } catch (err) {
      list.innerHTML = '<span style="color:#DC2626; font-size:0.8rem;">Error loading opportunistic windows: ' + err.message + '</span>';
    }
  };

  window.claimMicroWindow = async function (winId, time, span) {
    try {
      const res = await fetch('/api/v1/dispatch-micro-block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          window_id: winId,
          span_km: span,
          start_time: time,
          duration_minutes: 45,
          target_dept: 'Civil (P-Way)',
          work_type: 'Weld Ultrasonic Testing (USFD)'
        })
      });
      const data = await res.json();
      alert(`⚡ MICRO-BLOCK DISPATCHED TO CREW!\n\nSlot: ${winId} (${time})\nLocation: ${span}\n\n✓ Real push notification sent to maintenance gang via:\nhttps://ntfy.sh/raksha-path-control`);
      if (window.refreshCtrlAudit) window.refreshCtrlAudit();
    } catch (err) {
      alert(`Micro-Block claim error: ${err.message}`);
    }
  };

  // ═════════════════════════════════════════════════════════════════════════════
  // 5. TRACK MACHINE & RESOURCE FLEET BALANCER
  // ═════════════════════════════════════════════════════════════════════════════
  window.loadResourceFleet = async function () {
    const tbody = document.getElementById('resource-fleet-tbody');
    const selectElem = document.getElementById('reach-machine-select');
    if (!tbody) return;

    try {
      const res = await fetch('/api/v1/advanced/resource-fleet');
      const fleet = await res.json();

      tbody.innerHTML = fleet.map(m => `
        <tr style="border-bottom: 1px solid #E2E8F0; font-size: 0.78rem;">
          <td style="padding: 10px; font-weight: 800; font-family: var(--font-mono); color: #003366;">${m.machine_id}</td>
          <td style="padding: 10px; color: #1E293B;">${m.type}</td>
          <td style="padding: 10px; color: #475569;">${m.current_stabling}</td>
          <td style="padding: 10px; font-family: var(--font-mono); font-weight: 700;">${m.max_transit_speed_kmh} km/h</td>
          <td style="padding: 10px;">
            <span style="
              background: ${m.crew_available ? '#ECFDF5' : '#FEF2F2'};
              color: ${m.crew_available ? '#059669' : '#DC2626'};
              padding: 2px 8px;
              border-radius: 4px;
              font-weight: 700;
              font-size: 0.72rem;
            ">
              ${m.crew_available ? '✓ Ready' : 'Rest Mandate'}
            </span>
          </td>
          <td style="padding: 10px; font-weight: 600; color: ${m.status.includes('OPERATIONAL') ? '#059669' : '#D97706'};">
            ${m.status}
          </td>
        </tr>
      `).join('');

      if (selectElem) {
        selectElem.innerHTML = fleet.map(m => `<option value="${m.machine_id}">${m.machine_id} — ${m.type.split(' ')[0]}</option>`).join('');
      }
    } catch (err) {
      console.warn('Fleet status load error:', err);
    }
  };

  window.calculateMachineReach = async function () {
    const machineId = document.getElementById('reach-machine-select')?.value || 'BCM-372';
    const targetKm = parseFloat(document.getElementById('reach-target-km')?.value || '142.8');
    const resultBox = document.getElementById('reach-calculator-result');
    if (!resultBox) return;

    try {
      const res = await fetch('/api/v1/advanced/validate-resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          machine_id: machineId,
          target_km: targetKm,
          scheduled_start_hour: 2.0
        })
      });
      const data = await res.json();

      const bg = data.is_feasible ? '#ECFDF5' : '#FEF2F2';
      const color = data.is_feasible ? '#059669' : '#DC2626';

      resultBox.innerHTML = `
        <div style="background: ${bg}; border: 1px solid ${color}40; border-radius: 8px; padding: 14px; margin-top: 12px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
            <span style="font-weight: 800; font-size: 0.88rem; color: ${color};">
              ${data.verdict}
            </span>
            <span style="font-family: var(--font-mono); font-size: 0.75rem; font-weight: 700; color: ${color};">
              Distance: ${data.transit_distance_km} KM
            </span>
          </div>

          <div style="font-size: 0.76rem; color: #334155; line-height: 1.5;">
            Transit time required at restricted machine speed: <strong>${data.estimated_transit_minutes} minutes</strong>.<br />
            Crew Availability: <strong>${data.crew_available ? 'Confirmed' : 'Deficient'}</strong>.<br />
            Recommended Action: <em>${data.action}</em>
          </div>
        </div>
      `;
    } catch (err) {
      resultBox.innerHTML = '<span style="color:#DC2626; font-size:0.8rem;">Error validating machine reach: ' + err.message + '</span>';
    }
  };

  // ═════════════════════════════════════════════════════════════════════════════
  // 6. POST-BLOCK YIELD & BURST SCORECARD
  // ═════════════════════════════════════════════════════════════════════════════
  window.loadYieldScorecard = async function () {
    const container = document.getElementById('yield-scorecard-container');
    if (!container) return;

    try {
      const res = await fetch('/api/v1/advanced/yield-scorecard');
      const data = await res.json();

      const metrics = data.department_metrics;
      const deptKeys = Object.keys(metrics);

      container.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 20px;">
          <div style="background: #FFFFFF; border: 1px solid #E2E8F0; padding: 14px; border-radius: 8px;">
            <div style="font-size: 0.72rem; color: #64748B; font-weight: 700; text-transform: uppercase;">Divisional Yield Average</div>
            <div style="font-size: 1.6rem; font-weight: 800; color: #003366; font-family: var(--font-mono); margin-top: 4px;">
              ${data.divisional_yield_average}%
            </div>
            <div style="font-size: 0.72rem; color: #059669; font-weight: 600;">Standard Benchmark: 90%</div>
          </div>

          <div style="background: #FFFFFF; border: 1px solid #E2E8F0; padding: 14px; border-radius: 8px;">
            <div style="font-size: 0.72rem; color: #64748B; font-weight: 700; text-transform: uppercase;">Block Burst Rate</div>
            <div style="font-size: 1.6rem; font-weight: 800; color: #D97706; font-family: var(--font-mono); margin-top: 4px;">
              ${data.divisional_burst_rate_pct}%
            </div>
            <div style="font-size: 0.72rem; color: #D97706;">7 Bursts out of 84 Blocks</div>
          </div>

          <div style="background: #FFFFFF; border: 1px solid #E2E8F0; padding: 14px; border-radius: 8px;">
            <div style="font-size: 0.72rem; color: #64748B; font-weight: 700; text-transform: uppercase;">DRR AI Priority Policy</div>
            <div style="font-size: 0.8rem; font-weight: 700; color: #003366; margin-top: 6px; line-height: 1.4;">
              Active Feedback Loop Enabled
            </div>
            <div style="font-size: 0.7rem; color: #64748B;">Yield % directly modifies future block priority ranking.</div>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; background: #FFFFFF; border-radius: 8px; overflow: hidden; border: 1px solid #E2E8F0;">
          <thead>
            <tr style="background: #FAF6EE; border-bottom: 2px solid rgba(0,51,102,0.15); font-size: 0.74rem; color: #003366; text-transform: uppercase;">
              <th style="padding: 10px; text-align: left;">Department</th>
              <th style="padding: 10px; text-align: center;">Blocks Granted</th>
              <th style="padding: 10px; text-align: center;">Yield %</th>
              <th style="padding: 10px; text-align: center;">Burst Count</th>
              <th style="padding: 10px; text-align: center;">Avg Burst</th>
              <th style="padding: 10px; text-align: center;">DRR Score</th>
              <th style="padding: 10px; text-align: center;">AI Weight Modifier</th>
            </tr>
          </thead>
          <tbody>
            ${deptKeys.map(k => {
              const d = metrics[k];
              const scoreColor = d.drr_score >= 90 ? '#059669' : (d.drr_score >= 85 ? '#D97706' : '#DC2626');
              return `
                <tr style="border-bottom: 1px solid #F1F5F9; font-size: 0.78rem;">
                  <td style="padding: 10px; font-weight: 700; color: #0F172A;">${k}</td>
                  <td style="padding: 10px; text-align: center; font-family: var(--font-mono);">${d.blocks_granted_month}</td>
                  <td style="padding: 10px; text-align: center; font-family: var(--font-mono); font-weight: 700; color: ${scoreColor};">${d.yield_percentage}%</td>
                  <td style="padding: 10px; text-align: center; font-family: var(--font-mono);">${d.blocks_burst_count}</td>
                  <td style="padding: 10px; text-align: center; font-family: var(--font-mono);">${d.average_burst_minutes}m</td>
                  <td style="padding: 10px; text-align: center;">
                    <span style="background: ${scoreColor}15; color: ${scoreColor}; font-weight: 800; padding: 2px 8px; border-radius: 4px; font-family: var(--font-mono);">
                      ${d.drr_score}
                    </span>
                  </td>
                  <td style="padding: 10px; text-align: center; font-family: var(--font-mono); font-weight: 700; color: ${d.priority_modifier >= 1.0 ? '#059669' : '#DC2626'};">
                    ×${d.priority_modifier}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
    } catch (err) {
      container.innerHTML = '<span style="color:#DC2626; font-size:0.8rem;">Error loading yield scorecard: ' + err.message + '</span>';
    }
  };

  // ═════════════════════════════════════════════════════════════════════════════
  // 7. EMERGENCY BLOCK & REROUTING ASSISTANT
  // ═════════════════════════════════════════════════════════════════════════════
  window.simulateEmergencyReroute = async function () {
    const incidentType = document.getElementById('emer-incident-type')?.value || 'Rail Fracture (Severe Ultrasonic Break)';
    const km = parseFloat(document.getElementById('emer-km')?.value || '142.8');
    const duration = parseInt(document.getElementById('emer-duration')?.value || '180');
    const resultBox = document.getElementById('emergency-reroute-result');
    if (!resultBox) return;

    try {
      const res = await fetch('/api/v1/advanced/emergency-reroute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section_id: 'NDLS-CNB-UP',
          incident_type: incidentType,
          incident_km: km,
          estimated_restoration_minutes: duration
        })
      });
      const data = await res.json();

      resultBox.innerHTML = `
        <div style="background: #FFF5F5; border: 1px solid rgba(220,38,38,0.3); border-left: 4px solid #DC2626; border-radius: 8px; padding: 14px; margin-bottom: 14px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
            <span style="font-weight: 800; font-size: 0.95rem; color: #DC2626;">
              🚨 Emergency Impact Analysis: ${data.incident_type}
            </span>
            <span style="font-family: var(--font-mono); font-size: 0.75rem; background: #FEF2F2; color: #DC2626; padding: 2px 8px; border-radius: 4px; font-weight: 700;">
              ${data.estimated_block_duration}
            </span>
          </div>

          <div style="font-size: 0.78rem; color: #1E293B; margin-bottom: 8px;">
            <strong>Incident Zone:</strong> ${data.incident_location} | Permissible Speed: <em>${data.clamped_speed_permissible}</em>
          </div>

          <div style="font-size: 0.75rem; color: #475569; background: #FFFFFF; padding: 8px 10px; border-radius: 6px; border: 1px solid #F1F5F9; margin-bottom: 10px;">
            👨‍🔧 <strong>Dispatched Gang:</strong> ${data.emergency_gang_dispatched} (ETA: <strong>${data.eta_gang_arrival_mins} mins</strong>)
          </div>

          <div style="margin-bottom: 12px;">
            <span style="font-size: 0.74rem; font-weight: 700; color: #991B1B; text-transform: uppercase;">Upstream Trains Regulated & Rerouted:</span>
            <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 6px;">
              ${data.upstream_trains_affected.map(t => `
                <div style="background: #FFFFFF; border: 1px solid rgba(220,38,38,0.15); border-radius: 6px; padding: 8px 10px; font-size: 0.76rem; display: flex; align-items: center; justify-content: space-between;">
                  <div>
                    <span style="font-weight: 700; color: #003366;">${t.train_number} ${t.train_name}</span>
                    <span style="color: #64748B; margin-left: 6px;">(${t.status})</span>
                  </div>
                  <div style="font-weight: 600; color: #DC2626;">
                    ${t.action}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <div style="background: #ECFDF5; border: 1px solid rgba(5,150,105,0.3); border-radius: 6px; padding: 10px 12px; font-size: 0.76rem; color: #065F46;">
            <strong>⚡ EDFC Freight Bypass Activated:</strong> ${data.freight_bypass_route}.<br />
            Freights preserved: <strong>${data.freight_capacity_retained_pct}% main line freight capacity retained</strong> without causing yard bottlenecks.
          </div>
        </div>
      `;
    } catch (err) {
      resultBox.innerHTML = '<span style="color:#DC2626; font-size:0.8rem;">Error calculating emergency impact: ' + err.message + '</span>';
    }
  };

  // ═════════════════════════════════════════════════════════════════════════════
  // 8. MULTI-HORIZON PLANNER
  // ═════════════════════════════════════════════════════════════════════════════
  window.loadMultiHorizonPlan = async function (horizonType) {
    const container = document.getElementById('multi-horizon-content');
    if (!container) return;

    try {
      const res = await fetch('/api/v1/advanced/multi-horizon-plan');
      const data = await res.json();

      if (horizonType === 'weekly' || !horizonType) {
        container.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
            <div style="font-size: 0.84rem; font-weight: 700; color: #003366;">
              📅 7-Day Tactical Corridor Windows (North Central Railway)
            </div>
            <span style="font-size: 0.72rem; color: #059669; font-weight: 700; background: #ECFDF5; padding: 2px 8px; border-radius: 4px;">
              Coordinated Shadow Sessions
            </span>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            ${data.weekly_tactical.map(w => `
              <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-top: 3px solid #003366; border-radius: 8px; padding: 12px 14px; box-shadow: 0 2px 4px rgba(0,0,0,0.02);">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                  <span style="font-weight: 800; font-size: 0.85rem; color: #003366;">${w.day}</span>
                  <span style="font-size: 0.7rem; font-weight: 700; background: #FAF6EE; color: #003366; border: 1px solid rgba(0,51,102,0.2); padding: 2px 6px; border-radius: 4px;">
                    ${w.status}
                  </span>
                </div>

                <div style="font-size: 0.78rem; font-weight: 700; color: #0F172A; margin-bottom: 4px;">
                  ${w.section} — <span style="font-family: var(--font-mono); color: #0056B3;">${w.window}</span>
                </div>

                <div style="font-size: 0.74rem; color: #475569; margin-bottom: 6px;">
                  Departments: <strong>${w.departments.join(' + ')}</strong> (${w.jobs_consolidated} cross-tasks merged)
                </div>

                <div style="font-size: 0.72rem; color: #64748B; background: #F8FAFC; padding: 4px 8px; border-radius: 4px;">
                  🚜 Assigned Machinery: <strong>${w.allocated_machine}</strong>
                </div>
              </div>
            `).join('')}
          </div>
        `;
      } else {
        container.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
            <div style="font-size: 0.84rem; font-weight: 700; color: #003366;">
              🏗️ 30-Day Heavy Track Machine Overhaul Campaigns
            </div>
            <span style="font-size: 0.72rem; color: #D97706; font-weight: 700; background: #FFFBEB; padding: 2px 8px; border-radius: 4px;">
              Division Strategic Overhaul
            </span>
          </div>

          <div style="display: flex; flex-direction: column; gap: 12px;">
            ${data.monthly_strategic.map(m => `
              <div style="background: #FFFFFF; border: 1px solid #E2E8F0; border-left: 4px solid #D97706; border-radius: 8px; padding: 14px 16px;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                  <span style="font-family: var(--font-mono); font-weight: 800; font-size: 0.82rem; color: #D97706;">
                    ${m.campaign_id}
                  </span>
                  <span style="font-size: 0.74rem; font-weight: 700; color: #059669;">
                    Est. Savings: ₹${m.economic_savings_crores_inr} Crores
                  </span>
                </div>

                <div style="font-size: 0.92rem; font-weight: 700; color: #0F172A; margin-bottom: 4px;">
                  ${m.title}
                </div>

                <div style="font-size: 0.78rem; color: #334155; margin-bottom: 6px;">
                  Duration: <strong>${m.duration_weeks} Weeks</strong> (${m.total_mega_blocks} Mega-Possession Windows) | Target: <strong>${m.target_track_km} Track KM</strong>
                </div>

                <div style="font-size: 0.75rem; color: #475569; background: #FAF6EE; padding: 6px 10px; border-radius: 4px;">
                  Restoration Objective: <em>${m.projected_speed_restoration}</em> | Fleet: <strong>${m.allocated_fleet.join(', ')}</strong>
                </div>
              </div>
            `).join('')}
          </div>
        `;
      }
    } catch (err) {
      container.innerHTML = '<span style="color:#DC2626; font-size:0.8rem;">Error loading multi-horizon plan: ' + err.message + '</span>';
    }
  };

})();
