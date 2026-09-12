import React, { useState } from 'react';
import { RefreshCw, Activity, Cpu, Play, CheckCircle } from 'lucide-react';

export default function RetrainingPipelineDriftMonitorWidget() {
  const [retraining, setRetraining] = useState(false);
  const [driftStatus, setDriftStatus] = useState({ driftIndex: 0.024, status: 'STABLE', accuracy: '98.6%' });

  const handleTriggerRetrain = () => {
    setRetraining(true);
    setTimeout(() => {
      setDriftStatus({ driftIndex: 0.008, status: 'RE-CALIBRATED', accuracy: '99.2%' });
      setRetraining(false);
    }, 2500);
  };

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid rgba(195,178,150,0.38)', borderRadius: '12px', padding: '18px', marginBottom: '28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Cpu size={18} color="#059669" />
          <h4 style={{ fontSize: '0.95rem', fontWeight: '800', color: '#003366', margin: 0 }}>
            Automated Model Retraining Pipeline & Concept Drift Monitor
          </h4>
        </div>

        <button
          onClick={handleTriggerRetrain}
          disabled={retraining}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '6px 12px', borderRadius: '6px', border: 'none',
            background: 'linear-gradient(135deg, #003366, #0056B3)', color: '#FFFFFF',
            fontWeight: '700', fontSize: '0.78rem', cursor: retraining ? 'not-allowed' : 'pointer'
          }}
        >
          <RefreshCw size={14} />
          <span>{retraining ? 'Retraining XGBoost Model...' : 'Trigger Pipeline Retraining'}</span>
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
        <div style={{ background: '#FAF6EE', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: '700' }}>CONCEPT DRIFT INDEX</div>
          <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#059669', marginTop: '2px' }}>{driftStatus.driftIndex}</div>
        </div>

        <div style={{ background: '#FAF6EE', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: '700' }}>MODEL ACCURACY</div>
          <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#0056B3', marginTop: '2px' }}>{driftStatus.accuracy}</div>
        </div>

        <div style={{ background: '#FAF6EE', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: '700' }}>PIPELINE STATUS</div>
          <div style={{ fontSize: '1.2rem', fontWeight: '800', color: '#059669', marginTop: '2px' }}>● {driftStatus.status}</div>
        </div>
      </div>
    </div>
  );
}
