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
  const [droneModalOpen, setDroneModalOpen] = useState(false);
  const [droneDefect, setDroneDefect] = useState({
    name: 'Transverse Rail Fracture',
    confidence: '96.8%',
    severity: 'CRITICAL',
    priority: 'P1',
    location: 'NDLS-CNB UP MAIN KM 124/6',
    downtime: '2.5h'
  });

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

  const handleDroneAutoReport = (customDefect) => {
    const defect = customDefect || droneDefect;
    const newInc = {
      id: `INC-2026-DRN-${Math.floor(100 + Math.random() * 900)}`,
      type: 'Track Defect / Transverse Rail Fracture',
      summary: `[🛸 YOLOv8 Drone Optical Auto-Scan] Detected ${defect.name} (Confidence: ${defect.confidence}) at ${defect.location}. Drone Quad-04 aerial optical sensor confirms hairline rail separation. Emergency possession block requested.`,
      asset: '60kg Rail Track (KM 124.6 UP Main)',
      location: 'Section B-12 (NDLS-CNB UP KM 124/6)',
      severity: defect.severity || 'CRITICAL',
      priority: defect.priority || 'P1',
      downtime: defect.downtime || '2.5h',
      status: 'Reported',
      reportedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
      operator: '🛸 Drone Vision Sentinel (vision_defect_alert_agent.py)'
    };
    setIncidents([newInc, ...incidents]);
    setDroneModalOpen(false);
    alert(`🛸 DEFECT AUTO-REPORTED VIA DRONE FEED!\n\nIncident ID: ${newInc.id}\nDefect: ${defect.name}\nSeverity: ${newInc.severity} (${newInc.priority})\nLocation: ${newInc.location}\n\n📡 Real-Time Actions Dispatched:\n1. Emergency Possession Request sent to Divisional Control Office.\n2. Emergency Work Order queued in Maintenance PM Schedules.\n3. Manual Form Entry bypassed (Auto-Filled by YOLO AI).`);
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
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setDroneModalOpen(true)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '9px 18px', borderRadius: '8px', background: '#003366', color: '#FFFFFF',
                  fontWeight: '700', fontSize: '0.82rem', border: 'none', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,51,102,0.25)'
                }}
              >
                🛸 Scan via Drone &amp; Auto-Report
              </button>
              <button
                onClick={() => setNewIncModalOpen(true)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '9px 18px', borderRadius: '8px', background: '#FFFFFF', color: '#D9531E',
                  fontWeight: '700', fontSize: '0.82rem', border: '1px solid #FED7AA', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}
              >
                <AlertTriangle size={16} /> Manual Form
              </button>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* YOLO SENTINEL: DRONE / CAMERA COMPUTER VISION AUTO-REPORTING   */}
          {/* ══════════════════════════════════════════════════════════════ */}
          <div style={{
            background: '#FFFFFF', border: '1px solid rgba(195, 178, 150, 0.45)', borderLeft: '4px solid #059669',
            borderRadius: '12px', padding: '20px', marginBottom: '20px', boxShadow: '0 4px 16px rgba(0, 51, 102, 0.05)'
          }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(0, 86, 179, 0.12)',
                    color: '#0056B3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.25rem', flexShrink: 0
                  }}>🛸</div>
                  <div>
                    <div style={{ fontSize: '1.02rem', fontWeight: '800', color: '#003366', lineHeight: '1.25' }}>
                      YOLO Track Defect &amp; Maintenance Surveillance Sentinel
                    </div>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: '#64748B', marginTop: '2px' }}>
                      ai-models/agents/vision_defect_alert_agent.py
                    </div>
                  </div>
                </div>
                <span style={{
                  fontSize: '0.72rem', fontWeight: '700', padding: '3px 10px', borderRadius: '12px',
                  background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0', whiteSpace: 'nowrap'
                }}>
                  ● YOLOv8 ACTIVE
                </span>
              </div>

              <div style={{
                display: 'inline-block', fontSize: '0.74rem', fontWeight: '600', color: '#0056B3',
                background: 'rgba(0, 86, 179, 0.08)', border: '1px solid rgba(0, 86, 179, 0.2)', borderRadius: '4px',
                padding: '3px 10px', marginBottom: '12px'
              }}>
                Drone Aerial Track Scan &amp; CCTV Maintenance Gang Vision Sentinel
              </div>

              <div style={{
                background: '#F0F9FF', border: '1px solid #BAE6FD', color: '#0369A1', borderRadius: '6px',
                padding: '9px 12px', fontSize: '0.76rem', marginBottom: '12px', lineHeight: '1.4'
              }}>
                <strong style={{ color: '#0F172A', display: 'block', fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '2px' }}>
                  AI/ML METHOD:
                </strong>
                YOLO Anchor-Free Real-Time Object Detection &amp; Spatial Tracking (mAP@0.5: 94.8%)
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '12px', textAlign: 'center' }}>
                <div style={{ background: '#FAF6EE', border: '1px solid rgba(195, 178, 150, 0.35)', borderRadius: '6px', padding: '8px 6px' }}>
                  <div style={{ fontSize: '0.65rem', color: '#64748B', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>INFERENCE</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.95rem', fontWeight: '800', color: '#0284C7', marginTop: '2px' }}>18.5 ms</div>
                </div>
                <div style={{ background: '#FAF6EE', border: '1px solid rgba(195, 178, 150, 0.35)', borderRadius: '6px', padding: '8px 6px' }}>
                  <div style={{ fontSize: '0.65rem', color: '#64748B', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>PRECISION</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.95rem', fontWeight: '800', color: '#059669', marginTop: '2px' }}>96.2%</div>
                </div>
                <div style={{ background: '#FAF6EE', border: '1px solid rgba(195, 178, 150, 0.35)', borderRadius: '6px', padding: '8px 6px' }}>
                  <div style={{ fontSize: '0.65rem', color: '#64748B', textTransform: 'uppercase', fontWeight: '700', letterSpacing: '0.5px' }}>MAP@0.5</div>
                  <div style={{ fontFamily: 'monospace', fontSize: '0.95rem', fontWeight: '800', color: '#003366', marginTop: '2px' }}>0.948</div>
                </div>
              </div>

              <div style={{
                background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '6px', padding: '7px 12px',
                fontSize: '0.74rem', color: '#065F46', marginTop: '8px', marginBottom: '10px', fontWeight: '700',
                display: 'flex', alignItems: 'center', gap: '8px'
              }}>
                <span>🟢</span> <span><strong>SURVEILLANCE HUD READY:</strong> 7 Personnel Detected &bull; 65% Work Progress</span>
              </div>

              <div style={{
                fontSize: '0.76rem', color: '#475569', lineHeight: '1.45', marginBottom: '14px',
                borderLeft: '3px solid rgba(195, 178, 150, 0.6)', paddingLeft: '10px', fontStyle: 'italic'
              }}>
                "Detects transverse rail fractures, missing fasteners, active maintenance gangs, and mandatory line-closed boards via high-speed drone &amp; CCTV feeds."
              </div>
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
              paddingTop: '14px', borderTop: '1px solid rgba(195, 178, 150, 0.25)', flexWrap: 'wrap'
            }}>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  onClick={() => setDroneModalOpen(true)}
                  style={{
                    background: 'linear-gradient(135deg, #059669 0%, #10B981 100%)', color: '#FFFFFF', border: 'none',
                    fontWeight: '700', fontSize: '0.78rem', padding: '7px 14px', borderRadius: '6px', cursor: 'pointer',
                    boxShadow: '0 2px 10px rgba(16, 185, 129, 0.4)', display: 'inline-flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <Camera size={14} /> Open Camera &amp; Start Auto-Scan
                </button>
                <button
                  onClick={() => setDroneModalOpen(true)}
                  style={{
                    background: '#003366', color: '#FFFFFF', border: 'none', fontWeight: '700',
                    fontSize: '0.78rem', padding: '7px 14px', borderRadius: '6px', cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,51,102,0.25)', display: 'inline-flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <span>🛸</span> Drone Feed
                </button>
                <button
                  onClick={() => handleDroneAutoReport()}
                  style={{
                    background: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)', color: '#FFFFFF', border: 'none',
                    fontWeight: '800', fontSize: '0.78rem', padding: '7px 14px', borderRadius: '6px', cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(220,38,38,0.3)', display: 'inline-flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <span>⚡</span> 1-Click Auto-Report via Drone
                </button>
                <button
                  onClick={() => alert("⚡ YOLOv8 Transfer Retraining Triggered!\n\nDataset: 12,480 Indian Railways Track Defect Images.")}
                  style={{
                    background: '#FAF6EE', border: '1px solid rgba(0, 51, 102, 0.3)', color: '#003366',
                    fontSize: '0.78rem', fontWeight: '700', padding: '7px 14px', borderRadius: '6px', cursor: 'pointer'
                  }}
                >
                  <span>⚡</span> Retrain YOLO
                </button>
              </div>
              <span style={{ fontSize: '0.70rem', fontFamily: 'monospace', color: '#94A3B8', fontWeight: '600' }}>
                v2.0.0 &bull; YOLOv8
              </span>
            </div>
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

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODAL: DRONE LIVE FEED & AUTO-REPORT                          */}
      {/* ───────────────────────────────────────────────────────────── */}
      {droneModalOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: '16px' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '16px', border: '1px solid rgba(0, 51, 102, 0.2)', width: '100%', maxWidth: '780px', maxHeight: '92vh', overflowY: 'auto', padding: '24px', boxShadow: '0 25px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid #E2E8F0', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.4rem' }}>🛸</span>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: '#003366', margin: 0 }}>
                    Drone Aerial Track Scan &amp; Auto-Report Feed
                  </h3>
                  <div style={{ fontSize: '0.74rem', color: '#64748B', fontFamily: 'monospace' }}>
                    DRONE-AERIAL-QUAD-04 // 4K HIGH SPEED OPTICAL &bull; NDLS-CNB UP MAIN KM 124/6
                  </div>
                </div>
              </div>
              <button
                onClick={() => setDroneModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.4rem', color: '#64748B', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            {/* Viewport with Defect Overlay */}
            <div style={{ position: 'relative', height: '320px', borderRadius: '10px', overflow: 'hidden', background: '#0F172A', marginBottom: '16px', border: '1.5px solid #003366' }}>
              <img
                src="../assets/drone_rail_inspection.jpg"
                alt="Drone Feed"
                style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }}
                onError={(e) => { e.target.src = 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&auto=format&fit=crop&q=80'; }}
              />

              {/* Bounding Box Simulation */}
              <div style={{
                position: 'absolute', top: '25%', left: '30%', width: '40%', height: '45%',
                border: '2.5px solid #EF4444', borderRadius: '4px', boxShadow: '0 0 14px rgba(239, 68, 68, 0.6)',
                pointerEvents: 'none'
              }}>
                <span style={{
                  position: 'absolute', top: '-22px', left: '-2px', background: '#EF4444', color: '#FFF',
                  fontSize: '0.70rem', fontWeight: '800', padding: '2px 8px', borderRadius: '3px'
                }}>
                  Transverse Rail Fracture (96.8%)
                </span>
              </div>

              {/* HUD Badge */}
              <div style={{ position: 'absolute', top: '12px', left: '12px', display: 'flex', gap: '8px' }}>
                <span style={{ background: 'rgba(220, 38, 38, 0.85)', color: '#FFF', padding: '3px 8px', borderRadius: '4px', fontSize: '0.70rem', fontWeight: '800' }}>
                  ● LIVE REC
                </span>
                <span style={{ background: 'rgba(15, 23, 42, 0.85)', color: '#38BDF8', padding: '3px 10px', borderRadius: '4px', fontSize: '0.70rem', fontWeight: '700', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                  YOLOv8 DETECT ACTIVE
                </span>
              </div>
            </div>

            {/* AI Detected Defect Dossier */}
            <div style={{ background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: '10px', padding: '14px', marginBottom: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <strong style={{ color: '#DC2626', fontSize: '0.88rem' }}>
                  🚨 AI-Verified Track Anomaly (Immediate Possession Block Mandated)
                </strong>
                <span style={{ background: '#DC2626', color: '#FFF', fontSize: '0.70rem', fontWeight: '800', padding: '2px 8px', borderRadius: '4px' }}>
                  CRITICAL (P1)
                </span>
              </div>
              <div style={{ fontSize: '0.80rem', color: '#334155', lineHeight: '1.5' }}>
                <strong>Detected Defect:</strong> Transverse Rail Fracture (14mm Depth Break)<br />
                <strong>Corridor Location:</strong> NDLS-CNB UP MAIN KM 124/6 (Section B-12)<br />
                <strong>Recommended Block:</strong> 2.5 Hours Emergency Possession<br />
                <strong>Statutory Standard:</strong> IRPWM Para 268 Mandatory Speed Restriction / Block
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ fontSize: '0.74rem', color: '#64748B' }}>
                ⚡ Auto-fills all report parameters &amp; transmits emergency notice to Control Office.
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => setDroneModalOpen(false)}
                  style={{ padding: '9px 18px', borderRadius: '8px', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#64748B', fontWeight: '700', fontSize: '0.82rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDroneAutoReport()}
                  style={{
                    padding: '9px 22px', borderRadius: '8px', border: 'none',
                    background: 'linear-gradient(135deg, #DC2626, #B91C1C)', color: '#FFFFFF',
                    fontWeight: '800', fontSize: '0.84rem', cursor: 'pointer',
                    boxShadow: '0 3px 12px rgba(220, 38, 38, 0.35)', display: 'inline-flex', alignItems: 'center', gap: '6px'
                  }}
                >
                  <span>🛸</span> 1-Click Auto-Report via Drone
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
