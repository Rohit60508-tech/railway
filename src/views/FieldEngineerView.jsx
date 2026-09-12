import React, { useState } from 'react';
import { Wrench, Plus, CheckCircle2, Clock, AlertTriangle, Shield, FileSpreadsheet } from 'lucide-react';

export default function FieldEngineerView() {
  const [workOrders, setWorkOrders] = useState([
    { id: 'WO-8821', asset: '60kg Rail Track (KM 142.4)', type: 'USFD IMR Flaw Repair', priority: 'P1 Emergency', status: 'IN PROGRESS', assignedGang: 'Gang #4 (SSE P-Way ALJN)', targetHours: '4h' },
    { id: 'WO-8822', asset: 'Point Turnout #114B (ALJN Yard)', type: 'Sleeper & Tongue Rail Tamping', priority: 'P2 Urgent', status: 'SANCTIONED', assignedGang: 'Gang #2 (SSE Signal)', targetHours: '24h' },
    { id: 'WO-8823', asset: 'OHE Dropper & Contact Wire', type: 'Stagger Adjustment & Height Check', priority: 'P3 Planned', status: 'SCHEDULED', assignedGang: 'Gang #7 (SSE TRD)', targetHours: '72h' }
  ]);

  const [modalOpen, setModalOpen] = useState(false);
  const [newAsset, setNewAsset] = useState('');
  const [newScope, setNewScope] = useState('');
  const [newPriority, setNewPriority] = useState('P2 Urgent');
  const [newGang, setNewGang] = useState('Gang #4 (SSE P-Way)');

  const handleStatusToggle = (id) => {
    setWorkOrders(prev => prev.map(w => {
      if (w.id === id) {
        const nextStatus = w.status === 'IN PROGRESS' ? 'COMPLETED (VERIFIED)' : w.status === 'SANCTIONED' ? 'IN PROGRESS' : 'SANCTIONED';
        API.recordAuditAction({
          entry_name: 'FIELD_WORK_ORDER_PROGRESS_UPDATE',
          event_type: 'WORK_ORDER_UPDATE',
          user_name: 'Senior Section Engineer (P-Way)',
          staff_id: 'IR-SSE-4402',
          target_entity_id: id,
          reason: `Work order status changed to ${nextStatus}`,
          action_payload: { asset: w.asset, new_status: nextStatus }
        }).catch(err => console.warn('[Audit Sign Error]:', err));

        return { ...w, status: nextStatus };
      }
      return w;
    }));
  };

  const handleCreateWorkOrder = (e) => {
    e.preventDefault();
    if (!newAsset.trim() || !newScope.trim()) return;

    const newId = `WO-${Math.floor(1000 + Math.random() * 9000)}`;
    const newWo = {
      id: newId,
      asset: newAsset.trim(),
      type: newScope.trim(),
      priority: newPriority,
      status: 'SANCTIONED',
      assignedGang: newGang,
      targetHours: '24h'
    };

    setWorkOrders(prev => [newWo, ...prev]);

    API.recordAuditAction({
      entry_name: 'FIELD_WORK_ORDER_CREATED',
      event_type: 'WORK_ORDER_CREATE',
      user_name: 'Senior Section Engineer (P-Way)',
      staff_id: 'IR-SSE-4402',
      target_entity_id: newId,
      reason: `New maintenance work order created for asset ${newAsset.trim()}`,
      action_payload: newWo
    }).catch(err => console.warn('[Audit Sign Error]:', err));

    setNewAsset('');
    setNewScope('');
    setModalOpen(false);
  };

  const [selectedDept, setSelectedDept] = useState('ALL');

  const bundlingData = [
    {
      bundleId: "BNDL-NDLS-CNB-001",
      sectionId: "NDLS-CNB-UP (KM 410-416)",
      timeWindow: "01:30 – 04:00 (2h 30m)",
      synergyScore: 94,
      savedHours: 2.5,
      departments: ["CIVIL", "TRD_OHE", "SIGNALLING"],
      tasks: [
        { id: "WO-CIVIL-401", desc: "USFD rail fracture replacement & flash-butt welding", machine: "Flash Butt Welder", duration: "120m" },
        { id: "WO-TRD-112", desc: "25kV OHE dropper adjustment under power shadow block", machine: "Tower Wagon 08", duration: "90m" },
        { id: "WO-SIG-094", desc: "Track circuit bonding & insulation resistance test", machine: null, duration: "45m" }
      ]
    },
    {
      bundleId: "BNDL-GZB-ALJN-003",
      sectionId: "GZB-ALJN-DN (KM 64-68)",
      timeWindow: "12:45 – 15:15 (2h 30m)",
      synergyScore: 88,
      savedHours: 2.0,
      departments: ["CIVIL", "TRD_OHE"],
      tasks: [
        { id: "WO-CIVIL-419", desc: "CSM Continuous Action Tamper track ballast packing", machine: "CSM-44", duration: "140m" },
        { id: "WO-TRD-125", desc: "Catenary wire contact height verification", machine: "Tower Wagon 04", duration: "80m" }
      ]
    }
  ];

  const filteredWorkOrders = selectedDept === 'ALL'
    ? workOrders
    : workOrders.filter(w => (selectedDept === 'CIVIL' && w.asset.includes('Rail')) || (selectedDept === 'TRD' && w.asset.includes('OHE')) || (selectedDept === 'SIG' && w.asset.includes('Point')));

  return (
    <div style={{ padding: '28px 32px', maxWidth: '1440px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h1 style={{ fontSize: '1.55rem', fontWeight: '800', color: '#003366' }}>
            Field Engineer Maintenance Command
          </h1>
          <p style={{ fontSize: '0.85rem', color: '#64748B', marginTop: '2px' }}>
            Senior Section Engineer (P-Way, TRD & Signal) · USFD Flaw Verification, Gang Possessions & TSR Imposition
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 18px', borderRadius: '8px', border: 'none',
            background: 'linear-gradient(135deg, #003366, #0056B3)',
            color: '#FFFFFF', fontWeight: '700', fontSize: '0.85rem', cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(0,51,102,0.2)'
          }}
        >
          <Plus size={16} />
          <span>Log Field Work Order</span>
        </button>
      </div>

      {/* Department Filter Bar */}
      <div style={{ background: '#FFFFFF', border: '1px solid rgba(195,178,150,0.38)', borderRadius: '10px', padding: '12px 20px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {['ALL', 'CIVIL', 'TRD', 'SIG'].map(d => (
            <button
              key={d}
              onClick={() => setSelectedDept(d)}
              style={{
                padding: '6px 14px', borderRadius: '6px', border: '1px solid ' + (selectedDept === d ? '#003366' : 'rgba(0,51,102,0.15)'),
                background: selectedDept === d ? 'rgba(0,51,102,0.1)' : 'rgba(0,51,102,0.04)', color: '#003366', fontWeight: '700', fontSize: '0.78rem', cursor: 'pointer'
              }}
            >
              {d === 'ALL' ? 'All Departments' : d === 'CIVIL' ? 'Civil / P-Way' : d === 'TRD' ? 'Electrical / TRD' : 'Signalling & Telecom'}
            </button>
          ))}
        </div>
        <div style={{ fontSize: '0.78rem', color: '#64748B', fontFamily: 'monospace' }}>
          CP-SAT Multi-Dept Bundling: <strong style={{ color: '#059669' }}>ACTIVE</strong>
        </div>
      </div>

      {/* CP-SAT Multi-Department Bundling Opportunities */}
      <div style={{ marginBottom: '28px' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#003366', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileSpreadsheet size={18} color="#059669" />
          <span>AI Multi-Department Bundling Opportunities (CP-SAT Solver Engine)</span>
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
          {bundlingData.map(b => (
            <div key={b.bundleId} style={{ background: '#FFFFFF', border: '1px solid rgba(5,150,105,0.3)', borderRadius: '12px', padding: '18px', borderLeft: '4px solid #059669' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#003366', fontFamily: 'monospace' }}>{b.bundleId}</span>
                <span style={{ fontSize: '0.72rem', fontWeight: '800', background: '#059669', color: '#FFF', padding: '2px 8px', borderRadius: '10px' }}>
                  {b.synergyScore}% SYNERGY
                </span>
              </div>
              <div style={{ fontSize: '0.82rem', fontWeight: '700', color: '#0F172A', marginBottom: '4px' }}>{b.sectionId}</div>
              <div style={{ fontSize: '0.78rem', color: '#64748B', marginBottom: '10px' }}>Time Window: {b.timeWindow} | Saved: {b.savedHours}h</div>
              <ul style={{ fontSize: '0.78rem', color: '#334155', paddingLeft: '18px', margin: 0 }}>
                {b.tasks.map((t, idx) => (
                  <li key={idx}><strong>{t.id}:</strong> {t.desc} ({t.duration})</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Work Orders Table */}
      <div style={{ background: '#FFFFFF', border: '1px solid rgba(195,178,150,0.38)', borderRadius: '12px', padding: '20px' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#003366', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Wrench size={18} />
          <span>Prioritized Field Work Orders & Track Gang Possessions</span>
        </h2>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #CBD5E1', textAlign: 'left', color: '#475569' }}>
              <th style={{ padding: '10px' }}>Work Order ID</th>
              <th style={{ padding: '10px' }}>Asset Location</th>
              <th style={{ padding: '10px' }}>Maintenance Scope</th>
              <th style={{ padding: '10px' }}>AI Priority</th>
              <th style={{ padding: '10px' }}>Assigned Gang</th>
              <th style={{ padding: '10px' }}>Status</th>
              <th style={{ padding: '10px' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredWorkOrders.map((w) => (
              <tr key={w.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={{ padding: '12px 10px', fontWeight: '700', color: '#003366', fontFamily: 'monospace' }}>{w.id}</td>
                <td style={{ padding: '12px 10px', fontWeight: '700', color: '#0F172A' }}>{w.asset}</td>
                <td style={{ padding: '12px 10px', color: '#475569' }}>{w.type}</td>
                <td style={{ padding: '12px 10px', fontWeight: '800', color: w.priority.includes('P1') ? '#DC2626' : w.priority.includes('P2') ? '#D97706' : '#059669' }}>
                  {w.priority}
                </td>
                <td style={{ padding: '12px 10px', color: '#0056B3', fontWeight: '600' }}>{w.assignedGang}</td>
                <td style={{ padding: '12px 10px', fontWeight: '700', color: w.status.includes('COMPLETED') ? '#059669' : '#D97706' }}>
                  ● {w.status}
                </td>
                <td style={{ padding: '12px 10px' }}>
                  <button
                    onClick={() => handleStatusToggle(w.id)}
                    style={{
                      padding: '5px 10px', borderRadius: '6px', border: '1px solid rgba(5,150,105,0.3)',
                      background: 'rgba(5,150,105,0.08)', color: '#059669', fontWeight: '700', fontSize: '0.74rem', cursor: 'pointer'
                    }}
                  >
                    Update Progress
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Log Work Order Modal */}
      {modalOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '16px'
        }}>
          <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid rgba(195,178,150,0.45)', width: '100%', maxWidth: '480px', padding: '28px', boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#003366', marginBottom: '16px' }}>
              Log Field Maintenance Work Order
            </h3>

            <form onSubmit={handleCreateWorkOrder}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Asset Location / Track Segment
                </label>
                <input
                  type="text"
                  value={newAsset}
                  onChange={(e) => setNewAsset(e.target.value)}
                  placeholder="e.g. 60kg Rail Track (KM 148.2 UP)"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid rgba(195,178,150,0.45)', background: '#FAF6EE', fontSize: '0.85rem', outline: 'none' }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Maintenance Scope / USFD Action
                </label>
                <input
                  type="text"
                  value={newScope}
                  onChange={(e) => setNewScope(e.target.value)}
                  placeholder="e.g. De-stressing & Joggled Fishplate Clamping"
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid rgba(195,178,150,0.45)', background: '#FAF6EE', fontSize: '0.85rem', outline: 'none' }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Priority Level
                </label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid rgba(195,178,150,0.45)', background: '#FAF6EE', fontWeight: '700', outline: 'none' }}
                >
                  <option value="P1 Emergency">P1 Emergency (24h Repair)</option>
                  <option value="P2 Urgent">P2 Urgent (72h Possession)</option>
                  <option value="P3 Planned">P3 Planned (7d Window)</option>
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: '700', color: '#475569', textTransform: 'uppercase', marginBottom: '6px' }}>
                  Assigned Maintenance Gang
                </label>
                <select
                  value={newGang}
                  onChange={(e) => setNewGang(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1.5px solid rgba(195,178,150,0.45)', background: '#FAF6EE', fontWeight: '700', outline: 'none' }}
                >
                  <option value="Gang #4 (SSE P-Way ALJN)">Gang #4 (SSE P-Way ALJN)</option>
                  <option value="Gang #2 (SSE Signal NDLS)">Gang #2 (SSE Signal NDLS)</option>
                  <option value="Gang #7 (SSE TRD CNB)">Gang #7 (SSE TRD CNB)</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#64748B', fontWeight: '700', fontSize: '0.84rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newAsset.trim() || !newScope.trim()}
                  style={{ padding: '10px 18px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #003366, #0056B3)', color: '#FFFFFF', fontWeight: '700', fontSize: '0.84rem', cursor: newAsset.trim() && newScope.trim() ? 'pointer' : 'not-allowed' }}
                >
                  Save Work Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
