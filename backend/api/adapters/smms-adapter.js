/**
 * smms-adapter.js
 * ─────────────────────────────────────────────────────────────────
 * Adapter for the Signal Maintenance Management System (SMMS).
 *
 * Responsibilities:
 *   - Authenticate via API Key (X-Api-Key header) with optional
 *     per-request HMAC-SHA256 request signing
 *   - Fetch signal asset maintenance records, open defects,
 *     and scheduled inspection data
 *   - Validate against SMMS signal asset schemas
 *   - Normalise into the platform's SignalAsset and SigDefect schemas
 *
 * SMMS provides:
 *   • Signal equipment inventory (relay rooms, signals, axle counters)
 *   • Defect tickets with severity, equipment type, and detection method
 *   • Inspection schedules and compliance status per zone
 *   • Relay failure events and MTBF (mean time between failures) data
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

const crypto = require('crypto');
const {
  BaseAdapter,
  AuthError,
  ValidationError,
  ParseError,
  ConnectionError,
} = require('./base-adapter');

// ── Domain constants ──────────────────────────────────────────────
const EQUIPMENT_TYPES = Object.freeze([
  'RELAY',        // Relay-based interlocking equipment
  'ELECTRONIC',   // Electronic interlocking (EI)
  'AXLE_COUNTER', // Axle counter detection units
  'SIGNAL_HEAD',  // Physical signal heads (LED / filament)
  'LEVEL_CROSSING',
  'POINT_MACHINE',
  'CABLE',
  'TELECOM',
  'OTHER',
]);

const DEFECT_STATUS = Object.freeze({
  OPEN:        'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED:    'RESOLVED',
  DEFERRED:    'DEFERRED',
});

const DETECTION_METHOD = Object.freeze({
  AUTOMATED:  'AUTOMATED',   // Self-diagnostic / SCADA alert
  INSPECTION: 'INSPECTION',  // Routine physical inspection
  FAILURE:    'FAILURE',     // Post-failure detection
  PATROL:     'PATROL',      // Beat patrol report
});

// ── SMMS Adapter ──────────────────────────────────────────────────
class SmmsAdapter extends BaseAdapter {
  /**
   * @param {object} config
   * @param {string} config.auth.apiKey       - API key for X-Api-Key header
   * @param {string} config.auth.hmacSecret   - HMAC secret for request signing (optional)
   * @param {string} config.baseUrl           - SMMS API base URL
   * @param {string} config.zone              - Railway zone code (e.g. 'NR', 'SR')
   * @param {string} [config.division]        - Narrow to a division
   * @param {object} [config.retry]
   * @param {number} [config.timeoutMs]
   */
  constructor(config = {}) {
    super({ adapterName: 'SMMS', ...config });
    this.baseUrl  = config.baseUrl;
    this.zone     = config.zone;
    this.division = config.division ?? null;

    if (!this.baseUrl) throw new Error('SmmsAdapter: config.baseUrl is required');
    if (!this.zone)    throw new Error('SmmsAdapter: config.zone is required');
    if (!this.auth.apiKey) throw new Error('SmmsAdapter: config.auth.apiKey is required');
  }

  // ── Lifecycle ─────────────────────────────────────────────────
  async connect() {
    this.log.info('Connecting to SMMS', { baseUrl: this.baseUrl, zone: this.zone });
    const health = await this.healthCheck();
    if (!health.ok) throw new ConnectionError('SMMS health check failed', { health });
    this._healthy = true;
    this.log.info('SMMS connection established', { latencyMs: health.latencyMs });
  }

  async healthCheck() {
    const t0 = Date.now();
    try {
      const res = await this.fetchWithTimeout(`${this.baseUrl}/ping`, {
        headers: this._buildHeaders('GET', '/ping', ''),
      });
      return { ok: res.status === 200, latencyMs: Date.now() - t0, details: { httpStatus: res.status } };
    } catch (err) {
      this.log.error('SMMS health check failed', { error: err.message });
      return { ok: false, latencyMs: Date.now() - t0, details: { error: err.message } };
    }
  }

  // ── Authentication ────────────────────────────────────────────
  /**
   * Builds request headers including API key and optional HMAC signature.
   * @param {string} method   - HTTP method (GET, POST …)
   * @param {string} path     - URL path (for HMAC payload)
   * @param {string} bodyStr  - Serialised request body ('' for GET)
   */
  _buildHeaders(method, path, bodyStr) {
    if (!this.auth.apiKey) throw new AuthError('SMMS apiKey is not configured');

    const timestamp = new Date().toISOString();
    const headers   = {
      'X-Api-Key':    this.auth.apiKey,
      'X-Zone':       this.zone,
      'X-Timestamp':  timestamp,
      Accept:         'application/json',
      'Content-Type': 'application/json',
    };

    if (this.division) headers['X-Division'] = this.division;

    // HMAC signing (optional but recommended for production)
    if (this.auth.hmacSecret) {
      const payload   = `${method}\n${path}\n${timestamp}\n${bodyStr}`;
      const signature = this.buildHmacSignature(payload, this.auth.hmacSecret);
      headers['X-Signature'] = `sha256=${signature}`;
    }

    return headers;
  }

  // ── Data Fetching ─────────────────────────────────────────────
  /**
   * @param {object} params
   * @param {string} [params.since]        - ISO-8601 cursor
   * @param {string} [params.status]       - Filter by defect status
   * @param {string} [params.equipmentType]
   * @param {number} [params.limit]        - Default 200
   */
  async fetchRaw(params = {}, log) {
    const { since, status, equipmentType, limit = 200 } = params;
    const qs = new URLSearchParams({ zone: this.zone, limit });
    if (since)         qs.set('updatedAfter', since);
    if (status)        qs.set('status', status);
    if (equipmentType) qs.set('equipmentType', equipmentType);
    if (this.division) qs.set('division', this.division);

    const path = `/v2/signal/defects?${qs}`;
    const url  = `${this.baseUrl}${path}`;
    log?.debug('Fetching SMMS defects', { url });

    const res = await this.fetchWithTimeout(url, {
      method:  'GET',
      headers: this._buildHeaders('GET', path, ''),
    });

    if (res.status === 401) throw new AuthError('SMMS rejected API key', { httpStatus: 401 });
    if (res.status === 403) throw new AuthError('SMMS API key lacks required permissions', { httpStatus: 403 });
    if (!res.ok) throw new ConnectionError(`SMMS returned HTTP ${res.status}`, { url, httpStatus: res.status });

    let body;
    try { body = await res.json(); }
    catch { throw new ParseError('SMMS response is not valid JSON'); }

    return body.defects ?? body.data ?? body;
  }

  // ── Validation ────────────────────────────────────────────────
  validate(r) {
    this._requireField(r, 'defectId',      'string');
    this._requireField(r, 'assetId',       'string');
    this._requireField(r, 'equipmentType', 'string');
    this._requireField(r, 'detectedAt',    'string');
    this._requireField(r, 'status');
    this._requireField(r, 'severity');

    if (!EQUIPMENT_TYPES.includes(r.equipmentType)) {
      throw new ValidationError(
        `Unknown equipmentType: "${r.equipmentType}"`,
        { field: 'equipmentType', allowed: EQUIPMENT_TYPES }
      );
    }

    if (!Object.values(DEFECT_STATUS).includes(r.status)) {
      throw new ValidationError(
        `Unknown defect status: "${r.status}"`,
        { field: 'status', allowed: Object.values(DEFECT_STATUS) }
      );
    }

    if (r.detectionMethod && !Object.values(DETECTION_METHOD).includes(r.detectionMethod)) {
      throw new ValidationError(
        `Unknown detectionMethod: "${r.detectionMethod}"`,
        { field: 'detectionMethod' }
      );
    }

    // Validate MTBF if present
    if (r.mtbfHours !== undefined && (typeof r.mtbfHours !== 'number' || r.mtbfHours < 0)) {
      throw new ValidationError('mtbfHours must be a non-negative number', { value: r.mtbfHours });
    }

    return {
      ...r,
      detectedAt:  this._coerceDate(r.detectedAt,  'detectedAt'),
      resolvedAt:  r.resolvedAt  ? this._coerceDate(r.resolvedAt,  'resolvedAt')  : null,
      scheduledAt: r.scheduledAt ? this._coerceDate(r.scheduledAt, 'scheduledAt') : null,
    };
  }

  // ── Transform → Canonical Schema ──────────────────────────────
  transform(r) {
    return {
      _source:       'SMMS',
      _ingestedAt:   new Date().toISOString(),
      _schemaVersion:'1.0',

      defectId:       r.defectId,
      assetId:        r.assetId,
      assetName:      r.assetName ?? null,
      zone:           r.zone ?? this.zone,
      division:       r.division ?? this.division,
      sectionId:      r.sectionId ?? null,
      stationCode:    r.stationCode ?? null,

      equipmentType:   r.equipmentType,
      detectionMethod: r.detectionMethod ?? DETECTION_METHOD.INSPECTION,
      severity:        r.severity,
      status:          r.status,

      description:     r.description ?? null,
      failureMode:     r.failureMode ?? null,
      mtbfHours:       r.mtbfHours ?? null,

      // Maintenance lifecycle
      assignedTo:     r.assignedTo ?? null,
      workOrderId:    r.workOrderId ?? null,

      // Timestamps
      detectedAt:     r.detectedAt,
      scheduledAt:    r.scheduledAt,
      resolvedAt:     r.resolvedAt,

      // GPS / chainage location
      gpsLat:    r.gpsLat  ?? null,
      gpsLon:    r.gpsLon  ?? null,
      chainage:  r.chainage ?? null,

      _raw: r,
    };
  }
}

// ── Factory ───────────────────────────────────────────────────────
/**
 * Required env vars:
 *   SMMS_BASE_URL, SMMS_API_KEY, SMMS_ZONE
 * Optional:
 *   SMMS_HMAC_SECRET, SMMS_DIVISION, SMMS_TIMEOUT_MS
 */
function createSmmsAdapter(overrides = {}) {
  return new SmmsAdapter({
    baseUrl:   process.env.SMMS_BASE_URL,
    zone:      process.env.SMMS_ZONE,
    division:  process.env.SMMS_DIVISION,
    timeoutMs: Number(process.env.SMMS_TIMEOUT_MS ?? 10_000),
    auth: {
      apiKey:     process.env.SMMS_API_KEY,
      hmacSecret: process.env.SMMS_HMAC_SECRET,
    },
    retry: { maxAttempts: 3, baseDelayMs: 800 },
    ...overrides,
  });
}

module.exports = {
  SmmsAdapter, createSmmsAdapter,
  EQUIPMENT_TYPES, DEFECT_STATUS, DETECTION_METHOD,
};
