/**
 * PriorityScoreBadge.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Indian Railways AI Maintenance Platform - Component
 * Visual badge displaying AI-predicted priority score (0–100) and category (P1/P2/P3/P4)
 * with animated glowing pulses for safety-critical P1 defects.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export class PriorityScoreBadge {
  /**
   * Determine configuration based on category or numerical score
   * @param {string} category - 'P1' | 'P2' | 'P3' | 'P4'
   * @param {number} score - 0 to 100
   */
  static getConfig(category, score = null) {
    const cat = (category || '').toUpperCase();
    const sc = score !== null ? parseFloat(score) : null;

    if (cat === 'P1' || (sc !== null && sc >= 85)) {
      return {
        category: 'P1',
        label: 'CRITICAL',
        sla: '24h SLA',
        color: '#DC2626',
        bg: 'rgba(220, 38, 38, 0.08)',
        border: 'rgba(220, 38, 38, 0.3)',
        glow: '0 0 8px rgba(220, 38, 38, 0.2)',
        pulse: true,
        icon: '🚨'
      };
    }
    if (cat === 'P2' || (sc !== null && sc >= 70)) {
      return {
        category: 'P2',
        label: 'HIGH',
        sla: '72h SLA',
        color: '#D9531E',
        bg: 'rgba(217, 83, 30, 0.08)',
        border: 'rgba(217, 83, 30, 0.3)',
        glow: 'none',
        pulse: false,
        icon: '⚡'
      };
    }
    if (cat === 'P3' || (sc !== null && sc >= 50)) {
      return {
        category: 'P3',
        label: 'MEDIUM',
        sla: '7d SLA',
        color: '#D97706',
        bg: 'rgba(217, 119, 6, 0.08)',
        border: 'rgba(217, 119, 6, 0.3)',
        glow: 'none',
        pulse: false,
        icon: '⚠️'
      };
    }
    return {
      category: 'P4',
      label: 'LOW',
      sla: '30d SLA',
      color: '#059669',
      bg: 'rgba(5, 150, 105, 0.08)',
      border: 'rgba(5, 150, 105, 0.3)',
      glow: 'none',
      pulse: false,
      icon: 'ℹ️'
    };
  }

  /**
   * Render badge HTML string
   * @param {Object} props
   * @param {number} props.score - Priority numerical score (e.g. 92.4)
   * @param {string} props.category - Priority tier (e.g. 'P1')
   * @param {boolean} [props.showSla=true] - Whether to show SLA tag
   * @param {string} [props.size='normal'] - 'small' | 'normal' | 'large'
   * @returns {string} HTML string
   */
  static render({ score, category, showSla = true, size = 'normal' }) {
    const numScore = score !== null && score !== undefined ? parseFloat(score).toFixed(1) : '--';
    const cfg = this.getConfig(category, score);

    const pad = size === 'small' ? '3px 8px' : size === 'large' ? '8px 16px' : '5px 12px';
    const font = size === 'small' ? '0.72rem' : size === 'large' ? '0.95rem' : '0.82rem';
    const pulseClass = cfg.pulse ? 'ai-badge-pulse' : '';

    return `
      <span class="ai-priority-badge ${pulseClass}" style="
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: ${pad};
        font-family: 'Calibri', 'Arial', sans-serif;
        font-size: ${font};
        font-weight: 700;
        color: ${cfg.color};
        background: ${cfg.bg};
        border: 1px solid ${cfg.border};
        border-radius: 6px;
        box-shadow: ${cfg.glow};
        letter-spacing: 0.3px;
        white-space: nowrap;
        user-select: none;
      " title="AI Priority: ${cfg.category} (${numScore}/100) - ${cfg.label} - ${cfg.sla}">
        <span>${cfg.icon}</span>
        <span>${cfg.category}</span>
        <span style="opacity: 0.45;">|</span>
        <span style="font-weight: 800;">${numScore}</span>
        ${showSla ? `<span style="font-size: 0.85em; opacity: 0.85; padding-left: 2px;">(${cfg.sla})</span>` : ''}
      </span>
    `;
  }

  /**
   * Create and mount DOM element
   */
  static create(props) {
    const div = document.createElement('div');
    div.innerHTML = this.render(props).trim();
    return div.firstElementChild;
  }
}

// Attach to window for global access
if (typeof window !== 'undefined') {
  window.PriorityScoreBadge = PriorityScoreBadge;
}
