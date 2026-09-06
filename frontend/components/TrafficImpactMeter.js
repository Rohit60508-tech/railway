/**
 * TrafficImpactMeter.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Indian Railways AI Maintenance Platform - Component
 * Visual impact meter and gauge displaying train disruption scores (0–100),
 * punctuality penalties, and estimated passenger delay minutes.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export class TrafficImpactMeter {
  /**
   * Determine color & impact severity from score
   * @param {number} score - 0 to 100
   */
  static getImpactLevel(score) {
    const s = Math.max(0, Math.min(100, parseFloat(score) || 0));
    if (s <= 30) {
      return {
        level: 'LOW DISRUPTION',
        color: '#059669',
        bg: 'rgba(5, 150, 105, 0.08)',
        border: 'rgba(5, 150, 105, 0.3)',
        icon: '🟢',
        advice: 'Permissible with nominal impact'
      };
    }
    if (s <= 60) {
      return {
        level: 'MODERATE IMPACT',
        color: '#D97706',
        bg: 'rgba(217, 119, 6, 0.08)',
        border: 'rgba(217, 119, 6, 0.3)',
        icon: '🟡',
        advice: 'Freight regulation required'
      };
    }
    if (s <= 85) {
      return {
        level: 'HEAVY DISRUPTION',
        color: '#D9531E',
        bg: 'rgba(217, 83, 30, 0.08)',
        border: 'rgba(217, 83, 30, 0.3)',
        icon: '🟠',
        advice: 'Requires Sr. DOM sanction'
      };
    }
    return {
      level: 'CORRIDOR CHOKE / CRITICAL',
      color: '#DC2626',
      bg: 'rgba(220, 38, 38, 0.08)',
      border: 'rgba(220, 38, 38, 0.3)',
      icon: '🔴',
      advice: 'Impermissible (Express collision)'
    };
  }

  /**
   * Render horizontal visual meter bar
   * @param {Object} props
   * @param {number} props.score - Disruption score (0 to 100)
   * @param {number} [props.delayMinutes=0] - Estimated total delay in minutes
   * @param {number} [props.trainCount=0] - Number of affected trains
   * @param {boolean} [props.compact=false] - Compact single-line mode
   * @returns {string} HTML markup
   */
  static render({ score = 0, delayMinutes = 0, trainCount = 0, compact = false }) {
    const numScore = parseFloat(score).toFixed(1);
    const info = this.getImpactLevel(score);

    if (compact) {
      return `
        <div class="ai-traffic-meter-compact" style="
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: ${info.bg};
          border: 1px solid ${info.border};
          padding: 4px 10px;
          border-radius: 6px;
          font-family: 'Calibri', 'Arial', sans-serif;
          font-size: 0.8rem;
          color: ${info.color};
        " title="Disruption Score: ${numScore}/100 - ${info.level} (${delayMinutes}m total delay)">
          <span>${info.icon}</span>
          <span style="font-weight: 700;">${numScore} Impact</span>
          <div style="width: 48px; height: 5px; background: rgba(195, 178, 150, 0.35); border-radius: 3px; overflow: hidden;">
            <div style="width: ${numScore}%; height: 100%; background: ${info.color}; border-radius: 3px;"></div>
          </div>
        </div>
      `;
    }

    return `
      <div class="ai-traffic-meter-card" style="
        background: #FFFFFF;
        border: 1px solid rgba(195, 178, 150, 0.45);
        border-radius: 8px;
        padding: 12px 14px;
        font-family: 'Calibri', 'Arial', sans-serif;
        box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);
      ">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span>${info.icon}</span>
            <span style="font-size: 0.78rem; font-weight: 700; color: ${info.color}; letter-spacing: 0.4px;">
              ${info.level}
            </span>
          </div>
          <div style="font-family: 'Calibri', 'Arial', sans-serif; font-size: 0.95rem; font-weight: 800; color: ${info.color};">
            ${numScore}<span style="font-size: 0.7rem; color: #64748B;">/100</span>
          </div>
        </div>

        <!-- Meter Bar -->
        <div style="
          width: 100%;
          height: 8px;
          background: #E5DED0;
          border-radius: 4px;
          overflow: hidden;
          position: relative;
          margin-bottom: 8px;
        ">
          <div style="
            width: ${Math.min(numScore, 100)}%;
            height: 100%;
            background: ${info.color};
            border-radius: 4px;
            transition: width 0.6s ease;
          "></div>
        </div>

        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.74rem; color: #475569;">
          <span>⏱️ <strong>${delayMinutes}m</strong> Exp. Delay</span>
          <span>🚆 <strong>${trainCount}</strong> Trains Regulated</span>
          <span style="color: ${info.color}; font-weight: 600;">${info.advice}</span>
        </div>
      </div>
    `;
  }
}

if (typeof window !== 'undefined') {
  window.TrafficImpactMeter = TrafficImpactMeter;
}
