import React from 'react';
import { Truck, Container, BarChart2, AlertCircle } from 'lucide-react';

export default function FoisFreightCongestionMatrixWidget() {
  const FREIGHT_RAKES = [
    { rakeId: 'BOXN-9842', commodity: 'Thermal Coal (Dadri Power House)', location: 'KM 64.2 GZB Loop-2', impactIndex: 'HIGH (4 Rakes Pending)', status: 'HOLDING_FOR_PASSENGER' },
    { rakeId: 'BCNA-4412', commodity: 'FCI Foodgrain Rake', location: 'ALJN Yard Siding', impactIndex: 'LOW (Terminal Free)', status: 'UNLOADED' },
    { rakeId: 'BTPN-1108', commodity: 'IOCL POL Tanker Rake', location: 'KM 188.4 TDL Section', impactIndex: 'MED (Congestion Risk)', status: 'REGULATED_TSR' }
  ];

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid rgba(195,178,150,0.38)', borderRadius: '12px', padding: '20px', marginBottom: '28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
        <Truck size={20} color="#D97706" />
        <h3 style={{ fontSize: '1.05rem', fontWeight: '800', color: '#003366', margin: 0 }}>
          FOIS Freight Rake Congestion & Terminal Impact Matrix (PRD §6.1)
        </h3>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px' }}>
        {FREIGHT_RAKES.map((r, idx) => (
          <div key={idx} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '14px', borderLeft: '4px solid #D97706' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#003366', fontFamily: 'monospace' }}>{r.rakeId}</span>
              <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#D97706' }}>{r.impactIndex}</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#0F172A', fontWeight: '700' }}>{r.commodity}</div>
            <div style={{ fontSize: '0.74rem', color: '#64748B', marginTop: '2px' }}>Location: {r.location}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
