/**
 * ConfidenceIndicator.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Indian Railways AI Maintenance Platform - Component
 * Visual AI confidence indicator displaying statistical prediction confidence
 * with progress meter and reliability badge.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export class ConfidenceIndicator {
  /**
   * Determine confidence level metadata
   * @param {number} confidence - 0.0 to 1.0 or 0 to 100
   */
  static getMeta(confidence) {
    let val = parseFloat(confidence) || 0.85;
    if (val <= 1.0) val = val * 100;
    val = Math.max(0, Math.min(100, Math.round(val)));

    if (val >= 90) {
      return {
        pct: val,
        level: 'HIGH CONFIDENCE',
        shortLevel: 'HIGH',
        color: '#059669',
        bg: 'rgba(5, 150, 105, 0.08)',
        border: 'rgba(5, 150, 105, 0.3)',
        icon: '🎯'
      };
    }
    if (val >= 75) {
      return {
        pct: val,
        level: 'MODERATE CONFIDENCE',
        shortLevel: 'MED',
        color: '#0056B3',
        bg: 'rgba(0, 86, 179, 0.08)',
        border: 'rgba(0, 86, 179, 0.3)',
        icon: '✓'
      };
    }
    return {
      pct: val,
      level: 'LOW / UNCERTAIN',
      shortLevel: 'LOW',
      color: '#D97706',
      bg: 'rgba(217, 119, 6, 0.08)',
      border: 'rgba(217, 119, 6, 0.3)',
      icon: '⚠️'
    };
  }

  /**
   * Render confidence pill badge
   * @param {Object} props
   * @param {number} props.confidence - 0.0 to 1.0 or 0 to 100
   * @param {boolean} [props.compact=false]
   * @returns {string} HTML markup
   */
  static render({ confidence, compact = false }) {
    const meta = this.getMeta(confidence);

    return `
      <span class="ai-confidence-indicator" style="
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: ${compact ? '2px 7px' : '4px 10px'};
        background: ${meta.bg};
        border: 1px solid ${meta.border};
        border-radius: 6px;
        font-family: 'Calibri', 'Arial', sans-serif;
        font-size: ${compact ? '0.74rem' : '0.82rem'};
        color: ${meta.color};
        font-weight: 700;
        white-space: nowrap;
        user-select: none;
      " title="AI Model Confidence: ${meta.pct}% (${meta.level})">
        <span style="font-size: 0.85em;">${meta.icon}</span>
        <span>${meta.pct}%</span>
        ${!compact ? `<span style="font-size: 0.85em; opacity: 0.85; font-family: 'Calibri', 'Arial', sans-serif;">${meta.shortLevel}</span>` : ''}
      </span>
    `;
  }
}

if (typeof window !== 'undefined') {
  window.ConfidenceIndicator = ConfidenceIndicator;
}
