import React, { useState } from 'react';
import { Database, Server, Radio, Shield, Cpu, Network, RefreshCw, CheckCircle2 } from 'lucide-react';

export default function DataSourcesView() {
  const [sources, setSources] = useState([
    { id: 'DS-01', name: 'TMS (Track Management System)', dept: 'Civil Track', type: 'PostgreSQL Geo', rate: 'Live Stream', status: 'ONLINE', latency: '12 ms', recordsProcessed: '1.4M' },
    { id: 'DS-02', name: 'USFD Ultrasonic Flaw Rig', type: 'Binary Oscillography', dept: 'P-Way Maintenance', rate: '100 Hz', status: 'ONLINE', latency: '4 ms', recordsProcessed: '840K' },
    { id: 'DS-03', name: 'TDMS OHE 25kV Telemetry', type: 'SCADA Protocol', dept: 'Electrical TRD', rate: '500 ms', status: 'ONLINE', latency: '8 ms', recordsProcessed: '2.1M' },
    { id: 'DS-04', name: 'SMMS Signal & Interlocking', type: 'Form T/351 Disconnection', dept: 'Signalling', rate: 'Event-driven', status: 'ONLINE', latency: '15 ms', recordsProcessed: '320K' },
    { id: 'DS-05', name: 'COA Timetable & Live Movement', type: 'REST API Gateway', dept: 'Traffic & Control', rate: '1 sec', status: 'ONLINE', latency: '18 ms', recordsProcessed: '4.8M' },
    { id: 'DS-06', name: 'FOIS Freight Operations', type: 'REST API / IRCTC', dept: 'Traffic & Freight', rate: '1 min', status: 'ONLINE', latency: '24 ms', recordsProcessed: '910K' },
    { id: 'DS-07', name: 'Drone RGB Vision Scanner', type: 'EfficientNet-B4 Frames', dept: 'Surveillance Inspection', rate: '30 FPS', status: 'ONLINE', latency: '35 ms', recordsProcessed: '180K' }
  ]);

  const [refreshing, setRefreshing] = useState(false);

  const handleRefreshSources = () => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  };

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1440px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.55rem', fontWeight: '800', color: '#003366' }}>
            RAKSHA PATH Ingestion Gateway & Data Sources Health Console (PRD §6.1)
          </h1>
          <p style={{ fontSize: '0.85rem', color: '#64748B', marginTop: '2px' }}>
            15 Primary Sensor Data Pipelines feeding the AI Swarm · Real-Time Schema Ingestion Health
          </p>
        </div>

        <button
          onClick={handleRefreshSources}
          disabled={refreshing}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '9px 16px', borderRadius: '8px', border: '1px solid rgba(195,178,150,0.45)',
            background: '#FFFFFF', color: '#003366', fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer'
          }}
        >
          <RefreshCw size={15} />
          <span>{refreshing ? 'Refreshing Pipeline Health...' : 'Refresh Pipeline Health'}</span>
        </button>
      </div>

      <div style={{ background: '#FFFFFF', border: '1px solid rgba(195,178,150,0.38)', borderRadius: '12px', padding: '20px' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#003366', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Database size={18} />
          <span>Active Data Ingestion Sources & Real-Time Sync Latency</span>
        </h2>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #CBD5E1', textAlign: 'left', color: '#475569' }}>
              <th style={{ padding: '10px' }}>Source ID</th>
              <th style={{ padding: '10px' }}>Data System Name</th>
              <th style={{ padding: '10px' }}>Department</th>
              <th style={{ padding: '10px' }}>Ingestion Protocol</th>
              <th style={{ padding: '10px' }}>Latency</th>
              <th style={{ padding: '10px' }}>Records Processed</th>
              <th style={{ padding: '10px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ padding: '12px 10px', fontWeight: '700', color: '#003366', fontFamily: 'monospace' }}>{s.id}</td>
                <td style={{ padding: '12px 10px', fontWeight: '700', color: '#0F172A' }}>{s.name}</td>
                <td style={{ padding: '12px 10px', color: '#0056B3', fontWeight: '600' }}>{s.dept}</td>
                <td style={{ padding: '12px 10px', color: '#475569' }}>{s.type}</td>
                <td style={{ padding: '12px 10px', color: '#059669', fontFamily: 'monospace', fontWeight: '700' }}>{s.latency}</td>
                <td style={{ padding: '12px 10px', color: '#64748B', fontFamily: 'monospace' }}>{s.recordsProcessed}</td>
                <td style={{ padding: '12px 10px', fontWeight: '700', color: '#059669' }}>● {s.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
