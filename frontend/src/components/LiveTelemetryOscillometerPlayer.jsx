import React, { useState, useEffect, useRef } from 'react';
import { Radio, Eye, Activity, Camera, Play, Pause, RefreshCw, Zap } from 'lucide-react';

export default function LiveTelemetryOscillometerPlayer() {
  const [isStreaming, setIsStreaming] = useState(true);
  const [refreshRateHz, setRefreshRateHz] = useState(144);
  const [oscData, setOscData] = useState([
    0.12, 0.15, 0.18, 0.22, 0.38, 0.24, 0.16, 0.11, 0.14, 0.19,
    0.21, 0.28, 0.33, 0.29, 0.17, 0.13, 0.15, 0.20, 0.31, 0.25
  ]);
  const [peakG, setPeakG] = useState(0.38);
  const [visionBox, setVisionBox] = useState({ label: 'ERC Clip Missing', conf: '98.9%', bbox: 'KM 142.4 UP' });

  // High-frequency telemetry sampling at chosen Hz
  useEffect(() => {
    if (!isStreaming) return;

    const intervalMs = Math.max(7, Math.round(1000 / refreshRateHz)); // ~6.94ms at 144Hz
    let step = 0;

    const interval = setInterval(() => {
      step++;
      setOscData(prev => {
        // High frequency micro-vibration harmonic synthesis
        const baseNoise = 0.12 + Math.sin(step * 0.1) * 0.08;
        const jitter = (Math.random() - 0.5) * 0.06;
        const spike = Math.random() > 0.94 ? (0.25 + Math.random() * 0.14) : 0;
        const nextVal = Math.min(0.40, Math.max(0.05, Number((baseNoise + jitter + spike).toFixed(3))));
        
        if (nextVal > 0.32) {
          setPeakG(nextVal);
        }
        return [...prev.slice(1), nextVal];
      });
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isStreaming, refreshRateHz]);

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid rgba(195,178,150,0.38)', borderRadius: '12px', padding: '20px', marginBottom: '28px', color: '#0F172A' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Radio size={20} color="#0056B3" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#003366', margin: 0 }}>
            Live Telemetry Oscillometer & Drone RGB Vision Stream Player (PRD §6.2)
          </h3>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Refresh Rate Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#F1F5F9', padding: '3px 6px', borderRadius: '8px', border: '1px solid #CBD5E1' }}>
            <Zap size={14} color="#0056B3" />
            <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#475569', marginRight: '4px' }}>RATE:</span>
            {[60, 100, 144, 240].map((rate) => (
              <button
                key={rate}
                onClick={() => setRefreshRateHz(rate)}
                style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  border: 'none',
                  fontSize: '0.72rem',
                  fontWeight: '800',
                  cursor: 'pointer',
                  background: refreshRateHz === rate ? '#003366' : 'transparent',
                  color: refreshRateHz === rate ? '#FFFFFF' : '#475569',
                  transition: 'all 0.15s ease'
                }}
              >
                {rate} Hz
              </button>
            ))}
          </div>

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
          
          <span style={{ fontSize: '0.72rem', fontWeight: '800', background: 'rgba(5,150,105,0.1)', color: '#059669', padding: '4px 10px', borderRadius: '12px', border: '1px solid rgba(5,150,105,0.3)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#059669', display: 'inline-block' }}></span>
            ● {refreshRateHz} HZ ULTRA-HIGH REFRESH TELEMETRY STREAM ({(1000 / refreshRateHz).toFixed(1)} ms)
          </span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px' }}>
        {/* Drone RGB Machine Vision Stream */}
        <div style={{ background: '#FAF6EE', borderRadius: '10px', padding: '16px', border: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#0056B3', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Camera size={16} />
              <span>Drone RGB Vision Scanner #04 ({refreshRateHz} FPS Synchronized)</span>
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
              <div style={{ fontSize: '0.7rem', color: '#38BDF8', marginTop: '6px', fontFamily: 'monospace' }}>Sampling Frequency: {refreshRateHz} Hz · Frame Latency: {(1000 / refreshRateHz).toFixed(1)} ms</div>
            </div>
          </div>
        </div>

        {/* OMS Oscillometer Accelerometer Waveform */}
        <div style={{ background: '#FAF6EE', borderRadius: '10px', padding: '16px', border: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#0056B3', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Activity size={16} />
              <span>OMS Track Oscillometer Vertical Accel ({refreshRateHz} Hz High-Freq)</span>
            </span>
            <span style={{ fontSize: '0.72rem', color: '#D97706', fontFamily: 'monospace', fontWeight: '700' }}>PEAK: {peakG.toFixed(2)}g (ALJN)</span>
          </div>

          <div style={{ height: '140px', background: '#0F172A', borderRadius: '8px', padding: '12px 10px', display: 'flex', alignItems: 'flex-end', gap: '4px' }}>
            {oscData.map((val, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  background: val > 0.3 ? '#EF4444' : (val > 0.22 ? '#F59E0B' : '#38BDF8'),
                  height: `${Math.min(100, (val / 0.4) * 100)}%`,
                  borderRadius: '3px 3px 0 0',
                  transition: 'height 0.05s ease'
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

