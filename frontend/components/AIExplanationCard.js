/**
 * AIExplanationCard.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Indian Railways AI Maintenance Platform - Component
 * Expandable card that reveals explainable AI (XAI) rationale,
 * key feature weights, and risk drivers behind a prediction.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export class AIExplanationCard {
  /**
   * Render expandable AI Explanation card
   * @param {Object} props
   * @param {string} props.id - Unique element ID
   * @param {string} props.summary - Quick single-line reason summary
   * @param {string} [props.detailedReason] - In-depth natural language explanation
   * @param {Array<Object>} [props.factors] - Top contributing factors [{ name, weight, impact, value }]
   * @param {string} [props.recommendedAction] - Next recommended engineering action
   * @param {boolean} [props.defaultExpanded=false] - Initially open
   * @returns {string} HTML markup
   */
  static render({
    id,
    summary,
    detailedReason = '',
    factors = [],
    recommendedAction = '',
    defaultExpanded = false
  }) {
    const cardId = `ai-xai-${id || Math.random().toString(36).substring(2, 9)}`;
    const expanded = defaultExpanded ? 'expanded' : '';
    const displayStyle = defaultExpanded ? 'block' : 'none';
    const chevronRotation = defaultExpanded ? 'rotate(180deg)' : 'rotate(0deg)';

    const factorBarsHtml = factors.map(f => {
      const pct = Math.min(Math.max((f.weight || f.impact || 0.2) * 100, 5), 100).toFixed(0);
      const color = f.negative ? '#DC2626' : (f.color || '#0056B3');
      return `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; font-size: 0.76rem; font-family: 'Calibri', 'Arial', sans-serif;">
          <span style="color: #334155; width: 44%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500;" title="${f.name}">${f.name}</span>
          <div style="flex: 1; height: 5px; background: #E5DED0; border-radius: 3px; margin: 0 8px; overflow: hidden; position: relative;">
            <div style="width: ${pct}%; height: 100%; background: ${color}; border-radius: 3px;"></div>
          </div>
          <span style="font-family: 'Calibri', 'Arial', sans-serif; color: ${color}; width: 45px; text-align: right; font-weight: 700;">${f.value || `${pct}%`}</span>
        </div>
      `;
    }).join('');

    return `
      <div class="ai-explanation-card ${expanded}" id="${cardId}" style="
        background: #FFFFFF;
        border: 1px solid rgba(195, 178, 150, 0.4);
        border-radius: 6px;
        margin: 0;
        overflow: hidden;
        transition: all 0.2s ease;
        box-shadow: 0 1px 4px rgba(45, 35, 20, 0.04);
        font-family: 'Calibri', 'Arial', sans-serif;
      ">
        <div class="ai-xai-header" onclick="window.AIExplanationCard.toggle('${cardId}')" style="
          padding: 6px 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          cursor: pointer;
          background: #F8F4EC;
          user-select: none;
          gap: 8px;
        ">
          <div style="display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0;">
            <span style="font-size: 0.85rem; flex-shrink: 0;">🧠</span>
            <span style="font-size: 0.74rem; font-weight: 700; color: #003366; letter-spacing: 0.3px; white-space: nowrap; flex-shrink: 0;">AI RATIONALE:</span>
            <span style="font-size: 0.76rem; color: #334155; opacity: 0.95; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${summary || 'Multi-factor risk evaluation applied.'}</span>
          </div>
          <span class="ai-xai-chevron" style="
            font-size: 0.68rem;
            color: #003366;
            transform: ${chevronRotation};
            transition: transform 0.2s ease;
            flex-shrink: 0;
            margin-left: 4px;
          ">▼</span>
        </div>

        <div class="ai-xai-body" style="
          display: ${displayStyle};
          padding: 10px 12px;
          border-top: 1px solid rgba(195, 178, 150, 0.3);
          background: #FCFBF7;
        ">
          ${detailedReason ? `
            <p style="font-size: 0.78rem; color: #334155; line-height: 1.4; margin-bottom: 8px;">
              ${detailedReason}
            </p>
          ` : ''}

          ${factors.length > 0 ? `
            <div style="margin-bottom: 8px;">
              <div style="font-size: 0.70rem; text-transform: uppercase; color: #64748B; font-weight: 700; margin-bottom: 4px; letter-spacing: 0.4px;">
                Key Model Feature Contributions:
              </div>
              ${factorBarsHtml}
            </div>
          ` : ''}

          ${recommendedAction ? `
            <div style="
              display: flex;
              align-items: center;
              gap: 6px;
              padding: 6px 8px;
              border-radius: 5px;
              background: rgba(0, 51, 102, 0.05);
              border: 1px dashed rgba(0, 51, 102, 0.25);
              font-size: 0.74rem;
              color: #003366;
            ">
              <span>🛠️</span>
              <span><strong>Action:</strong> ${recommendedAction}</span>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  /**
   * Toggle expand / collapse of card
   * @param {string} cardId
   */
  static toggle(cardId) {
    const card = document.getElementById(cardId);
    if (!card) return;
    const body = card.querySelector('.ai-xai-body');
    const chevron = card.querySelector('.ai-xai-chevron');

    if (body.style.display === 'none' || !body.style.display) {
      body.style.display = 'block';
      chevron.style.transform = 'rotate(180deg)';
      card.classList.add('expanded');
    } else {
      body.style.display = 'none';
      chevron.style.transform = 'rotate(0deg)';
      card.classList.remove('expanded');
    }
  }
}

if (typeof window !== 'undefined') {
  window.AIExplanationCard = AIExplanationCard;
}
