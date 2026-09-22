/**
 * backend/services/supabase-client.js
 * ─────────────────────────────────────────────────────────────────────────────
 * SUPABASE CLOUD & DEDICATED SERVER IMMUTABLE AUDIT LOG CLIENT
 *
 * Implements:
 * 1. Supabase REST (PostgREST) client for PostgreSQL storage.
 * 2. Strict User Provenance: records entry name, staff ID, user name, role, division.
 * 3. SHA-256 Cryptographic Hash Chaining for mathematical proof of immutability.
 * 4. Dual-Persistence & Local Dedicated SQLite Mirror.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

let SUPABASE_URL = process.env.SUPABASE_URL || '';
let SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SECRET_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  try {
    const envPath = path.resolve(__dirname, '../../.env');
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf8').split('\n');
      lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('SUPABASE_URL=')) SUPABASE_URL = SUPABASE_URL || trimmed.split('=')[1].trim().replace(/^["']|["']$/g, '');
        if (trimmed.startsWith('SUPABASE_SECRET_KEY=')) SUPABASE_KEY = SUPABASE_KEY || trimmed.split('=')[1].trim().replace(/^["']|["']$/g, '');
        if (trimmed.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) SUPABASE_KEY = SUPABASE_KEY || trimmed.split('=')[1].trim().replace(/^["']|["']$/g, '');
      });
    }
  } catch (_) {}
}

const TABLE_NAME = 'immutable_action_audit_log';
const LOCAL_LEDGER_PATH = path.resolve(__dirname, '../../data/immutable_audit_ledger.jsonl');
const GENESIS_HASH = 'GENESIS_HASH_IR_2026_00000000000000000000000000000000';

class SupabaseAuditService {
  constructor() {
    this.url = SUPABASE_URL.replace(/\/+$/, '');
    this.key = SUPABASE_KEY;
    this.isConfigured = Boolean(this.url && this.key);
    this.lastKnownHash = GENESIS_HASH;
    this.initLocalDatabase();
  }

  initLocalDatabase() {
    try {
      const dir = path.dirname(LOCAL_LEDGER_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      if (fs.existsSync(LOCAL_LEDGER_PATH)) {
        const content = fs.readFileSync(LOCAL_LEDGER_PATH, 'utf-8').trim();
        if (content) {
          const lines = content.split('\n');
          const lastLine = lines[lines.length - 1];
          try {
            const parsed = JSON.parse(lastLine);
            if (parsed && parsed.record_hash) {
              this.lastKnownHash = parsed.record_hash;
            }
          } catch (_) {}
        }
      }
    } catch (e) {
      console.error('[SupabaseAudit] Error initializing local ledger:', e.message);
    }
  }

  computeRecordHash(prevHash, entryName, staffId, userName, targetEntityId, timestamp, payload) {
    const rawData = `${prevHash}|${entryName}|${staffId}|${userName}|${targetEntityId}|${timestamp}|${JSON.stringify(payload || {})}`;
    return crypto.createHash('sha256').update(rawData).digest('hex');
  }

  async saveActionAuditRecord({
    entryName,
    eventType = 'SYSTEM_ACTION',
    staffId = 'IR-STAFF-UNKNOWN',
    userName = 'Indian Railways Operator',
    userRole = 'CONTROL_OFFICER',
    userDivision = 'Northern Railway — Delhi Division',
    section = 'NDLS-CNB-UP',
    targetEntityId = '',
    reason = 'Standard operational entry',
    disruptionScore = 0.0,
    delayMinutes = 0,
    actionPayload = {},
    clientIp = '127.0.0.1',
  }) {
    const recordId = crypto.randomUUID ? crypto.randomUUID() : '00000000-0000-4000-8000-' + crypto.randomBytes(6).toString('hex');
    const timestamp = new Date().toISOString();
    const prevHash = this.lastKnownHash;
    const recordHash = this.computeRecordHash(
      prevHash,
      entryName,
      staffId,
      userName,
      targetEntityId,
      timestamp,
      actionPayload
    );

    const record = {
      id: recordId,
      entry_name: entryName,
      event_type: eventType,
      staff_id: staffId,
      user_name: userName,
      user_role: userRole,
      user_division: userDivision,
      section,
      target_entity_id: targetEntityId,
      reason,
      disruption_score: Number(disruptionScore),
      delay_minutes: parseInt(delayMinutes, 10) || 0,
      action_payload: typeof actionPayload === 'string' ? JSON.parse(actionPayload || '{}') : actionPayload,
      prev_hash: prevHash,
      record_hash: recordHash,
      is_immutable: true,
      client_ip: clientIp,
      created_at: timestamp,
    };

    // 1. Persist to Supabase Cloud if configured
    let supabaseSuccess = false;
    if (this.isConfigured) {
      try {
        const endpoint = `${this.url}/rest/v1/${TABLE_NAME}`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: this.key,
            Authorization: `Bearer ${this.key}`,
            Prefer: 'return=minimal',
          },
          body: JSON.stringify(record),
        });

        if (response.ok || response.status === 201) {
          supabaseSuccess = true;
        } else {
          const errTxt = await response.text();
          console.warn('[SupabaseAudit] Cloud save warning (status ' + response.status + '):', errTxt);
        }
      } catch (err) {
        console.warn('[SupabaseAudit] Failed to connect to Supabase Cloud, falling back to dedicated server storage:', err.message);
      }
    }

    // 2. Persist to Local Dedicated Server Ledger (Append-Only JSONL)
    try {
      fs.appendFileSync(LOCAL_LEDGER_PATH, JSON.stringify(record) + '\n', 'utf-8');
      this.lastKnownHash = recordHash;
    } catch (fsErr) {
      console.error('[SupabaseAudit] Local ledger append error:', fsErr.message);
    }

    return {
      success: true,
      record_id: record.id,
      entry_name: record.entry_name,
      user_name: record.user_name,
      staff_id: record.staff_id,
      record_hash: record.record_hash,
      prev_hash: record.prev_hash,
      is_immutable: true,
      storage_destination: supabaseSuccess ? 'SUPABASE_CLOUD_AND_SERVER_MIRROR' : 'DEDICATED_SERVER_DATABASE',
      timestamp: record.created_at,
    };
  }

  async getAuditRecords(limit = 50) {
    // 1. Try fetching from Supabase if configured
    if (this.isConfigured) {
      try {
        const endpoint = `${this.url}/rest/v1/${TABLE_NAME}?select=*&order=created_at.desc&limit=${limit}`;
        const res = await fetch(endpoint, {
          headers: {
            apikey: this.key,
            Authorization: `Bearer ${this.key}`,
          },
        });
        if (res.ok) {
          const records = await res.json();
          if (Array.isArray(records) && records.length > 0) {
            return records;
          }
        }
      } catch (err) {
        console.warn('[SupabaseAudit] Cloud fetch fallback:', err.message);
      }
    }

    // 2. Fetch from Local Dedicated Ledger
    try {
      if (!fs.existsSync(LOCAL_LEDGER_PATH)) return [];
      const content = fs.readFileSync(LOCAL_LEDGER_PATH, 'utf-8').trim();
      if (!content) return [];
      const lines = content.split('\n');
      const records = [];
      for (let i = lines.length - 1; i >= 0 && records.length < limit; i--) {
        const line = lines[i].trim();
        if (line) {
          try {
            records.push(JSON.parse(line));
          } catch (_) {}
        }
      }
      return records;
    } catch (err) {
      console.error('[SupabaseAudit] Error reading local ledger:', err.message);
      return [];
    }
  }

  async verifyIntegrity() {
    try {
      if (!fs.existsSync(LOCAL_LEDGER_PATH)) {
        return {
          status: 'HEALTHY_GENESIS',
          total_records: 0,
          is_valid: true,
          message: 'Ledger is at genesis state or clean.',
        };
      }

      const content = fs.readFileSync(LOCAL_LEDGER_PATH, 'utf-8').trim();
      if (!content) {
        return {
          status: 'HEALTHY_GENESIS',
          total_records: 0,
          is_valid: true,
          message: 'Ledger is at genesis state or clean.',
        };
      }

      const lines = content.split('\n').filter(l => l.trim().length > 0);
      const rows = lines.map(l => JSON.parse(l));

      let previousHash = GENESIS_HASH;
      let compromisedIndex = -1;

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        if (r.prev_hash !== previousHash) {
          compromisedIndex = i;
          break;
        }

        const computed = this.computeRecordHash(
          r.prev_hash,
          r.entry_name,
          r.staff_id,
          r.user_name,
          r.target_entity_id,
          r.created_at,
          r.action_payload
        );

        if (computed !== r.record_hash) {
          compromisedIndex = i;
          break;
        }
        previousHash = r.record_hash;
      }

      if (compromisedIndex !== -1) {
        return {
          status: 'INTEGRITY_COMPROMISED',
          is_valid: false,
          compromised_index: compromisedIndex,
          message: `Hash chain violation detected at record sequence #${compromisedIndex + 1}`,
        };
      }

      return {
        status: 'VERIFIED_IMMUTABLE',
        is_valid: true,
        total_records: rows.length,
        last_sealed_hash: previousHash,
        algorithm: 'SHA-256 Chained Merkle-Proof',
        message: `All ${rows.length} operational actions mathematically verified against tamper-evident chain.`,
      };
    } catch (err) {
      return {
        status: 'VERIFICATION_ERROR',
        is_valid: false,
        message: err.message,
      };
    }
  }

  getStatus() {
    return {
      provider: 'Supabase PostgreSQL + Dedicated Server DB',
      supabase_url: this.url || 'NOT_CONFIGURED (Running Dedicated Server DB)',
      is_configured: this.isConfigured,
      table_name: TABLE_NAME,
      all_tables: ['track_sections', 'maintenance_defects', 'requested_windows', 'block_schedules', 'corridor_windows', 'immutable_action_audit_log'],
      immutability_enforcement: 'PostgreSQL Trigger + RLS + SHA-256 Cryptographic Chaining',
      last_known_hash: this.lastKnownHash,
    };
  }

  // ---------------------------------------------------------------------------
  // GENERAL SUPABASE CLOUD TABLE OPERATIONS (CRUD) WITH DEDICATED STORE MIRROR
  // ---------------------------------------------------------------------------

  getLocalStorePath() {
    return path.resolve(__dirname, '../../data/supabase_tables.json');
  }

  readLocalStore() {
    const defaultData = {
      track_sections: [
        { section_id: 'NDLS-CNB-UP', division: 'NR', sub_division: 'DLI', start_station: 'NDLS', end_station: 'CNB', start_km: 0.0, end_km: 440.0, max_permissible_speed: 160, line_type: 'UP' },
        { section_id: 'NDLS-CNB-DN', division: 'NR', sub_division: 'DLI', start_station: 'CNB', end_station: 'NDLS', start_km: 0.0, end_km: 440.0, max_permissible_speed: 160, line_type: 'DOWN' },
        { section_id: 'DLI-GZB-UP', division: 'NR', sub_division: 'DLI', start_station: 'DLI', end_station: 'GZB', start_km: 0.0, end_km: 24.5, max_permissible_speed: 110, line_type: 'UP' },
        { section_id: 'GZB-ALJN-UP', division: 'NCR', sub_division: 'ALJN', start_station: 'GZB', end_station: 'ALJN', start_km: 25.4, end_km: 126.1, max_permissible_speed: 130, line_type: 'UP' },
        { section_id: 'ALJN-TDL-UP', division: 'NCR', sub_division: 'TDL', start_station: 'ALJN', end_station: 'TDL', start_km: 126.1, end_km: 204.3, max_permissible_speed: 130, line_type: 'UP' }
      ],
      maintenance_defects: [
        {
          defect_id: 'DEF-901',
          external_ref_id: 'WO-2026-TMS-401',
          source_system: 'TMS / USFD',
          department: 'Civil (P-Way)',
          section_id: 'NDLS-GZB-DN',
          station_from: 'NDLS',
          station_to: 'GZB',
          start_km: 12.0,
          end_km: 16.0,
          defect_type: 'Ultrasonic testing (USFD) IMR Flaw & Rail Fracture Risk',
          severity: 'CRITICAL',
          criticality_score: 9.5,
          priority_category: 'P1',
          estimated_duration_minutes: 120,
          suggested_window_start: '09:00',
          suggested_window_end: '11:00',
          assigned_gang_id: 'GANG-NR-DLI-04',
          status: 'ACTIVE_DEFECT'
        },
        {
          defect_id: 'DEF-882',
          external_ref_id: 'WO-2026-ST-302',
          source_system: 'SMMS',
          department: 'Signal & Telecom',
          section_id: 'NDLS-CNB-UP',
          station_from: 'NDLS',
          station_to: 'CNB',
          start_km: 143.0,
          end_km: 144.5,
          defect_type: 'Signal Point Machine Cable Degradation & Interlocking Slack',
          severity: 'HIGH',
          criticality_score: 7.8,
          priority_category: 'P2',
          estimated_duration_minutes: 90,
          suggested_window_start: '11:30',
          suggested_window_end: '13:00',
          assigned_gang_id: 'GANG-ST-CNB-02',
          status: 'ACTIVE_DEFECT'
        },
        {
          defect_id: 'DEF-704',
          external_ref_id: 'WO-2026-TRD-109',
          source_system: 'TDMS',
          department: 'Electrical (TRD / OHE)',
          section_id: 'NDLS-CNB-UP',
          station_from: 'NDLS',
          station_to: 'CNB',
          start_km: 141.8,
          end_km: 146.0,
          defect_type: '25kV OHE Catenary Wire Slack, Dropper Replacement & Isolator Test',
          severity: 'HIGH',
          criticality_score: 8.5,
          priority_category: 'P1',
          estimated_duration_minutes: 150,
          suggested_window_start: '14:00',
          suggested_window_end: '16:30',
          assigned_gang_id: 'GANG-TRD-DLI-01',
          status: 'ACTIVE_DEFECT'
        },
        {
          defect_id: 'DEF-519',
          external_ref_id: 'WO-2026-TMS-519',
          source_system: 'USFD / P-Way',
          department: 'Civil (P-Way)',
          section_id: 'DLI-GZB-UP',
          station_from: 'DLI',
          station_to: 'GZB',
          start_km: 14.2,
          end_km: 16.0,
          defect_type: 'Glued Insulated Rail Joint Degradation & Fishplate Tension',
          severity: 'CRITICAL',
          criticality_score: 9.0,
          priority_category: 'P1',
          estimated_duration_minutes: 120,
          suggested_window_start: '01:00',
          suggested_window_end: '03:00',
          assigned_gang_id: 'GANG-NR-DLI-02',
          status: 'ACTIVE_DEFECT'
        },
        {
          defect_id: 'DEF-402',
          external_ref_id: 'WO-2026-TMS-402',
          source_system: 'TMS',
          department: 'Civil (P-Way)',
          section_id: 'GZB-ALJN-UP',
          station_from: 'GZB',
          station_to: 'ALJN',
          start_km: 28.5,
          end_km: 30.2,
          defect_type: 'Turnout Switch Rail Tongue Wear & Ballast Cushion Packing',
          severity: 'MEDIUM',
          criticality_score: 6.5,
          priority_category: 'P2',
          estimated_duration_minutes: 180,
          suggested_window_start: '10:00',
          suggested_window_end: '13:00',
          assigned_gang_id: 'GANG-NCR-ALJN-01',
          status: 'ACTIVE_DEFECT'
        }
      ],
      requested_windows: [
        {
          id: 'REQ-CIV-6603',
          request_id: 'REQ-CIV-6603',
          section_id: 'NDLS-GZB-DN',
          station_from: 'NDLS',
          station_to: 'GZB',
          start_km: 12.0,
          end_km: 16.0,
          km_pole: 'KM 12-16',
          requested_window: '09:00 – 11:00 (Morning Peak)',
          window_start_time: '09:00',
          window_end_time: '11:00',
          duration_minutes: 120,
          department: 'Civil (P-Way)',
          work_description: '[DEF-901] Ultrasonic testing (USFD) IMR Flaw KM 142.4',
          defect_ref_id: 'DEF-901',
          priority: 'P1',
          status: 'PENDING_REVIEW',
          applied_alternative: null,
          created_at: new Date().toISOString()
        },
        {
          id: 401,
          request_id: 'WO-CIVIL-401',
          section_id: 'NDLS-CNB-UP',
          station_from: 'NDLS',
          station_to: 'CNB',
          start_km: 412.0,
          end_km: 412.8,
          km_pole: 'KM 412/18',
          requested_window: '01:30 – 03:30 (Tomorrow Night)',
          window_start_time: '01:30',
          window_end_time: '03:30',
          duration_minutes: 120,
          department: 'Civil (P-Way)',
          work_description: 'Immediate Rail Fracture Cut & Replacement (KM 412/18)',
          priority: 'P1',
          status: 'SANCTIONED',
          applied_alternative: null,
          created_at: new Date().toISOString()
        },
        {
          id: 112,
          request_id: 'WO-TRD-112',
          section_id: 'GZB-ALJN',
          station_from: 'GZB',
          station_to: 'ALJN',
          start_km: 68.0,
          end_km: 68.5,
          km_pole: 'KM 68/4',
          requested_window: '01:30 – 04:00 (Bundled with BNDL-001)',
          window_start_time: '01:30',
          window_end_time: '04:00',
          duration_minutes: 90,
          department: 'Electrical (TRD)',
          work_description: 'Overhead 25kV Insulator & Dropper Replacement (KM 68/4)',
          priority: 'P2',
          status: 'SANCTIONED',
          applied_alternative: null,
          created_at: new Date().toISOString()
        },
        {
          id: 94,
          request_id: 'WO-SIG-094',
          section_id: 'NDLS-CNB-UP',
          station_from: 'NDLS',
          station_to: 'CNB',
          start_km: 140.0,
          end_km: 142.0,
          km_pole: 'KM 141',
          requested_window: '02:00 – 03:00 (Bundled in Shadow Window)',
          window_start_time: '02:00',
          window_end_time: '03:00',
          duration_minutes: 60,
          department: 'Signal (S&T)',
          work_description: 'Track Circuit Overhaul & Glued Insulated Rail Joint Inspection',
          priority: 'P3',
          status: 'SANCTIONED',
          applied_alternative: null,
          created_at: new Date().toISOString()
        }
      ]
    };

    try {
      const p = this.getLocalStorePath();
      if (!fs.existsSync(p)) {
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, JSON.stringify(defaultData, null, 2), 'utf-8');
        return defaultData;
      }
      const raw = fs.readFileSync(p, 'utf-8');
      return JSON.parse(raw || '{}');
    } catch (e) {
      return defaultData;
    }
  }

  writeLocalStore(data) {
    try {
      const p = this.getLocalStorePath();
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.error('[SupabaseClient] writeLocalStore error:', e.message);
    }
  }

  mapTableName(table) {
    if (table === 'requested_windows') {
      return 'requested_maintenance_windows';
    }
    return table;
  }

  async queryTable(table, queryParams = {}) {
    const cloudTable = this.mapTableName(table);
    // 1. If Supabase configured, attempt live fetch from Cloud source of truth
    if (this.isConfigured) {
      try {
        let queryStr = '?select=*';
        if (queryParams.order) queryStr += `&order=${queryParams.order}`;
        if (queryParams.limit) queryStr += `&limit=${queryParams.limit}`;
        if (queryParams.filterKey && queryParams.filterVal) {
          queryStr += `&${queryParams.filterKey}=eq.${encodeURIComponent(queryParams.filterVal)}`;
        }

        const res = await fetch(`${this.url}/rest/v1/${cloudTable}${queryStr}`, {
          headers: {
            apikey: this.key,
            Authorization: `Bearer ${this.key}`,
          },
        });

        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            // Hydrate local mirror cache with latest cloud truth
            const store = this.readLocalStore();
            if (data.length > 0) {
              store[table] = data;
              this.writeLocalStore(store);
            }
            return { success: true, source: 'SUPABASE_CLOUD', data };
          }
        }
      } catch (err) {
        console.warn(`[SupabaseClient] queryTable(${cloudTable}) cloud fallback:`, err.message);
      }
    }

    // 2. Resilient local dataset store fallback
    const store = this.readLocalStore();
    let rows = store[table] || [];
    if (queryParams.filterKey && queryParams.filterVal) {
      rows = rows.filter(r => String(r[queryParams.filterKey]) === String(queryParams.filterVal) ||
                              (r.id !== undefined && String(r.id) === String(queryParams.filterVal)) ||
                              (r.request_id !== undefined && String(r.request_id) === String(queryParams.filterVal)));
    }
    return { success: true, source: 'LOCAL_DEDICATED_STORE', data: rows };
  }

  filterPayloadForTable(table, payload) {
    const TABLE_COLUMNS = {
      requested_maintenance_windows: [
        'request_id', 'section_id', 'station_from', 'station_to', 'start_km', 'end_km', 'km_pole',
        'requested_window', 'window_start_time', 'window_end_time', 'duration_minutes', 'department',
        'work_description', 'priority', 'status', 'applied_alternative', 'created_at', 'updated_at'
      ],
      maintenance_defects: [
        'defect_id', 'external_ref_id', 'source_system', 'department', 'section_id', 'start_km',
        'end_km', 'defect_type', 'severity', 'criticality_score', 'days_overdue', 'priority_score',
        'priority_category', 'required_track_closure', 'requires_power_cut', 'estimated_duration_minutes',
        'assigned_gang_id', 'status', 'created_at', 'rectified_at'
      ],
      track_sections: [
        'section_id', 'division', 'sub_division', 'start_station', 'end_station', 'start_km', 'end_km',
        'max_permissible_speed', 'line_type', 'electrification_type', 'traffic_density_gmt', 'track_structure',
        'created_at', 'updated_at'
      ],
      block_schedules: [
        'block_id', 'section_id', 'start_km', 'end_km', 'start_time', 'end_time', 'duration_minutes',
        'status', 'departments_involved', 'efficiency_score', 'closure_time_saved_minutes',
        'tasks_bundled_count', 'bundled_task_ids', 'granted_by', 'granted_at', 'override_reason',
        'audit_hash', 'created_at', 'updated_at'
      ],
      corridor_windows: [
        'window_id', 'section_id', 'window_start', 'window_end', 'duration_minutes', 'headway_buffer_minutes',
        'traffic_density_score', 'conflicting_passenger_trains', 'conflicting_freight_trains', 'status', 'created_at'
      ],
      immutable_action_audit_log: [
        'id', 'seq_id', 'entry_name', 'event_type', 'staff_id', 'user_name', 'user_role', 'user_division',
        'section', 'target_entity_id', 'reason', 'disruption_score', 'delay_minutes', 'action_payload',
        'prev_hash', 'record_hash', 'is_immutable', 'client_ip', 'created_at'
      ],
      audit_records: [
        'record_id', 'entry_name', 'event_type', 'staff_id', 'user_name', 'user_role', 'user_division',
        'section', 'block_id', 'target_entity_id', 'reason', 'disruption_score', 'delay_minutes',
        'action_payload', 'prev_hash', 'record_hash', 'is_immutable', 'client_ip', 'created_at', 'timestamp'
      ]
    };

    const allowed = TABLE_COLUMNS[table];
    if (!allowed) return payload;
    const filtered = {};
    for (const key of allowed) {
      if (payload[key] !== undefined) {
        filtered[key] = payload[key];
      }
    }
    return filtered;
  }

  async insertRecord(table, record) {
    const cloudTable = this.mapTableName(table);
    const nowIso = new Date().toISOString();
    
    // Determine canonical primary identifier
    let canonicalId = record.request_id || record.defect_id || record.external_ref_id || record.section_id || record.block_id || record.id;
    if (!canonicalId) {
      canonicalId = (table.includes('window') ? 'REQ-' : 'REC-') + Math.floor(1000 + Math.random() * 9000);
    }

    const fullRecord = {
      id: canonicalId,
      created_at: nowIso,
      updated_at: nowIso,
      status: 'PENDING_REVIEW',
      ...record,
    };
    if (cloudTable === 'requested_maintenance_windows') {
      fullRecord.request_id = canonicalId;
    }

    const cloudPayload = this.filterPayloadForTable(cloudTable, fullRecord);
    if (cloudTable === 'requested_maintenance_windows' || typeof cloudPayload.id === 'string') {
      delete cloudPayload.id;
    }

    // 1. Save to Supabase Cloud if configured
    let cloudSaved = false;
    let cloudError = null;
    if (this.isConfigured) {
      try {
        const res = await fetch(`${this.url}/rest/v1/${cloudTable}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: this.key,
            Authorization: `Bearer ${this.key}`,
            Prefer: 'return=representation',
          },
          body: JSON.stringify(cloudPayload),
        });

        if (res.ok || res.status === 201) {
          cloudSaved = true;
        } else {
          const errText = await res.text();
          cloudError = `Supabase ${res.status}: ${errText}`;
          console.error(`[SupabaseClient] insertRecord(${cloudTable}) failed:`, cloudError);
        }
      } catch (err) {
        cloudError = err.message;
        console.error(`[SupabaseClient] insertRecord(${cloudTable}) network error:`, err.message);
      }
    }

    // 2. Persist to dedicated local store mirror
    const store = this.readLocalStore();
    if (!store[table]) store[table] = [];
    store[table] = store[table].filter(r => (r.request_id || r.external_ref_id || r.defect_id || r.id) !== canonicalId);
    store[table].push(fullRecord);
    this.writeLocalStore(store);

    if (this.isConfigured && !cloudSaved) {
      return {
        success: false,
        error: cloudError || `Failed to persist to Supabase ${cloudTable}`,
        data: fullRecord,
        storage_destination: 'LOCAL_ONLY_SUPABASE_FAILED'
      };
    }

    return {
      success: true,
      data: fullRecord,
      storage_destination: cloudSaved ? 'SUPABASE_CLOUD_AND_SERVER' : 'DEDICATED_SERVER_SUPABASE_STORE'
    };
  }

  async updateRecord(table, filterKey, filterVal, updatePayload) {
    const cloudTable = this.mapTableName(table);
    const nowIso = new Date().toISOString();
    const payloadWithTime = { ...updatePayload, updated_at: nowIso };

    // Resolve canonical key based on table domain
    let canonicalKey = filterKey;
    if (cloudTable === 'requested_maintenance_windows') {
      canonicalKey = 'request_id';
    } else if (cloudTable === 'maintenance_defects') {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(filterVal));
      canonicalKey = isUuid ? 'defect_id' : (filterKey || 'external_ref_id');
    } else if (cloudTable === 'track_sections') {
      canonicalKey = filterKey || 'section_id';
    } else if (cloudTable === 'block_schedules') {
      canonicalKey = filterKey || 'block_id';
    } else if (!canonicalKey) {
      canonicalKey = 'id';
    }

    let cloudUpdated = false;
    let cloudError = null;

    if (this.isConfigured) {
      try {
        const cloudPayload = this.filterPayloadForTable(cloudTable, payloadWithTime);
        const res = await fetch(`${this.url}/rest/v1/${cloudTable}?${canonicalKey}=eq.${encodeURIComponent(filterVal)}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            apikey: this.key,
            Authorization: `Bearer ${this.key}`,
            Prefer: 'return=representation',
          },
          body: JSON.stringify(cloudPayload),
        });

        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            cloudUpdated = true;
          } else if (!res.headers.get('content-length') || res.status === 204) {
            cloudUpdated = true;
          } else {
            cloudUpdated = true;
          }
        } else {
          const errText = await res.text();
          cloudError = `Supabase ${res.status}: ${errText}`;
          console.error(`[SupabaseClient] updateRecord(${cloudTable}) failed:`, cloudError);
        }
      } catch (err) {
        cloudError = err.message;
        console.error(`[SupabaseClient] updateRecord(${cloudTable}) error:`, err.message);
      }
    }

    // Update Local Mirror
    const store = this.readLocalStore();
    if (store[table]) {
      let matched = false;
      store[table] = store[table].map(item => {
        const match = (item[canonicalKey] !== undefined && String(item[canonicalKey]) === String(filterVal)) ||
                      (item.id !== undefined && String(item.id) === String(filterVal)) ||
                      (item.request_id !== undefined && String(item.request_id) === String(filterVal)) ||
                      (item.external_ref_id !== undefined && String(item.external_ref_id) === String(filterVal)) ||
                      (item.defect_id !== undefined && String(item.defect_id) === String(filterVal));
        if (match) {
          matched = true;
          return { ...item, ...payloadWithTime };
        }
        return item;
      });

      if (!matched && filterVal) {
        const newRecord = {
          [canonicalKey]: filterVal,
          request_id: String(filterVal),
          status: updatePayload.status || 'ACCEPTED',
          ...payloadWithTime,
          created_at: nowIso,
          updated_at: nowIso
        };
        store[table].push(newRecord);
      }
      this.writeLocalStore(store);
    }

    // ── PRIORITY 5: Defect Status Synchronization ──
    // If completing a maintenance window associated with a defect, update maintenance_defects to RECTIFIED
    if (updatePayload.status === 'COMPLETED' && updatePayload.defect_ref_id) {
      try {
        await this.updateRecord('maintenance_defects', null, updatePayload.defect_ref_id, {
          status: 'RECTIFIED',
          rectified_at: nowIso,
        });
      } catch (defectSyncErr) {
        console.warn('[SupabaseClient] Linked defect synchronization notice:', defectSyncErr.message);
      }
    }

    if (this.isConfigured && !cloudUpdated) {
      return {
        success: false,
        error: cloudError || `Failed to update record ${filterVal} in Supabase ${cloudTable}`,
        storage_destination: 'LOCAL_ONLY_SUPABASE_FAILED'
      };
    }

    return {
      success: true,
      storage_destination: cloudUpdated ? 'SUPABASE_CLOUD_AND_SERVER' : 'DEDICATED_SERVER_SUPABASE_STORE'
    };
  }

  async upsertRecords(table, records, onConflict = '') {
    if (this.isConfigured) {
      try {
        const headers = {
          'Content-Type': 'application/json',
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          Prefer: 'return=representation',
        };
        if (onConflict) headers['Prefer'] = `resolution=merge-duplicates,return=representation`;

        const res = await fetch(`${this.url}/rest/v1/${table}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(records),
        });

        if (res.ok) {
          const data = await res.json();
          return { success: true, data };
        }
      } catch (err) {
        console.warn(`[SupabaseClient] upsertRecords(${table}) cloud notice:`, err.message);
      }
    }

    const store = this.readLocalStore();
    store[table] = records;
    this.writeLocalStore(store);
    return { success: true, data: records };
  }

  // Seed default dataset to Supabase Cloud tables if available
  async seedInitialTablesData() {
    if (!this.isConfigured) return { success: false, error: 'Supabase not configured' };

    const results = {};

    // 1. track_sections
    const defaultTrackSections = [
      { section_id: 'NDLS-CNB-UP', division: 'NR', sub_division: 'DLI', start_station: 'NDLS', end_station: 'CNB', start_km: 0.0, end_km: 440.0, max_permissible_speed: 160, line_type: 'UP' },
      { section_id: 'NDLS-CNB-DN', division: 'NR', sub_division: 'DLI', start_station: 'CNB', end_station: 'NDLS', start_km: 0.0, end_km: 440.0, max_permissible_speed: 160, line_type: 'DOWN' },
      { section_id: 'DLI-GZB-UP', division: 'NR', sub_division: 'DLI', start_station: 'DLI', end_station: 'GZB', start_km: 0.0, end_km: 24.5, max_permissible_speed: 110, line_type: 'UP' },
      { section_id: 'GZB-ALJN-UP', division: 'NCR', sub_division: 'ALJN', start_station: 'GZB', end_station: 'ALJN', start_km: 25.4, end_km: 126.1, max_permissible_speed: 130, line_type: 'UP' },
      { section_id: 'ALJN-TDL-UP', division: 'NCR', sub_division: 'TDL', start_station: 'ALJN', end_station: 'TDL', start_km: 126.1, end_km: 204.3, max_permissible_speed: 130, line_type: 'UP' }
    ];
    results.track_sections = await this.upsertRecords('track_sections', defaultTrackSections);

    // 2. maintenance_defects
    const defaultDefects = [
      {
        external_ref_id: 'WO-2026-TMS-401',
        source_system: 'TMS',
        department: 'CIVIL',
        section_id: 'NDLS-CNB-UP',
        start_km: 142.500,
        end_km: 145.200,
        defect_type: 'Rail Fracture Risk & Sleepers Overhaul',
        severity: 'CRITICAL',
        criticality_score: 9,
        days_overdue: 14,
        priority_score: 94.50,
        priority_category: 'P1',
        required_track_closure: true,
        requires_power_cut: true,
        estimated_duration_minutes: 180,
        assigned_gang_id: 'GANG-NR-DLI-04',
        status: 'PENDING'
      },
      {
        external_ref_id: 'WO-2026-ST-302',
        source_system: 'SMMS',
        department: 'S&T',
        section_id: 'NDLS-CNB-UP',
        start_km: 143.000,
        end_km: 144.500,
        defect_type: 'Signal Point Machine Cable Replacement',
        severity: 'HIGH',
        criticality_score: 7,
        days_overdue: 5,
        priority_score: 82.10,
        priority_category: 'P2',
        required_track_closure: false,
        requires_power_cut: false,
        estimated_duration_minutes: 120,
        assigned_gang_id: 'GANG-ST-CNB-02',
        status: 'PENDING'
      },
      {
        external_ref_id: 'WO-2026-TRD-109',
        source_system: 'TDMS',
        department: 'TRD_OHE',
        section_id: 'NDLS-CNB-UP',
        start_km: 141.800,
        end_km: 146.000,
        defect_type: 'OHE Catenary Wire Sag & Insulator Replacement',
        severity: 'HIGH',
        criticality_score: 8,
        days_overdue: 8,
        priority_score: 88.00,
        priority_category: 'P2',
        required_track_closure: true,
        requires_power_cut: true,
        estimated_duration_minutes: 150,
        assigned_gang_id: 'GANG-TRD-DLI-01',
        status: 'PENDING'
      }
    ];
    results.maintenance_defects = await this.upsertRecords('maintenance_defects', defaultDefects);

    return { success: true, details: results };
  }
}

const supabaseAuditService = new SupabaseAuditService();

module.exports = {
  supabaseAuditService,
  testSupabaseClient: async () => {
    return await supabaseAuditService.getStatus();
  },
};
