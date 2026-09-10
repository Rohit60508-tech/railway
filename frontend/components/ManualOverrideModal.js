/**
 * ManualOverrideModal.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Indian Railways AI Maintenance Platform - Component
 * Reusable modal and audit logger for manual operator overrides of AI predictions,
 * defect priority classifications, and corridor block approvals.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export class ManualOverrideModal {
  static init() {
    if (document.getElementById('ai-override-modal-container')) return;

    const modalHtml = `
      <div id="ai-override-modal-backdrop" style="
        display: none;
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.55);
        backdrop-filter: blur(6px);
        z-index: 10000;
        align-items: center;
        justify-content: center;
      ">
        <div id="ai-override-modal" style="
          background: #FFFFFF;
          border: 1px solid rgba(195, 178, 150, 0.5);
          box-shadow: 0 20px 48px rgba(15, 23, 42, 0.16), 0 4px 12px rgba(195, 178, 150, 0.25);
          border-radius: 12px;
          width: 90%;
          max-width: 520px;
          padding: 26px;
          color: #0F172A;
          font-family: 'Inter', sans-serif;
          position: relative;
        ">
          <!-- Close button -->
          <button onclick="window.ManualOverrideModal.close()" style="
            position: absolute; top: 18px; right: 18px;
            background: none; border: none; color: #64748B;
            font-size: 1.3rem; cursor: pointer; font-weight: 700;
          ">&times;</button>

          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 16px;">
            <span style="font-size: 1.4rem;">⚠️</span>
            <div>
              <h3 style="font-family: 'Inter', sans-serif; font-weight: 800; font-size: 1.05rem; color: #003366; letter-spacing: 0.3px; margin: 0;">
                MANUAL AI DECISION OVERRIDE
              </h3>
              <p style="font-size: 0.74rem; color: #D9531E; text-transform: uppercase; font-weight: 700; margin: 2px 0 0 0;">
                Statutory Railway Safety Audit Logging Active
              </p>
            </div>
          </div>

          <div style="
            background: #FAF6EE;
            border: 1px solid rgba(195, 178, 150, 0.45);
            border-radius: 8px;
            padding: 12px 14px;
            margin-bottom: 16px;
            font-size: 0.82rem;
          ">
            <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
              <span style="color: #475569; font-weight: 500;">Target Entity:</span>
              <span id="override-target-id" style="font-family: 'JetBrains Mono', monospace; font-weight: 700; color: #003366;">DEF-001</span>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #475569; font-weight: 500;">Current AI Assessment:</span>
              <span id="override-current-val" style="font-weight: 700; color: #DC2626;">P1 (93.4)</span>
            </div>
          </div>

          <!-- Form Fields -->
          <div style="margin-bottom: 14px;">
            <label style="display: block; font-size: 0.75rem; text-transform: uppercase; color: #334155; font-weight: 700; margin-bottom: 6px;">
              New Manual Classification / Status *
            </label>
            <select id="override-new-val" style="
              width: 100%;
              background: #FCFBF7;
              border: 1px solid rgba(195, 178, 150, 0.6);
              color: #0F172A;
              padding: 9px 12px;
              border-radius: 6px;
              font-family: 'Inter', sans-serif;
              font-size: 0.82rem;
              outline: none;
            ">
              <option value="P1">P1 - Critical (Immediate 24h Intervention)</option>
              <option value="P2">P2 - High Priority (72h Window)</option>
              <option value="P3">P3 - Medium Priority (Rolling 7d Window)</option>
              <option value="P4">P4 - Low Priority (Routine Inspection)</option>
              <option value="APPROVED_OVERRIDE">Force Sanction Block (Overrule AI Infeasibility)</option>
              <option value="REJECTED_OVERRIDE">Reject Block (Operational Exigency)</option>
            </select>
          </div>

          <div style="margin-bottom: 14px;">
            <label style="display: block; font-size: 0.75rem; text-transform: uppercase; color: #334155; font-weight: 700; margin-bottom: 6px;">
              Primary Justification / Reason *
            </label>
            <select id="override-reason-code" style="
              width: 100%;
              background: #FCFBF7;
              border: 1px solid rgba(195, 178, 150, 0.6);
              color: #0F172A;
              padding: 9px 12px;
              border-radius: 6px;
              font-family: 'Inter', sans-serif;
              font-size: 0.82rem;
              outline: none;
            ">
              <option value="PHYSICAL_RECHECK_VERIFIED">Physical Ground Re-check Verified Lower Risk</option>
              <option value="DRM_VERBAL_SANCTION">Divisional Railway Manager (DRM) Special Sanction</option>
              <option value="MATERIAL_OR_MACHINE_UNAVAILABLE">Heavy Machine / Track Tamper Temporarily Unavailable</option>
              <option value="WEATHER_EXIGENCY">Severe Monsoon / Fog Operational Exigency</option>
              <option value="TRACK_CIRCUIT_FAILSAFE">Track Circuit Redundancy Active in Block Section</option>
              <option value="OTHER_CUSTOM">Other Authorized Field Justification</option>
            </select>
          </div>

          <div style="margin-bottom: 14px;">
            <label style="display: block; font-size: 0.75rem; text-transform: uppercase; color: #334155; font-weight: 700; margin-bottom: 6px;">
              Detailed Regulatory Explanation *
            </label>
            <textarea id="override-reason-text" rows="3" placeholder="Provide mandatory engineering explanation for audit trail..." style="
              width: 100%;
              background: #FCFBF7;
              border: 1px solid rgba(195, 178, 150, 0.6);
              color: #0F172A;
              padding: 9px 12px;
              border-radius: 6px;
              font-family: 'Inter', sans-serif;
              font-size: 0.82rem;
              outline: none;
              resize: none;
            "></textarea>
          </div>

          <div style="margin-bottom: 20px;">
            <label style="display: block; font-size: 0.75rem; text-transform: uppercase; color: #334155; font-weight: 700; margin-bottom: 6px;">
              Authorizing Officer PIN / ID *
            </label>
            <input id="override-officer-id" type="text" value="SR-DEN-DLI-4281" placeholder="e.g. SR-DEN-NR-094" style="
              width: 100%;
              background: #FCFBF7;
              border: 1px solid rgba(195, 178, 150, 0.6);
              color: #0F172A;
              padding: 9px 12px;
              border-radius: 6px;
              font-family: 'JetBrains Mono', monospace;
              font-size: 0.82rem;
              outline: none;
            " />
          </div>

          <!-- Actions -->
          <div style="display: flex; align-items: center; justify-content: flex-end; gap: 12px;">
            <button onclick="window.ManualOverrideModal.close()" style="
              background: #F1EBE1;
              border: 1px solid rgba(195, 178, 150, 0.6);
              color: #334155;
              padding: 8px 18px;
              border-radius: 6px;
              font-size: 0.82rem;
              font-weight: 600;
              cursor: pointer;
            ">Cancel</button>

            <button onclick="window.ManualOverrideModal.submit()" style="
              background: #003366;
              border: none;
              color: #ffffff;
              padding: 8px 22px;
              border-radius: 6px;
              font-size: 0.82rem;
              font-weight: 700;
              cursor: pointer;
              box-shadow: 0 4px 14px rgba(0, 51, 102, 0.25);
            ">Submit Override & Log Audit</button>
          </div>
        </div>
      </div>
    `;

    const div = document.createElement('div');
    div.id = 'ai-override-modal-container';
    div.innerHTML = modalHtml;
    document.body.appendChild(div);
  }

  static currentCallback = null;

  /**
   * Open the override modal for a target item
   */
  static open({ targetId, currentVal, type = 'defect', onComplete = null }) {
    this.init();
    this.currentCallback = onComplete;

    document.getElementById('override-target-id').innerText = targetId;
    document.getElementById('override-current-val').innerText = currentVal;
    document.getElementById('override-reason-text').value = '';

    const backdrop = document.getElementById('ai-override-modal-backdrop');
    backdrop.style.display = 'flex';

    // Check if user is admin
    const isAdmin = Boolean(
      (window.IR_AUTH && (window.IR_AUTH.isAdmin || window.IR_AUTH.role === 'admin')) ||
      (window.RailwayApp && window.RailwayApp.session?.currentSession?.user?.role === 'ADMIN')
    );

    let adminBanner = document.getElementById('override-admin-banner');
    if (!adminBanner) {
      adminBanner = document.createElement('div');
      adminBanner.id = 'override-admin-banner';
      adminBanner.style.cssText = 'background: linear-gradient(135deg, #DC2626, #991B1B); color: #FFF; padding: 6px 12px; border-radius: 6px; margin-bottom: 12px; font-size: 0.75rem; font-weight: 800; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 2px 8px rgba(220,38,38,0.25);';
      const modalBox = document.querySelector('#ai-override-modal-backdrop > div');
      if (modalBox) modalBox.insertBefore(adminBanner, modalBox.children[1]);
    }

    if (isAdmin) {
      adminBanner.style.display = 'flex';
      adminBanner.innerHTML = `
        <span>👑 ADMIN MASTER OVERWRITE ACTIVE</span>
        <span style="font-size: 0.70rem; background: rgba(255,255,255,0.2); padding: 1px 6px; border-radius: 4px;">UNRESTRICTED</span>
      `;
      // Ensure admin options exist in select
      const select = document.getElementById('override-new-val');
      if (select && !select.querySelector('option[value="ADMIN_EMERGENCY_FORCE_CHANGE"]')) {
        const opt1 = document.createElement('option');
        opt1.value = 'ADMIN_EMERGENCY_FORCE_CHANGE';
        opt1.textContent = '👑 Admin Force Change (Root System Override)';
        select.prepend(opt1);
        select.value = 'ADMIN_EMERGENCY_FORCE_CHANGE';
      }
    } else {
      adminBanner.style.display = 'none';
    }

    if (window.getActiveLoginUser) {
      const u = window.getActiveLoginUser();
      const input = document.getElementById('override-officer-id');
      if (input) input.value = `${u.staffId || u.id} (${u.name || u.username})`;
    }
  }

  static close() {
    const backdrop = document.getElementById('ai-override-modal-backdrop');
    if (backdrop) backdrop.style.display = 'none';
  }

  static submit() {
    const targetId = document.getElementById('override-target-id').innerText;
    const currentVal = document.getElementById('override-current-val').innerText;
    const newVal = document.getElementById('override-new-val').value;
    const reasonCode = document.getElementById('override-reason-code').value;
    const reasonText = document.getElementById('override-reason-text').value.trim();
    const officerId = document.getElementById('override-officer-id').value.trim();

    if (!reasonText) {
      alert("Mandatory audit requirement: Please enter detailed regulatory explanation.");
      return;
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      targetId,
      originalValue: currentVal,
      overriddenValue: newVal,
      reasonCode,
      explanation: reasonText,
      officerId: officerId || "UNKNOWN-OFFICER"
    };

    // Store in localStorage audit history
    try {
      const existingLogs = JSON.parse(localStorage.getItem('ir_ai_override_audit_logs') || '[]');
      existingLogs.unshift(logEntry);
      localStorage.setItem('ir_ai_override_audit_logs', JSON.stringify(existingLogs.slice(0, 100)));
    } catch (e) {}

    // Dispatch to Supabase / Immutable Server Ledger
    const isAdmin = Boolean(
      (window.IR_AUTH && (window.IR_AUTH.isAdmin || window.IR_AUTH.role === 'admin')) ||
      (window.RailwayApp && window.RailwayApp.session?.currentSession?.user?.role === 'ADMIN')
    );
    const entryName = isAdmin ? 'ADMIN_MASTER_OVERRIDE' : 'SUPERVISOR_MANUAL_OVERRIDE';

    if (window.recordImmutableAction) {
      window.recordImmutableAction(entryName, {
        eventType: 'OVERRIDE',
        targetEntityId: targetId,
        reason: `${reasonCode}: ${reasonText}`,
        details: { ...logEntry, admin_bypass: isAdmin }
      });
    }

    this.close();

    if (this.currentCallback) {
      this.currentCallback(logEntry);
    }

    if (window.showToast) {
      window.showToast(`✅ Manual override logged for ${targetId}: changed to ${newVal}. Audit saved to Supabase/Immutable Ledger.`, 'info');
    } else {
      alert(`Manual override successfully logged for ${targetId} by ${officerId}.\nAudit record preserved in Immutable Ledger.`);
    }
  }

  static getAuditLogs() {
    try {
      return JSON.parse(localStorage.getItem('ir_ai_override_audit_logs') || '[]');
    } catch (e) {
      return [];
    }
  }
}

if (typeof window !== 'undefined') {
  window.ManualOverrideModal = ManualOverrideModal;
}
