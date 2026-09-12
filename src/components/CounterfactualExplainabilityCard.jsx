import React from 'react';
import { HelpCircle, Shield, AlertTriangle, ArrowRight } from 'lucide-react';

export default function CounterfactualExplainabilityCard({ recommendation }) {
  if (!recommendation) {
    recommendation = {
      selectedSlot: '02:00 – 04:00 (NDLS-CNB UP Main Line)',
      selectedScore: 94.5,
      selectedReason: 'All Engineering & Traction teams available; minimum freight disruption (0.2h delay index). 25kV OHE isolation pre-approved.',
      rejectedAlternatives: [
        { slot: '23:30 – 01:30', score: 62.0, rejectReason: 'Rejected due to high forecast freight load (4 heavy coal rakes from Dadri Terminal).' },
        { slot: '03:30 – 05:30', score: 48.0, rejectReason: 'Rejected due to morning Vande Bharat #22436 passenger peak and unavailable S&T team.' }
      ]
    };
  }

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid rgba(195,178,150,0.38)', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
        <HelpCircle size={20} color="#0056B3" />
        <h3 style={{ fontSize: '1.05rem', fontWeight: '800', color: '#003366', margin: 0 }}>
          Counterfactual Explainability Engine (PRD §10.3 Requirement)
        </h3>
      </div>

      {/* Selected Slot */}
      <div style={{ background: 'rgba(5,150,105,0.06)', border: '1px solid rgba(5,150,105,0.25)', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#047857' }}>
            ✓ OPTIMAL SELECTED SLOT: {recommendation.selectedSlot}
          </span>
          <span style={{ fontSize: '0.75rem', fontWeight: '800', background: '#059669', color: '#FFF', padding: '2px 8px', borderRadius: '12px' }}>
            SCORE: {recommendation.selectedScore} PTS
          </span>
        </div>
        <p style={{ fontSize: '0.8rem', color: '#334155', margin: 0, lineHeight: '1.5' }}>
          {recommendation.selectedReason}
        </p>
      </div>

      {/* Rejected Counterfactual Alternatives */}
      <div>
        <div style={{ fontSize: '0.78rem', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', marginBottom: '10px' }}>
          Counterfactual Rejection Analysis (Next-Best Alternatives)
        </div>
        {recommendation.rejectedAlternatives.map((alt, idx) => (
          <div key={idx} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.82rem', fontWeight: '700', color: '#475569' }}>
                ✕ Alternative {idx + 1}: {alt.slot}
              </span>
              <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#DC2626' }}>
                SCORE: {alt.score} PTS
              </span>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#B91C1C', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle size={14} />
              <span>{alt.rejectReason}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
