import React, { useState } from 'react';
import { Network, RefreshCw, ShieldCheck, Database, Layers } from 'lucide-react';

export default function FederatedLearningDashboardWidget() {
  const [syncing, setSyncing] = useState(false);
  const [zones, setZones] = useState([
    { zone: 'Northern Railway (NR - DLI)', status: 'SYNCHRONIZED', version: 'v2.4.1', weightsShared: 1420 },
    { zone: 'North Central Railway (NCR - PRYJ)', status: 'SYNCHRONIZED', version: 'v2.4.1', weightsShared: 1180 },
    { zone: 'Eastern Railway (ER - HWH)', status: 'PENDING_GRADIENT', version: 'v2.4.0', weightsShared: 950 },
    { zone: 'Western Railway (WR - MMCT)', status: 'SYNCHRONIZED', version: 'v2.4.1', weightsShared: 1610 },
  ]);

  const handleTriggerSync = () => {
    setSyncing(true);
    setTimeout(() => {
      setZones(prev => prev.map(z => ({ ...z, status: 'SYNCHRONIZED', version: 'v2.4.2' })));
      setSyncing(false);
    }, 2000);
  };

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid rgba(195,178,150,0.38)', borderRadius: '12px', padding: '20px', marginBottom: '28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Network size={20} color="#0056B3" />
          <h3 style={{ fontSize: '1.05rem', fontWeight: '800', color: '#003366', margin: 0 }}>
            Federated Learning & Cross-Zone Governed Model Aggregation (PRD §10.5)
          </h3>
        </div>

        <button
          onClick={handleTriggerSync}
          disabled={syncing}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '6px 14px', borderRadius: '6px', border: 'none',
            background: 'linear-gradient(135deg, #003366, #0056B3)', color: '#FFFFFF',
            fontWeight: '700', fontSize: '0.78rem', cursor: syncing ? 'not-allowed' : 'pointer'
          }}
        >
          <RefreshCw size={14} />
          <span>{syncing ? 'Aggregating Local Gradients...' : 'Trigger Cross-Zone Gradient Sync'}</span>
        </button>
      </div>

      <p style={{ fontSize: '0.78rem', color: '#64748B', marginBottom: '14px' }}>
        Participating zonal railways train local priority models on raw operational data locally, sharing only encrypted gradient parameters with the national aggregator (Zero-Trust Indian Data Residency).
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
        {zones.map((z, idx) => (
          <div key={idx} style={{ background: '#FAF6EE', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: '800', color: '#003366' }}>{z.zone}</div>
            <div style={{ fontSize: '0.72rem', color: '#64748B', marginTop: '2px' }}>Model Version: {z.version} | Weights: {z.weightsShared}</div>
            <div style={{ fontSize: '0.74rem', fontWeight: '800', color: z.status === 'SYNCHRONIZED' ? '#059669' : '#D97706', marginTop: '6px' }}>
              ● {z.status}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
