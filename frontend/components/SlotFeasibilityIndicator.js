/**
 * SlotFeasibilityIndicator.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Indian Railways AI Maintenance Platform - Component
 * Displays slot feasibility tier (HIGH, MODERATE, LOW, INFEASIBLE)
 * with status icons, conflict counts, and timing tags.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export class SlotFeasibilityIndicator {
  static getMeta(status) {
    const s = (status || '').toUpperCase();
    if (s.includes('HIGH') || s === 'APPROVED') {
      return {
        label: 'HIGH FEASIBILITY',
        shortLabel: 'OPTIMAL',
        icon: '🟢',
        color: '#059669',
        bg: 'rgba(5, 150, 105, 0.08)',
        border: 'rgba(5, 150, 105, 0.3)',
        desc: 'Unrestricted corridor window; zero conflicts'
      };
    }
    if (s.includes('MODERATE') || s === 'VIABLE') {
      return {
        label: 'MODERATE FEASIBILITY',
        shortLabel: 'VIABLE',
        icon: '🟡',
        color: '#D97706',
        bg: 'rgba(217, 119, 6, 0.08)',
        border: 'rgba(217, 119, 6, 0.3)',
        desc: 'Viable with freight train regulation'
      };
    }
    if (s.includes('LOW') || s === 'RESTRICTED') {
      return {
        label: 'LOW FEASIBILITY',
        shortLabel: 'RESTRICTED',
        icon: '🟠',
        color: '#D9531E',
        bg: 'rgba(217, 83, 30, 0.08)',
        border: 'rgba(217, 83, 30, 0.3)',
        desc: 'Requires Divisional Railway Manager (DRM) sanction'
      };
    }
    return {
      label: 'INFEASIBLE',
      shortLabel: 'CHOKE',
      icon: '🔴',
      color: '#DC2626',
      bg: 'rgba(220, 38, 38, 0.08)',
      border: 'rgba(220, 38, 38, 0.3)',
      desc: 'Corridor choke; conflicts with Mail/Express paths'
    };
  }

  /**
   * Render Feasibility Badge
   * @param {Object} props
   * @param {string} props.status - 'HIGH_FEASIBILITY' | 'MODERATE_FEASIBILITY' | 'LOW_FEASIBILITY' | 'INFEASIBLE'
   * @param {number} [props.conflicts=0] - Number of train conflicts
   * @param {boolean} [props.showIcon=true]
   * @param {boolean} [props.compact=false]
   * @returns {string} HTML markup
   */
  static render({ status, conflicts = 0, showIcon = true, compact = false }) {
    const meta = this.getMeta(status);
    const conflictTag = conflicts > 0 
      ? `<span style="opacity: 0.8; font-size: 0.85em; margin-left: 4px;">(${conflicts} conflict${conflicts > 1 ? 's' : ''})</span>`
      : `<span style="opacity: 0.8; font-size: 0.85em; margin-left: 4px;">(Clear)</span>`;

    return `
      <span class="ai-slot-feasibility" style="
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: ${compact ? '3px 8px' : '5px 12px'};
        font-family: 'Calibri', 'Arial', sans-serif;
        font-size: ${compact ? '0.76rem' : '0.82rem'};
        font-weight: 700;
        color: ${meta.color};
        background: ${meta.bg};
        border: 1px solid ${meta.border};
        border-radius: 6px;
        white-space: nowrap;
        user-select: none;
      " title="${meta.label}: ${meta.desc}">
        ${showIcon ? `<span>${meta.icon}</span>` : ''}
        <span>${compact ? meta.shortLabel : meta.label}</span>
        ${conflictTag}
      </span>
    `;
  }
}

if (typeof window !== 'undefined') {
  window.SlotFeasibilityIndicator = SlotFeasibilityIndicator;
}
