import React, { useState } from 'react';
import { API } from '../services/apiClient';
import LiveTelemetryOscillometerPlayer from '../components/LiveTelemetryOscillometerPlayer';
import { Radio, Eye, Activity, Camera, AlertCircle, CheckCircle, ShieldAlert } from 'lucide-react';

export default function SurveillanceView() {
  const [alerts, setAlerts] = useState([
    { id: 'ALT-101', sensor: 'Drone RGB Vision Scanner #04', location: 'KM 142.4 UP', defect: 'Missing Elastic Rail Clip (ERC)', confidence: '96.8%', status: 'UNVERIFIED', severity: 'CRITICAL' },
    { id: 'ALT-102', sensor: 'OMS Track Oscillometer #12', location: 'KM 188.1 DOWN', defect: 'Vertical Peak Acceleration >0.25g', confidence: '94.2%', status: 'CONFIRMED', severity: 'URGENT' },
    { id: 'ALT-103', sensor: 'USFD Telemetry Rig #02', location: 'KM 210.5 UP', defect: 'Transverse Internal Fissure', confidence: '98.1%', status: 'VERIFIED (IMR)', severity: 'EMERGENCY P1' }
  ]);

  const [inspectModalOpen, setInspectModalOpen] = useState(false);
  const [activeAlert, setActiveAlert] = useState(null);

  const handleVerifyAlert = (id) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, status: 'VERIFIED BY INSPECTOR' } : a));

    API.recordAuditAction({
      entry_name: 'SURVEILLANCE_RGB_DEFECT_VERIFIED',
      event_type: 'INSPECTOR_VERIFICATION',
      user_name: 'Track Safety Specialist',
      staff_id: 'IR-SURV-7712',
      target_entity_id: id,
      reason: `Drone RGB defect verified and escalated for statutory P-Way action`,
      action_payload: activeAlert || { alert_id: id }
    }).catch(err => console.warn('[Audit Sign Error]:', err));

    setInspectModalOpen(false);
  };

  const handleInspect = (alert) => {
    setActiveAlert(alert);
    setInspectModalOpen(true);
  };

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1440px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '1.55rem', fontWeight: '800', color: '#003366' }}>
          Surveillance & Telemetry Inspector Console
        </h1>
        <p style={{ fontSize: '0.85rem', color: '#64748B', marginTop: '2px' }}>
          Track Safety Specialist · Machine Vision EfficientNet-B4 + ViT Alerts & OMS Oscillations
        </p>
      </div>

      {/* Live Telemetry Oscillometer & Drone RGB Vision Stream Player */}
      <LiveTelemetryOscillometerPlayer />

      {/* Automated Vision & Telemetry Alerts Table */}
      <div style={{ background: '#FFFFFF', border: '1px solid rgba(195,178,150,0.38)', borderRadius: '12px', padding: '20px' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#003366', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Radio size={18} />
          <span>Real-time Automated Vision & Telemetry Defect Detection</span>
        </h2>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #CBD5E1', textAlign: 'left', color: '#475569' }}>
              <th style={{ padding: '10px' }}>Alert ID</th>
              <th style={{ padding: '10px' }}>Sensor Feed</th>
              <th style={{ padding: '10px' }}>Location</th>
              <th style={{ padding: '10px' }}>Detected Anomaly</th>
              <th style={{ padding: '10px' }}>Model Confidence</th>
              <th style={{ padding: '10px' }}>Status</th>
              <th style={{ padding: '10px' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map(a => (
              <tr key={a.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ padding: '12px 10px', fontWeight: '700', color: '#003366', fontFamily: 'monospace' }}>{a.id}</td>
                <td style={{ padding: '12px 10px', color: '#0056B3', fontWeight: '600' }}>{a.sensor}</td>
                <td style={{ padding: '12px 10px', color: '#64748B', fontFamily: 'monospace' }}>{a.location}</td>
                <td style={{ padding: '12px 10px', fontWeight: '700', color: '#0F172A' }}>{a.defect}</td>
                <td style={{ padding: '12px 10px', fontWeight: '700', color: '#059669' }}>{a.confidence}</td>
                <td style={{ padding: '12px 10px', fontWeight: '700', color: a.status.includes('VERIFIED') ? '#059669' : '#D97706' }}>
                  ● {a.status}
                </td>
                <td style={{ padding: '12px 10px' }}>
                  <button
                    onClick={() => handleInspect(a)}
                    style={{
                      padding: '5px 10px', borderRadius: '6px', border: '1px solid rgba(0,86,179,0.3)',
                      background: 'rgba(0,86,179,0.06)', color: '#0056B3', fontWeight: '700', fontSize: '0.74rem', cursor: 'pointer'
                    }}
                  >
                    Inspect RGB Scan
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Inspect Modal */}
      {inspectModalOpen && activeAlert && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '16px'
        }}>
          <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid rgba(195,178,150,0.45)', width: '100%', maxWidth: '500px', padding: '28px', boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#003366', marginBottom: '8px' }}>
              Drone RGB Machine Vision Scan Inspection
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#64748B', marginBottom: '16px' }}>
              Alert: <strong>{activeAlert.id} ({activeAlert.location})</strong>
            </p>

            <div style={{
              height: '180px', borderRadius: '10px', background: '#0F172A',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#38BDF8', border: '1px border #334155', marginBottom: '16px', flexDirection: 'column', gap: '8px'
            }}>
              <Camera size={32} />
              <div style={{ fontSize: '0.85rem', fontWeight: '700' }}>EfficientNet-B4 Bounding Box Object Detection</div>
              <div style={{ fontSize: '0.75rem', color: '#34D399' }}>Bounding Box Confidence: {activeAlert.confidence}</div>
            </div>

            <div style={{ fontSize: '0.82rem', color: '#334155', marginBottom: '20px', lineHeight: '1.5' }}>
              <strong>Detected Anomaly:</strong> {activeAlert.defect}<br />
              <strong>Sensor Unit:</strong> {activeAlert.sensor}<br />
              <strong>Statutory Instruction:</strong> Mandatory field gang verification within 24h per IRPWM Para 268.
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setInspectModalOpen(false)}
                style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#64748B', fontWeight: '700', fontSize: '0.84rem', cursor: 'pointer' }}
              >
                Close
              </button>
              <button
                onClick={() => handleVerifyAlert(activeAlert.id)}
                style={{ padding: '10px 18px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #059669, #047857)', color: '#FFFFFF', fontWeight: '700', fontSize: '0.84rem', cursor: 'pointer' }}
              >
                Verify & Escalate Defect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
