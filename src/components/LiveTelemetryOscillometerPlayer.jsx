import React, { useState, useEffect } from 'react';
import { Radio, Eye, Activity, Camera, Play, Pause, RefreshCw } from 'lucide-react';

export default function LiveTelemetryOscillometerPlayer() {
  const [isStreaming, setIsStreaming] = useState(true);
  const [oscData, setOscData] = useState([0.12, 0.15, 0.18, 0.22, 0.38, 0.24, 0.16, 0.11, 0.14, 0.19]);
  const [visionBox, setVisionBox] = useState({ label: 'ERC Clip Missing', conf: '96.8%', bbox: 'KM 142.4 UP' });

  useEffect(() => {
    if (!isStreaming) return;
    const interval = setInterval(() => {
      setOscData(prev => {
        const nextVal = Number((0.10 + Math.random() * 0.25).toFixed(2));
        return [...prev.slice(1), nextVal];
      });
    }, 1500);
    return () => clearInterval(interval);
  }, [isStreaming]);

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid rgba(195,178,150,0.38)', borderRadius: '12px', padding: '20px', marginBottom: '28px', color: '#0F172A' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Radio size={20} color="#0056B3" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#003366', margin: 0 }}>
            Live Telemetry Oscillometer & Drone RGB Vision Stream Player (PRD §6.2)
          </h3>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setIsStreaming(!isStreaming)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '6px 12px', borderRadius: '6px', border: 'none',
              background: isStreaming ? '#FEF2F2' : '#ECFDF5',
              color: isStreaming ? '#DC2626' : '#059669', fontWeight: '700', fontSize: '0.78rem', cursor: 'pointer'
            }}
          >
            {isStreaming ? <Pause size={14} /> : <Play size={14} />}
            <span>{isStreaming ? 'PAUSE STREAM' : 'RESUME STREAM'}</span>
          </button>
          <span style={{ fontSize: '0.72rem', fontWeight: '800', background: 'rgba(5,150,105,0.1)', color: '#059669', padding: '4px 10px', borderRadius: '12px', border: '1px solid rgba(5,150,105,0.3)' }}>
            ● 50 FPS LIVE TELEMETRY STREAM
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
        {/* Drone RGB Machine Vision Stream */}
        <div style={{ background: '#FAF6EE', borderRadius: '10px', padding: '16px', border: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#0056B3', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Camera size={16} />
              <span>Drone RGB Vision Scanner #04 (EfficientNet-B4)</span>
            </span>
            <span style={{ fontSize: '0.72rem', color: '#059669', fontFamily: 'monospace', fontWeight: '700' }}>BBOX CONF: {visionBox.conf}</span>
          </div>

          <div style={{
            height: '140px', background: '#0F172A', borderRadius: '8px', border: '2px solid #DC2626',
            position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F8FAFC'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: '800', color: '#EF4444' }}>[!] BBOX DETECTED: {visionBox.label}</div>
              <div style={{ fontSize: '0.75rem', color: '#CBD5E1', marginTop: '4px' }}>Location: {visionBox.bbox}</div>
            </div>
          </div>
        </div>

        {/* OMS Oscillometer Accelerometer Waveform */}
        <div style={{ background: '#FAF6EE', borderRadius: '10px', padding: '16px', border: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#0056B3', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Activity size={16} />
              <span>OMS Track Oscillometer Vertical Accel (g)</span>
            </span>
            <span style={{ fontSize: '0.72rem', color: '#D97706', fontFamily: 'monospace', fontWeight: '700' }}>PEAK: 0.38g (ALJN)</span>
          </div>

          <div style={{ height: '140px', background: '#0F172A', borderRadius: '8px', padding: '12px', display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
            {oscData.map((val, i) => (
              <div key={i} style={{ flex: 1, background: val > 0.3 ? '#EF4444' : '#38BDF8', height: `${(val / 0.4) * 100}%`, borderRadius: '4px 4px 0 0' }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

