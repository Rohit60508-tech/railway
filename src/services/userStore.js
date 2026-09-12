/**
 * userStore.js
 * Account store & role verification service for Indian Railways AI Command Platform.
 */

export const ROLES_CATALOG = [
  {
    key: 'admin',
    label: 'Executive / Admin',
    icon: '🛡️',
    color: '#003366',
    dept: 'Chief Controller & Executive Admin · DOM',
    tags: ['Full System Command', 'AI Model Retraining', 'Corridor Overrides'],
    desc: 'Administrative authority to govern safety thresholds, retrain models, manage user access, and oversee all corridors.'
  },
  {
    key: 'field-engineer',
    label: 'Field Engineer',
    icon: '🔧',
    color: '#D97706',
    dept: 'Senior Section Engineer (P-Way, TRD & Signal)',
    tags: ['Maintenance Work Orders', 'Track Possessions', 'TSR Imposition'],
    desc: 'Execute field maintenance, log ultrasonic USFD flaw verifications, manage track gang possessions, and record physical asset conditions.'
  },
  {
    key: 'control-office',
    label: 'Control Office Controller',
    icon: '🎛️',
    color: '#0056B3',
    dept: 'Section Controller · Traffic & Operations',
    tags: ['Train Tracking', 'Headway Clearance', 'Power Block Coordination'],
    desc: 'Manage live corridor train traffic, grant traction power isolation blocks, and resolve real-time headway schedule conflicts.'
  },
  {
    key: 'surveillance',
    label: 'Surveillance Inspector',
    icon: '📡',
    color: '#059669',
    dept: 'Track Safety & Telemetry Specialist',
    tags: ['Drone Line Scans', 'USFD Telemetry', 'OMS Oscillations'],
    desc: 'Monitor automated machine vision alerts, inspect drone RGB scan anomalies, and evaluate track dynamic oscillation telemetry.'
  }
];

export const ACCOUNTS = [
  { id: 'usr-001', username: 'admin', passwordHash: 'Admin@123', name: 'Chief Controller & Executive Admin', role: 'admin', division: 'DLI / Northern Railway', active: true },
  { id: 'usr-002', username: 'engineer1', passwordHash: 'Eng@456', name: 'Rajesh Kumar (SSE / P-Way)', role: 'field-engineer', division: 'DLI / Northern Railway', active: true },
  { id: 'usr-003', username: 'controller1', passwordHash: 'Ctrl@789', name: 'Anil Sharma (Section Controller)', role: 'control-office', division: 'NDLS Corridor', active: true },
  { id: 'usr-004', username: 'inspector1', passwordHash: 'Insp@321', name: 'Priya Verma (Safety & Telemetry Inspector)', role: 'surveillance', division: 'Northern Zone', active: true }
];

export function findByUsername(username) {
  if (!username) return null;
  return ACCOUNTS.find(a => a.username.toLowerCase() === username.trim().toLowerCase()) || null;
}

export function authenticate(username, password) {
  const user = findByUsername(username);
  if (!user || user.passwordHash !== password) return null;
  return user;
}
