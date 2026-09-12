import React, { useEffect, useState } from 'react';
import { Radio, RefreshCw, Zap, AlertTriangle } from 'lucide-react';

export default function WebSocketSseLivePushWidget() {
  const [messages, setMessages] = useState([]);
  const [connected, setConnected] = useState(true);

  useEffect(() => {
    // Simulated SSE / WebSocket push feed
    const interval = setInterval(() => {
      const sampleEvents = [
        { id: `EVT-${Date.now()}`, type: 'TRAIN_MOVEMENT', desc: 'Vande Bharat #22436 passed ALJN Junction at 160 km/h', status: 'INFO' },
        { id: `EVT-${Date.now() + 1}`, type: 'POWER_BLOCK', desc: '25kV Traction Power Block Granted on NDLS-CNB UP (KM 142.4)', status: 'WARNING' },
        { id: `EVT-${Date.now() + 2}`, type: 'TELEMETRY_ALERT', desc: 'USFD Telemetry Rig #02 detected transverse fissure at KM 210.5', status: 'CRITICAL' }
      ];
      const randomEvt = sampleEvents[Math.floor(Math.random() * sampleEvents.length)];
      setMessages(prev => [randomEvt, ...prev.slice(0, 4)]);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid rgba(195,178,150,0.38)', borderRadius: '12px', padding: '18px', marginBottom: '28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Zap size={18} color="#0056B3" />
          <h4 style={{ fontSize: '0.95rem', fontWeight: '800', color: '#003366', margin: 0 }}>
            Server-Sent Events (SSE) & WebSocket Live Corridor Push Stream
          </h4>
        </div>
        <span style={{ fontSize: '0.72rem', fontWeight: '800', background: 'rgba(5,150,105,0.1)', color: '#059669', padding: '3px 10px', borderRadius: '10px' }}>
          ● SSE STREAM CONNECTED (PORT 5000)
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {messages.map(m => (
          <div key={m.id} style={{
            background: m.status === 'CRITICAL' ? '#FEF2F2' : (m.status === 'WARNING' ? '#FFFBEB' : '#F8FAFC'),
            borderLeft: `4px solid ${m.status === 'CRITICAL' ? '#EF4444' : (m.status === 'WARNING' ? '#F59E0B' : '#0056B3')}`,
            borderRadius: '6px', padding: '8px 12px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
          }}>
            <span style={{ color: '#0F172A', fontWeight: '600' }}>{m.desc}</span>
            <span style={{ fontSize: '0.68rem', color: '#64748B', fontFamily: 'monospace' }}>{m.type}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
