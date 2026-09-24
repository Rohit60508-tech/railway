/**
 * frontend/components/shared-live-sync.js
 * ─────────────────────────────────────────────────────────────────────────────
 * UNIVERSAL REAL-TIME DATA SYNC SERVICE & CROSS-DASHBOARD EVENT BROADCASTER
 *
 * Synchronizes:
 *   1. Safety Incident Reports (Surveillance ➔ Control Office ➔ Maintenance)
 *   2. Emergency Corridor Block Requests (Auto-generated from Incidents for Control Office)
 *   3. Maintenance Schedules & Emergency Work Orders (PM Schedules & Maintenance Cell)
 *   4. Post-Maintenance Inspections & QA Verification (Approve / Pass / Fail / Re-evaluate)
 *   5. Live Train Traffic, Conflicts & Immutable Audit Trails
 * ─────────────────────────────────────────────────────────────────────────────
 */

(function () {
  'use strict';

  const STORAGE_KEYS = {
    INCIDENTS: 'rp_shared_incidents',
    EMERGENCY_BLOCKS: 'rp_emergency_block_requests',
    PM_SCHEDULES: 'rp_pm_schedules',
    INSPECTIONS: 'rp_inspection_reports',
    WORK_ORDERS: 'rp_accepted_work_orders_map',
    LAST_SYNC: 'rp_last_sync_timestamp'
  };

  const DEFAULT_INCIDENTS = [
    {
      id: "INC-2026-041",
      type: "Rail Flaw / Transverse Crack",
      summary: "14mm internal ultrasonic crack detected at KM 124/6 UP Main during USFD run.",
      asset: "60kg Rail Track (KM 124.6 UP Main)",
      location: "NDLS-CNB-UP (New Delhi - Kanpur)",
      severity: "Critical",
      priority: "Critical (P1)",
      downtime: "2.5h",
      downtimeMins: 150,
      discipline: "Track (TMS)",
      status: "Reported",
      blockStatus: "PENDING_CONTROL_SANCTION",
      reportedAt: "2026-09-23 14:35",
      operator: "Priya Verma (USFD Inspector)"
    },
    {
      id: "INC-2026-039",
      type: "OHE Wire Drop / Sag",
      summary: "25kV catenary feeder jumper clamp overheating at 142°C detected by thermal drone.",
      asset: "25kV OHE Catenary Mast #48/12",
      location: "GZB-ALJN (Ghaziabad - Aligarh)",
      severity: "High",
      priority: "High (P2)",
      downtime: "1.5h",
      downtimeMins: 90,
      discipline: "Traction (TRD)",
      status: "Under Investigation",
      blockStatus: "PENDING_CONTROL_SANCTION",
      reportedAt: "2026-09-22 11:20",
      operator: "S. K. Verma (SSE TRD)"
    },
    {
      id: "INC-2026-035",
      type: "Point Machine Throw Drift",
      summary: "Switch throw timeout exceeded 5.0s during express route setting.",
      asset: "Turnout Switch Point Machine #PM-04",
      location: "CSMT-KYN (Mumbai Central - Kalyan)",
      severity: "Medium",
      priority: "Medium (P3)",
      downtime: "0.5h",
      downtimeMins: 30,
      discipline: "Signal (SMMS)",
      status: "Reported",
      blockStatus: "PENDING_CONTROL_SANCTION",
      reportedAt: "2026-09-20 08:45",
      operator: "Amit Deshmukh (SSE Signal)"
    }
  ];

  const DEFAULT_INSPECTIONS = [
    {
      id: "INSP-USFD-2026-801",
      workOrderId: "WO-CIVIL-INC-041",
      title: "USFD Rail Ultrasonic Testing & Flaw Detection",
      assetSystem: "USFD Ultrasonic Car #04",
      anomaly: "INTERNAL_TRANSVERSE_FISSURE",
      dept: "Civil (P-Way)",
      section: "NDLS-CNB-UP (KM 412/18-20)",
      tech: "Priya Verma (USFD Inspector)",
      dateTime: "2026-09-23 14:30",
      score: 95.4,
      sla: "24h SLA",
      confidence: 0.99,
      result: "FAILED",
      status: "COMPLETED",
      aiRationale: "Severe internal rail fracture risk detected on 112 GMT high-speed corridor.",
      remarks: "14mm internal transverse fissure detected in rail head. 78% ultrasonic signal attenuation. IRPWM Para 6.2 strictly mandates emergency fishplating within 24 hours.",
      images: [
        { name: "USFD_Flaw_Trace_KM412.png", url: "https://images.unsplash.com/photo-1541888946425-d0fbb18f15f6?w=600&auto=format&fit=crop&q=80", caption: "A-Scan Ultrasonic Flaw Echo Trace (2.4MHz)" },
        { name: "Rail_Crack_Macro.jpg", url: "https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?w=600&auto=format&fit=crop&q=80", caption: "Macro surface crack photo at rail weld toe" }
      ]
    },
    {
      id: "INSP-TRC-2026-442",
      workOrderId: "WO-CIVIL-1002",
      title: "Track Geometry TRC-102 Recording Run",
      assetSystem: "Track Recording Car TRC-102",
      anomaly: "TWIST_AND_GAUGE_EXCEEDANCE",
      dept: "Civil (P-Way)",
      section: "GZB-ALJN-DN (KM 88/10-14)",
      tech: "Rajesh Kumar (TRC Engineer)",
      dateTime: "2026-09-22 10:15",
      score: 83.2,
      sla: "72h SLA",
      confidence: 0.94,
      result: "PASSED",
      status: "COMPLETED",
      aiRationale: "Track twist and gauge narrowing at crossover switch approach.",
      remarks: "Track gauge, cross-level, and twist parameters within IRPWM Clause 602 limits after continuous tamping block. Speed restriction lifted to 110 km/h.",
      images: [
        { name: "TRC_Graph_GZB_ALJN.png", url: "https://images.unsplash.com/photo-1517649763962-0c623266ddc0?w=600&auto=format&fit=crop&q=80", caption: "TRC Track Geometry Accelerometer Graph" }
      ]
    },
    {
      id: "INSP-DRONE-2026-109",
      workOrderId: "WO-TRD-1004",
      title: "25kV OHE Aerial LiDAR & Thermal Inspection",
      assetSystem: "AI Drone Aerial LiDAR / Thermal",
      anomaly: "OHE_THERMAL_HOTSPOT",
      dept: "Electrical (TRD)",
      section: "NDLS-GZB-UP (KM 14/2-6)",
      tech: "S. K. Verma (SSE TRD)",
      dateTime: "2026-09-21 16:45",
      score: 79.5,
      sla: "72h SLA",
      confidence: 0.91,
      result: "PASSED",
      status: "COMPLETED",
      aiRationale: "Extreme thermal overheating on main overhead catenary jumper.",
      remarks: "Catenary dropper tension normalized; thermal imaging shows connector temperature at nominal 42°C under live express train drawing 600A.",
      images: [
        { name: "OHE_Thermal_Scan.jpg", url: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&auto=format&fit=crop&q=80", caption: "Thermal Drone Infrared Mast Analysis (42°C)" }
      ]
    },
    {
      id: "INSP-PATROL-2026-031",
      workOrderId: "WO-SIG-1008",
      title: "Keyman Daily Foot Patrol & Fitting Audit",
      assetSystem: "IoT Trackman Patrol Device",
      anomaly: "ELASTIC_CLIP_MISSING_CLUSTER",
      dept: "Civil (P-Way)",
      section: "CNB-PRYJ-UP (KM 618/4)",
      tech: "Amit Deshmukh (SSE Track)",
      dateTime: "2026-09-24 09:00",
      score: 66.8,
      sla: "7d SLA",
      confidence: 0.87,
      result: "PENDING",
      status: "PENDING",
      aiRationale: "Cluster of missing Elastic Rail Clips (ERC) on bridge approach.",
      remarks: "Cluster of missing Elastic Rail Clips (ERC) on bridge approach detected by foot patrol GPS device. Pending field gang replacement and sign-off.",
      images: []
    }
  ];

  class UniversalLiveSync {
    constructor() {
      this.listeners = new Map();
      this.pollIntervalMs = 4000;
      this.timer = null;
      this.lastTrainCount = 0;
      this.lastConflictCount = 0;
      this.channel = null;

      try {
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          this.channel = new BroadcastChannel('rp_railway_sync_channel');
          this.channel.onmessage = (e) => {
            if (e.data && e.data.event) {
              this.emit(e.data.event, e.data.payload);
            }
          };
        }
      } catch (_) { }

      // Listen to cross-tab localStorage events
      if (typeof window !== 'undefined') {
        window.addEventListener('storage', (e) => {
          if (e.key === STORAGE_KEYS.INCIDENTS || e.key === STORAGE_KEYS.EMERGENCY_BLOCKS || e.key === STORAGE_KEYS.PM_SCHEDULES || e.key === STORAGE_KEYS.INSPECTIONS) {
            this.emit('incidents_updated', this.getIncidents());
            this.emit('schedules_updated', this.getSchedules());
            this.emit('emergency_blocks_updated', this.getEmergencyBlockRequests());
            this.emit('inspections_updated', this.getInspections());
          }
        });
      }

      this.init();
    }

    init() {
      // Ensure seed data initialized
      this.getIncidents();
      this.getInspections();
      this.startPolling();
    }

    on(event, callback) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      this.listeners.get(event).push(callback);
    }

    emit(event, data) {
      if (this.listeners.has(event)) {
        this.listeners.get(event).forEach(cb => {
          try { cb(data); } catch (err) { console.warn(`[Real-Time Sync] Error in listener for ${event}:`, err); }
        });
      }
    }

    broadcast(event, payload) {
      this.emit(event, payload);
      try {
        if (this.channel) {
          this.channel.postMessage({ event, payload });
        }
        localStorage.setItem(STORAGE_KEYS.LAST_SYNC, Date.now().toString());
      } catch (_) { }
    }

    // ── 1. INCIDENTS MANAGEMENT ─────────────────────────────────
    getIncidents() {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.INCIDENTS);
        if (!raw) {
          localStorage.setItem(STORAGE_KEYS.INCIDENTS, JSON.stringify(DEFAULT_INCIDENTS));
          DEFAULT_INCIDENTS.forEach(inc => this._syncIncidentToDownstream(inc, false));
          return DEFAULT_INCIDENTS;
        }
        return JSON.parse(raw) || [];
      } catch (_) {
        return DEFAULT_INCIDENTS;
      }
    }

    reportIncident(incident) {
      const list = this.getIncidents();
      const existingIdx = list.findIndex(i => i.id === incident.id);
      if (existingIdx >= 0) {
        list[existingIdx] = incident;
      } else {
        list.unshift(incident);
      }

      try {
        localStorage.setItem(STORAGE_KEYS.INCIDENTS, JSON.stringify(list));
      } catch (_) { }

      this._syncIncidentToDownstream(incident, true);
      this.broadcast('incident_reported', incident);
      this.broadcast('incidents_updated', list);
      return incident;
    }

    _syncIncidentToDownstream(incident, shouldBroadcast = true) {
      // 1. Sync to Control Office Emergency Block Requests
      const blocks = this.getEmergencyBlockRequests();
      const blockId = `REQ-EM-${incident.id.replace('INC-', '')}`;
      const existingBlock = blocks.find(b => b.id === blockId || b.incidentId === incident.id);

      const mins = incident.downtimeMins || (parseFloat(incident.downtime) ? parseFloat(incident.downtime) * 60 : 120);
      const isCritical = (incident.severity || '').toUpperCase() === 'CRITICAL' || (incident.priority || '').includes('P1');
      const isHigh = (incident.severity || '').toUpperCase() === 'HIGH' || (incident.priority || '').includes('P2');

      const blockReq = {
        id: blockId,
        incidentId: incident.id,
        title: `🚨 Emergency Possession: ${incident.type}`,
        asset: incident.asset || 'Railway Track Section',
        location: incident.location || 'NDLS-CNB-UP',
        discipline: incident.discipline || (incident.type.includes('OHE') ? 'TRD' : (incident.type.includes('Point') || incident.type.includes('Signal') ? 'SIG' : 'CIVIL')),
        durationMinutes: mins,
        durationDisplay: `${mins} mins (${(mins/60).toFixed(1)}h)`,
        severity: incident.severity || 'Critical',
        priority: incident.priority || (isCritical ? 'P1 Emergency' : (isHigh ? 'P2 Urgent' : 'P3 Routine')),
        urgency: isCritical ? 'P1 Emergency' : (isHigh ? 'P2 Urgent' : 'P3 Routine'),
        suggestedSlot: isCritical ? 'Immediate / Next Night Shadow (02:00 - 04:30)' : 'Next Night Window (01:30 - 03:00)',
        disruptionScore: isCritical ? 92 : 78,
        disruptionRisk: 'Low Clashes with Fast Freight / 0 Express Clash',
        status: incident.blockStatus || 'PENDING_CONTROL_SANCTION',
        reportedAt: incident.reportedAt || new Date().toISOString().replace('T', ' ').slice(0, 16),
        operator: incident.operator || 'Safety Surveillance Inspector'
      };

      if (existingBlock) {
        Object.assign(existingBlock, blockReq);
      } else {
        blocks.unshift(blockReq);
      }

      try {
        localStorage.setItem(STORAGE_KEYS.EMERGENCY_BLOCKS, JSON.stringify(blocks));
      } catch (_) { }

      // 2. Sync to Maintenance Schedules (PM Schedules)
      const schedules = this.getSchedules();
      const schedId = `EM-${incident.id.replace('INC-', '')}`;
      const existingSched = schedules.find(s => s.id === schedId || s.incidentId === incident.id);

      const newSchedule = {
        id: schedId,
        incidentId: incident.id,
        title: `[EMERGENCY REPAIR] ${incident.type} — ${incident.asset}`,
        discipline: blockReq.discipline === 'TRD' ? 'Traction (TRD)' : (blockReq.discipline === 'SIG' ? 'Signal (SMMS)' : 'Track (TMS)'),
        corridor: incident.location || 'NDLS-CNB Corridor',
        frequency: 'Emergency Immediate',
        nextDate: new Date().toISOString().split('T')[0],
        block: `${mins} mins`,
        sse: incident.operator || 'SSE Emergency Quick-Response Team',
        status: 'Active (Emergency)',
        isArchived: false,
        isEmergency: true,
        priority: incident.priority
      };

      if (existingSched) {
        Object.assign(existingSched, newSchedule);
      } else {
        schedules.unshift(newSchedule);
      }

      try {
        localStorage.setItem(STORAGE_KEYS.PM_SCHEDULES, JSON.stringify(schedules));
      } catch (_) { }

      if (shouldBroadcast) {
        this.broadcast('emergency_blocks_updated', blocks);
        this.broadcast('schedules_updated', schedules);
      }
    }

    // ── 2. CONTROL OFFICE EMERGENCY BLOCKS ───────────────────────
    getEmergencyBlockRequests() {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.EMERGENCY_BLOCKS);
        return raw ? JSON.parse(raw) : [];
      } catch (_) {
        return [];
      }
    }

    sanctionEmergencyBlock(requestId, officerName = 'Divisional Section Controller') {
      const blocks = this.getEmergencyBlockRequests();
      const target = blocks.find(b => b.id === requestId || b.incidentId === requestId);
      if (!target) return null;

      target.status = 'SANCTIONED_BY_CONTROL';
      target.sanctionedAt = new Date().toISOString().replace('T', ' ').slice(0, 16);
      target.sanctionedBy = officerName;

      try {
        localStorage.setItem(STORAGE_KEYS.EMERGENCY_BLOCKS, JSON.stringify(blocks));
      } catch (_) { }

      // Update incident status
      const incidents = this.getIncidents();
      const incTarget = incidents.find(i => i.id === target.incidentId || i.id === requestId);
      if (incTarget) {
        incTarget.status = 'Block Sanctioned';
        incTarget.blockStatus = 'SANCTIONED_BY_CONTROL';
        try {
          localStorage.setItem(STORAGE_KEYS.INCIDENTS, JSON.stringify(incidents));
        } catch (_) { }
      }

      // Update PM schedule status
      const schedules = this.getSchedules();
      const schedTarget = schedules.find(s => s.incidentId === target.incidentId || s.id === `EM-${target.incidentId?.replace('INC-', '')}`);
      if (schedTarget) {
        schedTarget.status = 'Sanctioned (Ready for Gang Dispatch)';
        try {
          localStorage.setItem(STORAGE_KEYS.PM_SCHEDULES, JSON.stringify(schedules));
        } catch (_) { }
      }

      this.broadcast('emergency_block_sanctioned', target);
      this.broadcast('emergency_blocks_updated', blocks);
      this.broadcast('incidents_updated', incidents);
      this.broadcast('schedules_updated', schedules);

      return target;
    }

    // ── 3. PM SCHEDULES DATA ────────────────────────────────────
    getSchedules() {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.PM_SCHEDULES);
        if (!raw) return [];
        return JSON.parse(raw) || [];
      } catch (_) {
        return [];
      }
    }

    saveSchedules(schedules) {
      try {
        localStorage.setItem(STORAGE_KEYS.PM_SCHEDULES, JSON.stringify(schedules));
        this.broadcast('schedules_updated', schedules);
      } catch (_) { }
    }

    // ── 4. POST-MAINTENANCE INSPECTIONS & QA VERIFICATION ────────
    getInspections() {
      try {
        const raw = localStorage.getItem(STORAGE_KEYS.INSPECTIONS);
        if (!raw) {
          localStorage.setItem(STORAGE_KEYS.INSPECTIONS, JSON.stringify(DEFAULT_INSPECTIONS));
          return DEFAULT_INSPECTIONS;
        }
        let list = JSON.parse(raw);
        if (!Array.isArray(list) || list.length === 0) {
          localStorage.setItem(STORAGE_KEYS.INSPECTIONS, JSON.stringify(DEFAULT_INSPECTIONS));
          return DEFAULT_INSPECTIONS;
        }

        // Normalize / migrate any items with missing telemetry attributes
        let modified = false;
        list = list.map(item => {
          let updated = { ...item };
          if (!updated.assetSystem) {
            updated.assetSystem = (updated.dept || '').includes('Civil') 
              ? 'USFD Ultrasonic Car #04' 
              : ((updated.dept || '').includes('TRD') ? 'AI Drone Aerial LiDAR / Thermal' : 'IoT Trackman Patrol Device');
            modified = true;
          }
          if (!updated.anomaly) {
            updated.anomaly = updated.result === 'FAILED' 
              ? 'INTERNAL_TRANSVERSE_FISSURE' 
              : (updated.result === 'RE_EVALUATE' ? 'TWIST_AND_GAUGE_EXCEEDANCE' : 'POST_WORK_QA_AUDIT');
            modified = true;
          }
          if (!updated.aiRationale) {
            updated.aiRationale = updated.remarks ? updated.remarks.split('.')[0] + '.' : 'Inspection telemetry anomaly detected.';
            modified = true;
          }
          if (!updated.sla) {
            updated.sla = (updated.score >= 85 || updated.result === 'FAILED') ? '24h SLA' : ((updated.score >= 70 || updated.result === 'RE_EVALUATE') ? '72h SLA' : '7d SLA');
            modified = true;
          }
          if (typeof updated.confidence !== 'number') {
            updated.confidence = updated.score >= 85 ? 0.99 : (updated.score >= 70 ? 0.94 : 0.87);
            modified = true;
          }
          return updated;
        });

        if (modified) {
          try { localStorage.setItem(STORAGE_KEYS.INSPECTIONS, JSON.stringify(list)); } catch (_) { }
        }
        return list;
      } catch (_) {
        return DEFAULT_INSPECTIONS;
      }
    }

    saveInspections(list) {
      try {
        localStorage.setItem(STORAGE_KEYS.INSPECTIONS, JSON.stringify(list));
        this.broadcast('inspections_updated', list);
      } catch (_) { }
    }

    // Called from maintenance dashboard when a Work Order is marked as completed
    createInspectionForCompletedWorkOrder(workOrder) {
      const inspections = this.getInspections();
      const inspId = `INSP-2026-${Math.floor(1000 + Math.random() * 9000)}`;

      const newInsp = {
        id: inspId,
        workOrderId: workOrder.id || workOrder.request_id || 'WO-COMPLETED',
        title: `Post-Maintenance QA: ${workOrder.title || 'Track & OHE Maintenance Work'}`,
        dept: workOrder.department || (workOrder.dept === 'TRD' ? 'Electrical (TRD)' : (workOrder.dept === 'SIG' ? 'Signal (S&T)' : 'Civil (P-Way)')),
        section: workOrder.section || 'NDLS-CNB-UP',
        tech: workOrder.sseStaffId || workOrder.machinery || 'SSE Field Maintenance Team',
        dateTime: new Date().toISOString().replace('T', ' ').slice(0, 16),
        score: 0.0,
        result: "PENDING",
        status: "PENDING",
        remarks: `Work Order ${workOrder.id} executed and submitted by maintenance team. Ready for post-block safety & fit certification inspection.`,
        images: workOrder.images || []
      };

      // Check if already queued
      const existingIdx = inspections.findIndex(i => i.workOrderId === newInsp.workOrderId);
      if (existingIdx >= 0) {
        inspections[existingIdx] = Object.assign(inspections[existingIdx], newInsp);
      } else {
        inspections.unshift(newInsp);
      }

      this.saveInspections(inspections);
      this.broadcast('inspection_created', newInsp);
      return newInsp;
    }

    // Called when inspector conducts inspection (Approve / Pass, Fail, Re-evaluate with images)
    submitInspectionDecision(inspectionData) {
      const inspections = this.getInspections();
      const idx = inspections.findIndex(i => i.id === inspectionData.id);

      const updatedInsp = {
        id: inspectionData.id,
        workOrderId: inspectionData.workOrderId || 'WO-GENERAL',
        title: inspectionData.title,
        dept: inspectionData.dept,
        section: inspectionData.section,
        tech: inspectionData.tech,
        dateTime: new Date().toISOString().replace('T', ' ').slice(0, 16),
        score: parseFloat(inspectionData.score) || 85.0,
        result: inspectionData.result, // 'PASSED', 'FAILED', 'RE_EVALUATE'
        status: "COMPLETED",
        remarks: inspectionData.remarks || 'Inspection completed according to Indian Railways Safety Standards.',
        images: Array.isArray(inspectionData.images) ? inspectionData.images : [],
        inspectorName: inspectionData.inspectorName || 'Safety Surveillance QA Officer',
        inspectedAt: new Date().toISOString()
      };

      if (idx >= 0) {
        inspections[idx] = updatedInsp;
      } else {
        inspections.unshift(updatedInsp);
      }

      this.saveInspections(inspections);

      // If tied to an incident, update incident status
      if (inspectionData.workOrderId && inspectionData.workOrderId.includes('INC')) {
        const incidents = this.getIncidents();
        const incId = inspectionData.workOrderId.replace('WO-CIVIL-', '').replace('WO-TRD-', '').replace('WO-SIG-', '').replace('WO-EM-', '');
        const incTarget = incidents.find(i => i.id.includes(incId) || incId.includes(i.id));
        if (incTarget) {
          incTarget.status = inspectionData.result === 'PASSED' ? 'Rectified & Verified' : (inspectionData.result === 'FAILED' ? 'Defect Re-opened (Failed QA)' : 'Under Monitoring');
          try {
            localStorage.setItem(STORAGE_KEYS.INCIDENTS, JSON.stringify(incidents));
            this.broadcast('incidents_updated', incidents);
          } catch (_) { }
        }
      }

      this.broadcast('inspection_completed', updatedInsp);
      return updatedInsp;
    }

    // ── 5. BACKGROUND LIVE POLL ─────────────────────────────────
    async fetchAllLiveData() {
      try {
        const conflictRes = await fetch('/api/v1/live-conflicts').catch(() => null);
        if (conflictRes && conflictRes.ok) {
          const conflicts = await conflictRes.json();
          this.emit('conflicts_updated', conflicts);
          if (conflicts.length !== this.lastConflictCount) {
            this.lastConflictCount = conflicts.length;
            this.emit('conflict_count_changed', conflicts.length);
          }
        }

        const trafficRes = await fetch('/api/v1/agents/traffic-forecast/live').catch(() => null);
        if (trafficRes && trafficRes.ok) {
          const traffic = await trafficRes.json();
          this.emit('traffic_forecast_updated', traffic);
        }

        const statusRes = await fetch('/api/v1/supabase/status').catch(() => null);
        if (statusRes && statusRes.ok) {
          const status = await statusRes.json();
          this.emit('database_status_updated', status);
        }
      } catch (e) {
        console.warn('⚡ [Real-Time Sync] Background poll error:', e);
      }
    }

    startPolling() {
      if (this.timer) clearInterval(this.timer);
      this.fetchAllLiveData();
      this.timer = setInterval(() => this.fetchAllLiveData(), this.pollIntervalMs);
    }

    stopPolling() {
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    }
  }

  window.IR_LIVE_SYNC = new UniversalLiveSync();
})();
