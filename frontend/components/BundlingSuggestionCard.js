/**
 * BundlingSuggestionCard.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Indian Railways AI Maintenance Platform - Component
 * Visual card displaying AI-identified multi-department bundling opportunities,
 * synergy scores, saved corridor block hours, and participating tasks.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export class BundlingSuggestionCard {
  /**
   * Render Bundling Opportunity Card
   * @param {Object} props
   * @param {string} props.bundleId - Unique Bundle ID (e.g. 'BNDL-NDLS-04')
   * @param {string} props.sectionId - Section code (e.g. 'NDLS-CNB-UP')
   * @param {string} props.timeWindow - Proposed block window (e.g. '01:30 - 04:00 (2h 30m)')
   * @param {number} props.synergyScore - 0 to 100 percentage
   * @param {number} props.savedHours - Hours of line disruption saved by bundling
   * @param {Array<string>} props.departments - ['CIVIL', 'TRD_OHE', 'SIGNALLING']
   * @param {Array<Object>} props.tasks - [{ id, department, desc, duration, machine }]
   * @returns {string} HTML markup
   */
  static render({
    bundleId,
    sectionId,
    timeWindow,
    synergyScore = 88,
    savedHours = 2.0,
    departments = [],
    tasks = []
  }) {
    const deptPills = departments.map(dept => {
      let col = '#003366';
      let bg = 'rgba(0, 51, 102, 0.08)';
      if (dept.includes('TRD') || dept.includes('ELECT')) { col = '#D9531E'; bg = 'rgba(217, 83, 30, 0.1)'; }
      if (dept.includes('CIVIL') || dept.includes('PWAY')) { col = '#059669'; bg = 'rgba(5, 150, 105, 0.1)'; }
      if (dept.includes('SIGNAL') || dept.includes('S&T')) { col = '#0056B3'; bg = 'rgba(0, 86, 179, 0.1)'; }
      return `<span style="font-size: 0.72rem; padding: 2px 7px; border-radius: 4px; background: ${bg}; color: ${col}; font-weight: 700; border: 1px solid ${col}33;">${dept}</span>`;
    }).join(' ');

    const taskListHtml = tasks.map(t => `
      <div style="
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 10px;
        background: #FAF6EE;
        border: 1px solid rgba(195, 178, 150, 0.3);
        border-radius: 6px;
        margin-bottom: 5px;
        font-size: 0.78rem;
      ">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-family: 'Calibri', 'Arial', sans-serif; color: #003366; font-weight: 700;">${t.id}</span>
          <span style="color: #0F172A;">${t.desc || t.work_type}</span>
          ${t.machine ? `<span style="font-size: 0.7rem; background: rgba(0, 51, 102, 0.06); color: #003366; padding: 1px 6px; border-radius: 3px; font-weight: 600;">🚜 ${t.machine}</span>` : ''}
        </div>
        <span style="font-family: 'Calibri', 'Arial', sans-serif; color: #64748B;">${t.duration || '90m'}</span>
      </div>
    `).join('');

    return `
      <div class="ai-bundling-card" id="${bundleId}" style="
        background: #FFFFFF;
        border: 1px solid rgba(195, 178, 150, 0.4);
        box-shadow: 0 4px 16px rgba(45, 35, 20, 0.05);
        border-radius: 10px;
        padding: 16px;
        margin-bottom: 14px;
        position: relative;
        overflow: hidden;
        font-family: 'Calibri', 'Arial', sans-serif;
      ">
        <!-- Accent Bar -->
        <div style="
          position: absolute; top: 0; left: 0; right: 0; height: 3px;
          background: #003366;
        "></div>

        <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 10px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
              <span style="font-size: 1.1rem;">🔗</span>
              <span style="font-family: 'Calibri', 'Arial', sans-serif; font-weight: 700; font-size: 0.95rem; color: #0F172A; letter-spacing: 0.5px;">
                ${bundleId}
              </span>
              <span style="font-family: 'Calibri', 'Arial', sans-serif; font-size: 0.75rem; color: #475569; background: #F4EDE2; padding: 2px 6px; border-radius: 4px; font-weight: 600;">
                ${sectionId}
              </span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px; margin-top: 4px;">
              ${deptPills}
            </div>
          </div>

          <div style="text-align: right;">
            <div style="
              display: inline-flex;
              align-items: center;
              gap: 4px;
              background: rgba(5, 150, 105, 0.08);
              border: 1px solid rgba(5, 150, 105, 0.25);
              padding: 4px 10px;
              border-radius: 20px;
              font-family: 'Calibri', 'Arial', sans-serif;
              font-size: 0.82rem;
              font-weight: 800;
              color: #059669;
            ">
              <span>⚡</span>
              <span>${synergyScore}% SYNERGY</span>
            </div>
            <div style="font-size: 0.72rem; color: #059669; font-weight: 600; margin-top: 4px;">
              Saves ${savedHours}h corridor downtime
            </div>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px; font-size: 0.8rem; color: #334155;">
          <span>🕒 <strong>Proposed Window:</strong> ${timeWindow}</span>
          <span>📦 <strong>${tasks.length} Bundled Tasks</strong></span>
        </div>

        <div style="margin-bottom: 12px;">
          ${taskListHtml}
        </div>

        <div style="display: flex; align-items: center; justify-content: flex-end; gap: 8px;">
          <button onclick="window.BundlingSuggestionCard.inspect('${bundleId}')" style="
            background: #FFFFFF;
            border: 1px solid rgba(0, 51, 102, 0.2);
            color: #003366;
            padding: 6px 14px;
            border-radius: 6px;
            font-size: 0.78rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
          ">Review Bundle</button>

          <button onclick="window.BundlingSuggestionCard.accept('${bundleId}')" style="
            background: #003366;
            border: none;
            color: #FFFFFF;
            padding: 6px 16px;
            border-radius: 6px;
            font-size: 0.78rem;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 2px 8px rgba(0, 51, 102, 0.25);
            transition: all 0.2s ease;
          ">Accept &amp; Move to Work Orders</button>
        </div>
      </div>
    `;
  }

  static inspect(bundleId) {
    if (window.showToast) window.showToast(`Inspecting multi-department bundle ${bundleId}...`, 'info');
    else alert(`Reviewing details for ${bundleId}`);
  }

  static accept(bundleId) {
    const card = document.getElementById(bundleId);
    if (card) {
      card.style.background = '#F0FDF4';
      card.style.borderColor = 'rgba(5, 150, 105, 0.45)';
      card.style.borderLeft = '6px solid #059669';
      
      const actionBox = card.querySelector('button[onclick*="accept"]')?.parentElement;
      if (actionBox) {
        actionBox.innerHTML = `
          <span style="background:#059669;color:#FFF;padding:6px 14px;border-radius:6px;font-size:0.78rem;font-weight:800;">
            🔒 BUNDLE ACCEPTED &amp; SENT TO WORK TO BE DONE
          </span>
        `;
      }
    }

    if (window.acceptWorkOrder) {
      // Find matching tasks in bundle if available
      const activeIds = ['WO-CIVIL-401', 'WO-TRD-112', 'WO-SIG-094', 'WO-CIVIL-419', 'WO-TRD-125'];
      activeIds.forEach(id => window.acceptWorkOrder(id, true));
    }

    if (window.showToast) window.showToast(`🔒 CP-SAT Bundle ${bundleId} accepted! All tasks moved to Work To Be Done.`, 'success');
  }
}

if (typeof window !== 'undefined') {
  window.BundlingSuggestionCard = BundlingSuggestionCard;
}
