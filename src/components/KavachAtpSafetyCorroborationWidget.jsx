import React from 'react';
import { Shield, Zap, AlertTriangle } from 'lucide-react';

export default function KavachAtpSafetyCorroborationWidget() {
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid rgba(195,178,150,0.38)', borderRadius: '12px', padding: '20px', marginBottom: '28px', color: '#0F172A' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Shield size={20} color="#0056B3" />
          <h3 style={{ fontSize: '1.05rem', fontWeight: '800', color: '#003366', margin: 0 }}>
            Kavach Automatic Train Protection (ATP) & SCADA 25kV Feeder Console (PRD §6.1, §6.2)
          </h3>
        </div>
        <span style={{ fontSize: '0.72rem', fontWeight: '800', background: 'rgba(0,86,179,0.08)', color: '#0056B3', padding: '3px 10px', borderRadius: '10px' }}>
          ● KAVACH ATP TELEMETRY ACTIVE
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div style={{ background: '#FAF6EE', borderRadius: '8px', padding: '14px', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: '800', color: '#0056B3', marginBottom: '6px' }}>
            Kavach ATP Movement Authority Alignment
          </div>
          <div style={{ fontSize: '0.76rem', color: '#334155', lineHeight: '1.5' }}>
            <strong>Section:</strong> NDLS-CNB UP (KM 140-160)<br />
            <strong>Movement Authority:</strong> 160 km/h Clear Target<br />
            <strong>Rake RFID Alignment:</strong> 100% Corroborated with COA Timetable
          </div>
        </div>

        <div style={{ background: '#FAF6EE', borderRadius: '8px', padding: '14px', border: '1px solid #E2E8F0' }}>
          <div style={{ fontSize: '0.8rem', fontWeight: '800', color: '#D97706', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Zap size={15} />
            <span>SCADA 25kV Substation Power-Quality</span>
          </div>
          <div style={{ fontSize: '0.76rem', color: '#334155', lineHeight: '1.5' }}>
            <strong>Traction Substation:</strong> ALJN 132/25kV TSS<br />
            <strong>Feeder Status:</strong> Online (Feeder Trip History: 0 in 24h)<br />
            <strong>Voltage / Load:</strong> 24.8 kV · 140 A (Stable Load)
          </div>
        </div>
      </div>
    </div>
  );
}

