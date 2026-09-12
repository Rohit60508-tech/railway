import React, { useState } from 'react';
import { Calendar, Clock, Layers, Filter } from 'lucide-react';

export default function InteractiveGanttScheduleChart() {
  const [horizon, setHorizon] = useState('WEEKLY');

  const SCHEDULED_BLOCKS = [
    { id: 'BLK-101', title: 'USFD Rail Fracture Cut & Weld', dept: 'CIVIL', section: 'NDLS-CNB UP', day: 'Mon', start: '01:30', end: '03:30', status: 'SANCTIONED', color: '#0056B3' },
    { id: 'BLK-102', title: '25kV OHE Dropper & Contact Wire', dept: 'TRD', section: 'GZB-ALJN DN', day: 'Tue', start: '02:00', end: '04:00', status: 'BUNDLED', color: '#D97706' },
    { id: 'BLK-103', title: 'Point Machine #114B Overhaul', dept: 'SIG', section: 'ALJN Yard', day: 'Wed', start: '12:45', end: '14:15', status: 'APPROVED', color: '#059669' },
    { id: 'BLK-104', title: 'CSM Tamper Ballast Packing', dept: 'CIVIL', section: 'NDLS-ALJN UP', day: 'Thu', start: '01:00', end: '04:00', status: 'PENDING_TWIN', color: '#DC2626' },
  ];

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid rgba(195,178,150,0.38)', borderRadius: '12px', padding: '20px', marginBottom: '28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Calendar size={20} color="#003366" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#003366', margin: 0 }}>
            Interactive Maintenance Gantt Schedule Chart (PRD §11.1)
          </h3>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {['WEEKLY', 'MONTHLY', 'ROLLING'].map(h => (
            <button
              key={h}
              onClick={() => setHorizon(h)}
              style={{
                padding: '6px 12px', borderRadius: '6px', border: '1px solid ' + (horizon === h ? '#003366' : 'rgba(0,51,102,0.2)'),
                background: horizon === h ? 'rgba(0,51,102,0.1)' : 'transparent', color: '#003366', fontWeight: '700', fontSize: '0.78rem', cursor: 'pointer'
              }}
            >
              {h} PLAN
            </button>
          ))}
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
          <thead>
            <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #CBD5E1', textAlign: 'left', color: '#475569' }}>
              <th style={{ padding: '10px' }}>Block ID & Scope</th>
              <th style={{ padding: '10px' }}>Dept</th>
              <th style={{ padding: '10px' }}>Corridor Section</th>
              <th style={{ padding: '10px' }}>Day & Window</th>
              <th style={{ padding: '10px' }}>Gantt Timeline Visualization (24h Window)</th>
              <th style={{ padding: '10px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {SCHEDULED_BLOCKS.map(b => (
              <tr key={b.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ padding: '12px 10px', fontWeight: '700', color: '#003366' }}>
                  {b.id}: {b.title}
                </td>
                <td style={{ padding: '12px 10px', fontWeight: '800', color: b.color }}>{b.dept}</td>
                <td style={{ padding: '12px 10px', color: '#475569', fontFamily: 'monospace' }}>{b.section}</td>
                <td style={{ padding: '12px 10px', fontWeight: '600', color: '#0F172A' }}>{b.day} ({b.start} – {b.end})</td>
                <td style={{ padding: '12px 10px', width: '35%' }}>
                  <div style={{ height: '24px', background: '#F1F5F9', borderRadius: '12px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{
                      position: 'absolute', left: b.start === '01:30' ? '15%' : (b.start === '02:00' ? '20%' : (b.start === '12:45' ? '55%' : '10%')),
                      width: '35%', height: '100%', background: b.color, borderRadius: '12px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', fontSize: '0.68rem', fontWeight: '800'
                    }}>
                      {b.start} – {b.end}
                    </div>
                  </div>
                </td>
                <td style={{ padding: '12px 10px', fontWeight: '800', color: b.status === 'SANCTIONED' ? '#059669' : '#D97706' }}>
                  ● {b.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
