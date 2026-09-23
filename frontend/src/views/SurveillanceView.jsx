import React, { useState, useEffect } from 'react';
import { API } from '../services/apiClient';
import LiveTelemetryOscillometerPlayer from '../components/LiveTelemetryOscillometerPlayer';
import { Radio, Eye, Activity, Camera, AlertCircle, CheckCircle, ShieldAlert, Plus, Search, Filter, Calendar, MapPin, Clock, DollarSign, User, AlertTriangle } from 'lucide-react';

export default function SurveillanceView({ initialSubTab }) {
  const [activeTab, setActiveTab] = useState(() => {
    const hash = window.location.hash.replace('#', '').trim();
    if (hash === 'inspections' || hash === 'incidents' || hash === 'telemetry') return hash;
    return initialSubTab || 'telemetry';
  });

  useEffect(() => {
    if (initialSubTab) {
      setActiveTab(initialSubTab);
    }
  }, [initialSubTab]);

  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.replace('#', '').trim();
      if (hash === 'inspections' || hash === 'incidents' || hash === 'telemetry') {
        setActiveTab(hash);
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Live Telemetry Alerts
  const [alerts, setAlerts] = useState([
    { id: 'ALT-101', sensor: 'Drone RGB Vision Scanner #04', location: 'KM 142.4 UP', defect: 'Missing Elastic Rail Clip (ERC)', confidence: '96.8%', status: 'UNVERIFIED', severity: 'CRITICAL' },
    { id: 'ALT-102', sensor: 'OMS Track Oscillometer #12', location: 'KM 188.1 DOWN', defect: 'Vertical Peak Acceleration >0.25g', confidence: '94.2%', status: 'CONFIRMED', severity: 'URGENT' },
    { id: 'ALT-103', sensor: 'USFD Telemetry Rig #02', location: 'KM 210.5 UP', defect: 'Transverse Internal Fissure', confidence: '98.1%', status: 'VERIFIED (IMR)', severity: 'EMERGENCY P1' }
  ]);

  // Inspection Reports State
  const [inspections, setInspections] = useState([
    { id: 'INSP-2026-089', title: 'TRC Track Geometry Verification', asset: 'Track Segment KM 142-148 UP', location: 'Section B-12 (NDLS-CNB)', department: 'P-Way Maintenance', method: 'Track Recording Car (TRC)', technician: 'Vikram Joshi (SSE/P-Way)', date: '2026-09-22', status: 'Completed', result: 'Passed', score: 92 },
    { id: 'INSP-2026-090', title: 'USFD Ultrasonic Flaw Detection Run', asset: 'Switch & Crossing Turnout #14', location: 'KM 188.4 Yard Lead', department: 'Civil Track Safety', method: 'Handheld USFD Transducer', technician: 'Rajesh Sharma (SSE/USFD)', date: '2026-09-23', status: 'Completed', result: 'Failed', score: 58 },
    { id: 'INSP-2026-091', title: 'OHE Catenary & Stagger Laser Scan', asset: 'OHE Mast 210/12 to 210/28', location: 'Section D-04 (GZB Junction)', department: 'Electrical (TRD)', method: 'Drone Thermal LiDAR', technician: 'Pooja Verma (JE/TRD)', date: '2026-09-23', status: 'Completed', result: 'Passed', score: 97 },
    { id: 'INSP-2026-092', title: 'Point Machine Locking & Clearance', asset: 'Point Machine PM-104A', location: 'Junction East Outer', department: 'Signalling & Telecom (S&T)', method: 'Visual & Torque Meter', technician: 'Amitabh Sen (SSE/Signal)', date: '2026-09-24', status: 'Pending', result: 'Pending', score: 0 },
  ]);
  const [inspSearch, setInspSearch] = useState('');
  const [inspStatusFilter, setInspStatusFilter] = useState('ALL');
  const [newInspModalOpen, setNewInspModalOpen] = useState(false);
  const [newInspForm, setNewInspForm] = useState({
    title: '',
    department: 'Civil / P-Way Track Safety',
    section: 'Section B-12 (NDLS-CNB Corridor)',
    technician: 'Vikram Joshi (SSE / P-Way)',
    method: 'TRC Run'
  });

  // Incident Reports State
  const [incidents, setIncidents] = useState([
    { id: 'INC-2026-041', type: 'Track Defect / Severe Gauge Spread', summary: 'Dynamic gauge widened beyond 1682mm under express load', asset: 'Track Segment KM 142.4 UP', location: 'Section B-12 (NDLS-CNB)', severity: 'CRITICAL', priority: 'P1', downtime: '2.5h', status: 'Under Investigation', reportedAt: '2026-09-23 08:30', operator: 'Vikram Joshi (SSE/P-Way)' },
    { id: 'INC-2026-042', type: 'OHE Flashover & Power Trip', summary: 'Foreign object contact with catenary wire causing feeder circuit breaker trip', asset: 'OHE Mast 210/14', location: 'KM 210.5 UP (GZB Yard)', severity: 'HIGH', priority: 'P2', downtime: '0.8h', status: 'Action In Progress', reportedAt: '2026-09-23 11:15', operator: 'Pooja Verma (JE/TRD)' },
    { id: 'INC-2026-043', type: 'Signal Blanking / Cable Fault', summary: 'Intermittent signal blanking observed on Home Signal 12-H', asset: 'Home Signal S-12H', location: 'Junction Cabin A', severity: 'MEDIUM', priority: 'P3', downtime: '0.4h', status: 'Resolved', reportedAt: '2026-09-22 17:40', operator: 'Amitabh Sen (SSE/Signal)' },
  ]);
  const [incSearch, setIncSearch] = useState('');
  const [incSevFilter, setIncSevFilter] = useState('ALL');
  const [newIncModalOpen, setNewIncModalOpen] = useState(false);
  const [newIncForm, setNewIncForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    time: new Date().toTimeString().slice(0, 5),
    asset: 'Track Segment KM 142.4 UP',
    location: 'Section B-12 (NDLS-CNB)',
    type: 'Track Geometry / Rail Flaw',
    severity: 'HIGH',
    priority: 'P1',
    status: 'Reported',
    weather: 'Clear',
    cost: '50000',
    downtime: '1.5',
    operator: 'Rajesh Sharma (SSE/USFD)',
    desc: '',
    damages: '',
    comments: ''
  });

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

  const handleCreateInspection = (e) => {
    e.preventDefault();
    const newEntry = {
      id: `INSP-2026-${Math.floor(100 + Math.random() * 900)}`,
      title: newInspForm.title || 'Scheduled Infrastructure Inspection',
      asset: 'Assigned Asset Unit',
      location: newInspForm.section,
      department: newInspForm.department,
      method: newInspForm.method,
      technician: newInspForm.technician,
      date: new Date().toISOString().slice(0, 10),
      status: 'Pending',
      result: 'Pending',
      score: 0
    };
    setInspections([newEntry, ...inspections]);
    setNewInspModalOpen(false);
  };

  const handleCreateIncident = (e) => {
    e.preventDefault();
    const newEntry = {
      id: `INC-2026-${Math.floor(100 + Math.random() * 900)}`,
      type: newIncForm.type,
      summary: newIncForm.desc || 'Incident logged via Surveillance Center',
      asset: newIncForm.asset,
      location: newIncForm.location,
      severity: newIncForm.severity,
      priority: newIncForm.priority,
      downtime: `${newIncForm.downtime || 1.0}h`,
      status: 'Reported',
      reportedAt: `${newIncForm.date} ${newIncForm.time}`,
      operator: newIncForm.operator
    };
    setIncidents([newEntry, ...incidents]);
    setNewIncModalOpen(false);
  };

  // Metrics
  const totalInsp = inspections.length;
  const completedInsp = inspections.filter(i => i.status === 'Completed').length;
  const pendingInsp = inspections.filter(i => i.status === 'Pending').length;
  const passedInsp = inspections.filter(i => i.result === 'Passed').length;
  const failedInsp = inspections.filter(i => i.result === 'Failed').length;
  const completionRate = totalInsp > 0 ? Math.round((completedInsp / totalInsp) * 100) : 0;
  const passRate = completedInsp > 0 ? Math.round((passedInsp / completedInsp) * 100) : 0;
  const avgScore = completedInsp > 0 ? Math.round(inspections.filter(i => i.score > 0).reduce((acc, i) => acc + i.score, 0) / (passedInsp + failedInsp || 1)) : 0;

  const totalInc = incidents.length;
  const highCritInc = incidents.filter(i => i.severity === 'CRITICAL' || i.severity === 'HIGH').length;
  const pendingInc = incidents.filter(i => i.status !== 'Resolved').length;

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: '800', color: '#003366', margin: 0 }}>
            Surveillance & Track Inspection Hub
          </h1>
          <p style={{ fontSize: '0.85rem', color: '#64748B', margin: '3px 0 0 0' }}>
            Integrated Machine Vision Telemetry, Comprehensive Field Inspections & Incident Response
          </p>
        </div>

        {/* Sub-nav Tabs */}
        <div style={{ display: 'flex', gap: '8px', background: '#F1F5F9', padding: '4px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
          <button
            onClick={() => setActiveTab('telemetry')}
            style={{
              padding: '8px 16px', borderRadius: '8px', border: 'none',
              background: activeTab === 'telemetry' ? '#003366' : 'transparent',
              color: activeTab === 'telemetry' ? '#FFFFFF' : '#475569',
              fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.15s'
            }}
          >
            📡 Live Telemetry & GIS Feeds
          </button>
          <button
            onClick={() => setActiveTab('inspections')}
            style={{
              padding: '8px 16px', borderRadius: '8px', border: 'none',
              background: activeTab === 'inspections' ? '#003366' : 'transparent',
              color: activeTab === 'inspections' ? '#FFFFFF' : '#475569',
              fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.15s'
            }}
          >
            📋 Inspection Reports ({totalInsp})
          </button>
          <button
            onClick={() => setActiveTab('incidents')}
            style={{
              padding: '8px 16px', borderRadius: '8px', border: 'none',
              background: activeTab === 'incidents' ? '#003366' : 'transparent',
              color: activeTab === 'incidents' ? '#FFFFFF' : '#475569',
              fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.15s'
            }}
          >
            🚨 Incident Reports ({totalInc})
          </button>
        </div>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 1: LIVE TELEMETRY & GIS FEEDS                             */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'telemetry' && (
        <div>
          <LiveTelemetryOscillometerPlayer />

          <div style={{ background: '#FFFFFF', border: '1px solid rgba(195,178,150,0.38)', borderRadius: '12px', padding: '20px', marginTop: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
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
                        onClick={() => { setActiveAlert(a); setInspectModalOpen(true); }}
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
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 2: INSPECTION REPORTS HUB                                 */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'inspections' && (
        <div>
          {/* Header Action Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#003366', margin: 0 }}>Inspection Reports Hub</h2>
              <p style={{ fontSize: '0.80rem', color: '#64748B', margin: 0 }}>Track statutory IRPWM and safety inspection audits</p>
            </div>
            <button
              onClick={() => setNewInspModalOpen(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '9px 18px', borderRadius: '8px', background: '#003366', color: '#FFFFFF',
                fontWeight: '700', fontSize: '0.82rem', border: 'none', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,51,102,0.2)'
              }}
            >
              <Plus size={16} /> New Inspection
            </button>
          </div>

          {/* 6 Metric KPI Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '14px', borderLeft: '4px solid #0056B3' }}>
              <div style={{ fontSize: '0.70rem', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Total Inspections</div>
              <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#003366', marginTop: '2px' }}>{totalInsp}</div>
            </div>
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '14px', borderLeft: '4px solid #059669' }}>
              <div style={{ fontSize: '0.70rem', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Completed</div>
              <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#059669', marginTop: '2px' }}>{completedInsp}</div>
            </div>
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '14px', borderLeft: '4px solid #D97706' }}>
              <div style={{ fontSize: '0.70rem', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Pending</div>
              <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#D97706', marginTop: '2px' }}>{pendingInsp}</div>
            </div>
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '14px', borderLeft: '4px solid #059669' }}>
              <div style={{ fontSize: '0.70rem', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Passed</div>
              <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#059669', marginTop: '2px' }}>{passedInsp}</div>
            </div>
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '14px', borderLeft: '4px solid #DC2626' }}>
              <div style={{ fontSize: '0.70rem', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Failed</div>
              <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#DC2626', marginTop: '2px' }}>{failedInsp}</div>
            </div>
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '14px', borderLeft: '4px solid #D9531E' }}>
              <div style={{ fontSize: '0.70rem', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Overdue</div>
              <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#D9531E', marginTop: '2px' }}>0</div>
            </div>
          </div>

          {/* 3 Rate Progress Meters */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: '700', color: '#003366', fontSize: '0.86rem' }}>🎯 Completion Rate</span>
                <strong style={{ fontSize: '1.2rem', color: '#003366' }}>{completionRate}%</strong>
              </div>
              <div style={{ height: '7px', background: '#F1F5F9', borderRadius: '4px', margin: '8px 0', overflow: 'hidden' }}>
                <div style={{ width: `${completionRate}%`, height: '100%', background: '#0056B3', borderRadius: '4px' }} />
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748B' }}>{completedInsp} of {totalInsp} inspections completed</div>
            </div>

            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: '700', color: '#059669', fontSize: '0.86rem' }}>🛡️ Pass Rate</span>
                <strong style={{ fontSize: '1.2rem', color: '#059669' }}>{passRate}%</strong>
              </div>
              <div style={{ height: '7px', background: '#F1F5F9', borderRadius: '4px', margin: '8px 0', overflow: 'hidden' }}>
                <div style={{ width: `${passRate}%`, height: '100%', background: '#059669', borderRadius: '4px' }} />
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748B' }}>{passedInsp} of {completedInsp} completed passed</div>
            </div>

            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: '700', color: '#6B21A8', fontSize: '0.86rem' }}>📊 Average Score</span>
                <strong style={{ fontSize: '1.2rem', color: '#6B21A8' }}>{avgScore}</strong>
              </div>
              <div style={{ height: '7px', background: '#F1F5F9', borderRadius: '4px', margin: '8px 0', overflow: 'hidden' }}>
                <div style={{ width: `${avgScore}%`, height: '100%', background: '#8B5CF6', borderRadius: '4px' }} />
              </div>
              <div style={{ fontSize: '0.72rem', color: '#64748B' }}>Average score across all completed audits</div>
            </div>
          </div>

          {/* Table Container */}
          <div style={{ background: '#FFFFFF', border: '1px solid rgba(195,178,150,0.4)', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ position: 'relative', width: '280px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                <input
                  type="text"
                  placeholder="Search inspections..."
                  value={inspSearch}
                  onChange={e => setInspSearch(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px 7px 30px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.80rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                {['ALL', 'Completed', 'Pending'].map(status => (
                  <button
                    key={status}
                    onClick={() => setInspStatusFilter(status)}
                    style={{
                      padding: '5px 12px', borderRadius: '6px', border: '1px solid #CBD5E1',
                      background: inspStatusFilter === status ? '#003366' : '#FFFFFF',
                      color: inspStatusFilter === status ? '#FFFFFF' : '#475569',
                      fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer'
                    }}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: '980px', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0', textAlign: 'left', color: '#475569' }}>
                    <th style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>Inspection ID</th>
                    <th style={{ padding: '10px 14px', minWidth: '220px' }}>Title & Asset</th>
                    <th style={{ padding: '10px 14px', minWidth: '180px' }}>Location / Section</th>
                    <th style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>Method</th>
                    <th style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>Technician</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>Status</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>Result / Score</th>
                  </tr>
                </thead>
                <tbody>
                  {inspections
                    .filter(i => (inspStatusFilter === 'ALL' || i.status === inspStatusFilter) &&
                      (i.title.toLowerCase().includes(inspSearch.toLowerCase()) || i.id.toLowerCase().includes(inspSearch.toLowerCase()) || i.asset.toLowerCase().includes(inspSearch.toLowerCase())))
                    .map(i => (
                      <tr key={i.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '12px 14px', fontWeight: '700', color: '#003366', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{i.id}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontWeight: '700', color: '#0F172A' }}>${i.title}</div>
                          <div style={{ fontSize: '0.72rem', color: '#64748B' }}>{i.asset}</div>
                        </td>
                        <td style={{ padding: '12px 14px', color: '#475569' }}>{i.location}</td>
                        <td style={{ padding: '12px 14px', color: '#0056B3', fontWeight: '600', whiteSpace: 'nowrap' }}>{i.method}</td>
                        <td style={{ padding: '12px 14px', color: '#334155', whiteSpace: 'nowrap' }}>{i.technician}</td>
                        <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <span style={{
                            padding: '3px 10px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: '700', whiteSpace: 'nowrap', display: 'inline-block',
                            background: i.status === 'Completed' ? '#ECFDF5' : '#FFFBEB',
                            color: i.status === 'Completed' ? '#059669' : '#D97706',
                            border: `1px solid ${i.status === 'Completed' ? '#A7F3D0' : '#FDE68A'}`
                          }}>
                            {i.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {i.status === 'Completed' ? (
                            <span style={{
                              padding: '3px 10px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: '700', whiteSpace: 'nowrap', display: 'inline-block',
                              background: i.result === 'Passed' ? '#ECFDF5' : '#FEF2F2',
                              color: i.result === 'Passed' ? '#059669' : '#DC2626',
                              border: `1px solid ${i.result === 'Passed' ? '#A7F3D0' : '#FECACA'}`
                            }}>
                              {i.result} ({i.score} pts)
                            </span>
                          ) : (
                            <span style={{ color: '#94A3B8', fontSize: '0.75rem' }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB 3: INCIDENT REPORTS HUB                                   */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'incidents' && (
        <div>
          {/* Header Action Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#003366', margin: 0 }}>Incident Reports Hub</h2>
              <p style={{ fontSize: '0.80rem', color: '#64748B', margin: 0 }}>Log, classify, and escalate railway safety incidents and equipment failures</p>
            </div>
            <button
              onClick={() => setNewIncModalOpen(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '9px 18px', borderRadius: '8px', background: '#D9531E', color: '#FFFFFF',
                fontWeight: '700', fontSize: '0.82rem', border: 'none', cursor: 'pointer', boxShadow: '0 2px 8px rgba(217,83,30,0.25)'
              }}
            >
              <AlertTriangle size={16} /> Report New Incident
            </button>
          </div>

          {/* 5 Incident Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px', marginBottom: '16px' }}>
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '14px', borderLeft: '4px solid #0056B3' }}>
              <div style={{ fontSize: '0.70rem', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Total Incidents</div>
              <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#003366', marginTop: '2px' }}>{totalInc}</div>
            </div>
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '14px', borderLeft: '4px solid #059669' }}>
              <div style={{ fontSize: '0.70rem', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>This Month</div>
              <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#059669', marginTop: '2px' }}>{totalInc}</div>
            </div>
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '14px', borderLeft: '4px solid #DC2626' }}>
              <div style={{ fontSize: '0.70rem', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>High / Critical</div>
              <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#DC2626', marginTop: '2px' }}>{highCritInc}</div>
            </div>
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '14px', borderLeft: '4px solid #D97706' }}>
              <div style={{ fontSize: '0.70rem', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Pending Review</div>
              <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#D97706', marginTop: '2px' }}>{pendingInc}</div>
            </div>
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '14px', borderLeft: '4px solid #64748B' }}>
              <div style={{ fontSize: '0.70rem', color: '#64748B', fontWeight: '700', textTransform: 'uppercase' }}>Drafts</div>
              <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#64748B', marginTop: '2px' }}>0</div>
            </div>
          </div>

          {/* Table Container */}
          <div style={{ background: '#FFFFFF', border: '1px solid rgba(195,178,150,0.4)', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ position: 'relative', width: '280px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                <input
                  type="text"
                  placeholder="Search incidents..."
                  value={incSearch}
                  onChange={e => setIncSearch(e.target.value)}
                  style={{ width: '100%', padding: '7px 10px 7px 30px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.80rem' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM'].map(sev => (
                  <button
                    key={sev}
                    onClick={() => setIncSevFilter(sev)}
                    style={{
                      padding: '5px 12px', borderRadius: '6px', border: '1px solid #CBD5E1',
                      background: incSevFilter === sev ? '#003366' : '#FFFFFF',
                      color: incSevFilter === sev ? '#FFFFFF' : '#475569',
                      fontSize: '0.75rem', fontWeight: '700', cursor: 'pointer'
                    }}
                  >
                    {sev}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: '980px', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0', textAlign: 'left', color: '#475569' }}>
                    <th style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>Incident ID</th>
                    <th style={{ padding: '10px 14px', minWidth: '220px' }}>Type & Description</th>
                    <th style={{ padding: '10px 14px', minWidth: '200px' }}>Asset & Location</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>Severity / Priority</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>Downtime</th>
                    <th style={{ padding: '10px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>Status</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>Reported By</th>
                  </tr>
                </thead>
                <tbody>
                  {incidents
                    .filter(i => (incSevFilter === 'ALL' || i.severity === incSevFilter) &&
                      (i.type.toLowerCase().includes(incSearch.toLowerCase()) || i.summary.toLowerCase().includes(incSearch.toLowerCase()) || i.id.toLowerCase().includes(incSearch.toLowerCase())))
                    .map(i => (
                      <tr key={i.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '12px 14px', fontWeight: '700', color: '#003366', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{i.id}</td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontWeight: '700', color: '#0F172A' }}>{i.type}</div>
                          <div style={{ fontSize: '0.73rem', color: '#64748B', maxWidth: '320px' }}>{i.summary}</div>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontWeight: '600', color: '#334155' }}>{i.asset}</div>
                          <div style={{ fontSize: '0.70rem', color: '#64748B' }}>{i.location}</div>
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <span style={{
                            padding: '3px 10px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: '700', whiteSpace: 'nowrap', display: 'inline-block',
                            background: i.severity === 'CRITICAL' ? '#FEF2F2' : i.severity === 'HIGH' ? '#FFF7ED' : '#EFF6FF',
                            color: i.severity === 'CRITICAL' ? '#DC2626' : i.severity === 'HIGH' ? '#D9531E' : '#2563EB',
                            border: `1px solid ${i.severity === 'CRITICAL' ? '#FECACA' : i.severity === 'HIGH' ? '#FED7AA' : '#BFDBFE'}`
                          }}>
                            {i.severity} ({i.priority})
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: '700', color: '#D9531E', textAlign: 'center', whiteSpace: 'nowrap' }}>{i.downtime}</td>
                        <td style={{ padding: '12px 14px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <span style={{
                            padding: '3px 10px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: '700', whiteSpace: 'nowrap', display: 'inline-block',
                            background: i.status === 'Resolved' ? '#ECFDF5' : '#FFFBEB',
                            color: i.status === 'Resolved' ? '#059669' : '#D97706',
                            border: `1px solid ${i.status === 'Resolved' ? '#A7F3D0' : '#FDE68A'}`
                          }}>
                            {i.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 14px', fontSize: '0.75rem', color: '#475569', textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: '600' }}>{i.operator}</div>
                          <div style={{ fontSize: '0.68rem', color: '#94A3B8', fontFamily: 'monospace' }}>{i.reportedAt}</div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL: CREATE INSPECTION                                      */}
      {/* ───────────────────────────────────────────────────────────── */}
      {newInspModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '16px' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '16px', width: '100%', maxWidth: '520px', padding: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#003366', margin: '0 0 6px 0' }}>Create Asset Inspection</h3>
            <p style={{ fontSize: '0.80rem', color: '#64748B', margin: '0 0 16px 0' }}>Schedule a new statutory inspection for a track section or asset.</p>

            <form onSubmit={handleCreateInspection} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Inspection Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. TRC Track Geometry Verification Run"
                  value={newInspForm.title}
                  onChange={e => setNewInspForm({ ...newInspForm, title: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Department</label>
                  <select
                    value={newInspForm.department}
                    onChange={e => setNewInspForm({ ...newInspForm, department: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.82rem' }}
                  >
                    <option>Civil / P-Way Track Safety</option>
                    <option>Electrical / TRD (OHE)</option>
                    <option>Signalling & Telecom (S&T)</option>
                    <option>Mechanical (C&W / Rolling Stock)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Method</label>
                  <select
                    value={newInspForm.method}
                    onChange={e => setNewInspForm({ ...newInspForm, method: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.82rem' }}
                  >
                    <option>TRC Run</option>
                    <option>USFD Flaw Scanner</option>
                    <option>Drone LiDAR / Thermal</option>
                    <option>Foot Patrol Gauge / Cross-level</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Section / Location</label>
                <input
                  type="text"
                  value={newInspForm.section}
                  onChange={e => setNewInspForm({ ...newInspForm, section: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Assigned Technician / Officer</label>
                <input
                  type="text"
                  value={newInspForm.technician}
                  onChange={e => setNewInspForm({ ...newInspForm, technician: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setNewInspModalOpen(false)}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#64748B', fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', background: '#003366', color: '#FFFFFF', fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer' }}
                >
                  Schedule Inspection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL: REPORT NEW INCIDENT                                    */}
      {/* ───────────────────────────────────────────────────────────── */}
      {newIncModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '16px' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '16px', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', padding: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: '#003366', margin: '0 0 4px 0' }}>Report New Safety Incident</h3>
            <p style={{ fontSize: '0.80rem', color: '#64748B', margin: '0 0 16px 0' }}>Record all field observations, asset damages, and operational downtime.</p>

            <form onSubmit={handleCreateIncident} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Incident Date</label>
                  <input
                    type="date"
                    required
                    value={newIncForm.date}
                    onChange={e => setNewIncForm({ ...newIncForm, date: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Incident Time</label>
                  <input
                    type="time"
                    required
                    value={newIncForm.time}
                    onChange={e => setNewIncForm({ ...newIncForm, time: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Associated Asset</label>
                  <input
                    type="text"
                    required
                    value={newIncForm.asset}
                    onChange={e => setNewIncForm({ ...newIncForm, asset: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Location / Section</label>
                  <input
                    type="text"
                    required
                    value={newIncForm.location}
                    onChange={e => setNewIncForm({ ...newIncForm, location: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Incident Type</label>
                  <select
                    value={newIncForm.type}
                    onChange={e => setNewIncForm({ ...newIncForm, type: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.82rem' }}
                  >
                    <option>Track Geometry / Rail Flaw</option>
                    <option>OHE Power Failure</option>
                    <option>Signal & Interlocking Failure</option>
                    <option>Rolling Stock Derailment Risk</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Severity</label>
                  <select
                    value={newIncForm.severity}
                    onChange={e => setNewIncForm({ ...newIncForm, severity: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.82rem' }}
                  >
                    <option>CRITICAL</option>
                    <option>HIGH</option>
                    <option>MEDIUM</option>
                    <option>LOW</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Priority</label>
                  <select
                    value={newIncForm.priority}
                    onChange={e => setNewIncForm({ ...newIncForm, priority: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.82rem' }}
                  >
                    <option>P1 - Emergency</option>
                    <option>P2 - Urgent</option>
                    <option>P3 - Routine</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Downtime (Hours)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={newIncForm.downtime}
                    onChange={e => setNewIncForm({ ...newIncForm, downtime: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Estimated Cost (₹)</label>
                  <input
                    type="number"
                    value={newIncForm.cost}
                    onChange={e => setNewIncForm({ ...newIncForm, cost: e.target.value })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.82rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: '700', color: '#475569', marginBottom: '4px' }}>Incident Description</label>
                <textarea
                  rows="3"
                  required
                  placeholder="Detailed description of the incident, root cause, and immediate containment measures taken..."
                  value={newIncForm.desc}
                  onChange={e => setNewIncForm({ ...newIncForm, desc: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '0.82rem', boxSizing: 'border-box', fontFamily: 'inherit' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '12px' }}>
                <button
                  type="button"
                  onClick={() => setNewIncModalOpen(false)}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#64748B', fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', background: '#D9531E', color: '#FFFFFF', fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer' }}
                >
                  Report Incident
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL: RGB SCAN INSPECT                                       */}
      {/* ───────────────────────────────────────────────────────────── */}
      {inspectModalOpen && activeAlert && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '16px' }}>
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
              color: '#38BDF8', border: '1px solid #334155', marginBottom: '16px', flexDirection: 'column', gap: '8px'
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
