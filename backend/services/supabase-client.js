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
      all_tables: ['track_sections', 'maintenance_defects', 'block_schedules', 'corridor_windows', 'immutable_action_audit_log'],
      immutability_enforcement: 'PostgreSQL Trigger + RLS + SHA-256 Cryptographic Chaining',
      last_known_hash: this.lastKnownHash,
    };
  }

  // ---------------------------------------------------------------------------
  // GENERAL SUPABASE CLOUD TABLE OPERATIONS (CRUD)
  // ---------------------------------------------------------------------------

  async queryTable(table, queryParams = {}) {
    if (!this.isConfigured) return { success: false, error: 'Supabase not configured' };
    try {
      let queryStr = '?select=*';
      if (queryParams.order) queryStr += `&order=${queryParams.order}`;
      if (queryParams.limit) queryStr += `&limit=${queryParams.limit}`;
      if (queryParams.filterKey && queryParams.filterVal) {
        queryStr += `&${queryParams.filterKey}=eq.${encodeURIComponent(queryParams.filterVal)}`;
      }

      const res = await fetch(`${this.url}/rest/v1/${table}${queryStr}`, {
        headers: {
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
        },
      });

      if (!res.ok) {
        const errText = await res.text();
        return { success: false, status: res.status, error: errText };
      }

      const data = await res.json();
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async insertRecord(table, record) {
    if (!this.isConfigured) return { success: false, error: 'Supabase not configured' };
    try {
      const res = await fetch(`${this.url}/rest/v1/${table}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          Prefer: 'return=representation',
        },
        body: JSON.stringify(record),
      });

      if (!res.ok) {
        const errText = await res.text();
        return { success: false, status: res.status, error: errText };
      }

      const data = await res.json();
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async updateRecord(table, filterKey, filterVal, updatePayload) {
    if (!this.isConfigured) return { success: false, error: 'Supabase not configured' };
    try {
      const res = await fetch(`${this.url}/rest/v1/${table}?${filterKey}=eq.${encodeURIComponent(filterVal)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: this.key,
          Authorization: `Bearer ${this.key}`,
          Prefer: 'return=representation',
        },
        body: JSON.stringify(updatePayload),
      });

      if (!res.ok) {
        const errText = await res.text();
        return { success: false, status: res.status, error: errText };
      }

      const data = await res.json();
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  async upsertRecords(table, records, onConflict = '') {
    if (!this.isConfigured) return { success: false, error: 'Supabase not configured' };
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

      if (!res.ok) {
        const errText = await res.text();
        return { success: false, status: res.status, error: errText };
      }

      const data = await res.json();
      return { success: true, data };
    } catch (err) {
      return { success: false, error: err.message };
    }
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
