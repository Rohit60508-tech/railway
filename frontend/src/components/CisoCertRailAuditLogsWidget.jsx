import React, { useState } from 'react';
import { ShieldCheck, Lock, UserCheck, AlertTriangle, Key } from 'lucide-react';

export default function CisoCertRailAuditLogsWidget() {
  const [logs, setLogs] = useState([
    { id: 'SEC-901', timestamp: '03:55:12', user: 'ciso_officer', event: 'MFA_STEP_UP_VERIFICATION', status: 'SUCCESS', ip: '10.117.48.14', details: 'Privileged step-up auth granted for 25kV OHE isolation override' },
    { id: 'SEC-902', timestamp: '03:42:08', user: 'admin', event: 'ENCRYPTION_KEY_ROTATION', status: 'SUCCESS', ip: '10.117.48.10', details: 'HSM AES-256 evidence encryption key rotated' },
    { id: 'SEC-903', timestamp: '03:20:45', user: 'controller1', event: 'TWO_PERSON_GATE_SIGN', status: 'SUCCESS', ip: '10.117.48.22', details: 'Co-signed high-risk TSR waiver with staff ID IR-NDLS-8842' },
    { id: 'SEC-904', timestamp: '02:15:30', user: 'UNVERIFIED_CLIENT', event: 'UNAUTHORIZED_API_ATTEMPT', status: 'BLOCKED', ip: '192.168.1.104', details: 'Blocked by Zero-Trust Mutual TLS / API Gateway policy' },
  ]);

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid rgba(195,178,150,0.38)', borderRadius: '12px', padding: '20px', marginBottom: '28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Lock size={20} color="#DC2626" />
          <h3 style={{ fontSize: '1.05rem', fontWeight: '800', color: '#003366', margin: 0 }}>
            CISO & CERT-Rail Cybersecurity Audit & Access Review Log (PRD §5)
          </h3>
        </div>
        <span style={{ fontSize: '0.72rem', fontWeight: '800', background: 'rgba(220,38,38,0.1)', color: '#DC2626', padding: '3px 10px', borderRadius: '10px' }}>
          ● ZERO-TRUST IAM ACTIVE
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #CBD5E1', textAlign: 'left', color: '#475569' }}>
              <th style={{ padding: '10px' }}>Security ID</th>
              <th style={{ padding: '10px' }}>Timestamp</th>
              <th style={{ padding: '10px' }}>User / Subject</th>
              <th style={{ padding: '10px' }}>Security Event</th>
              <th style={{ padding: '10px' }}>IP Address</th>
              <th style={{ padding: '10px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(l => (
              <tr key={l.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ padding: '12px 10px', fontWeight: '700', color: '#003366', fontFamily: 'monospace' }}>{l.id}</td>
                <td style={{ padding: '12px 10px', color: '#64748B', fontFamily: 'monospace' }}>{l.timestamp}</td>
                <td style={{ padding: '12px 10px', fontWeight: '700', color: '#0F172A' }}>{l.user}</td>
                <td style={{ padding: '12px 10px', color: '#475569' }}>{l.event} — <em>{l.details}</em></td>
                <td style={{ padding: '12px 10px', color: '#64748B', fontFamily: 'monospace' }}>{l.ip}</td>
                <td style={{ padding: '12px 10px', fontWeight: '800', color: l.status === 'SUCCESS' ? '#059669' : '#DC2626' }}>
                  ● {l.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
