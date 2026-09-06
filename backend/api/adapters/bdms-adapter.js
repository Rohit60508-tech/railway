/**
 * bdms-adapter.js
 * ─────────────────────────────────────────────────────────────────
 * Adapter for the Bridge Data Management System (BDMS).
 *
 * Responsibilities:
 *   - Authenticate via API key with optional IP-whitelist enforcement
 *   - Fetch bridge inspection records, structural health scores,
 *     hydraulic data, and load-rating assessments
 *   - Validate against IR bridge classification and condition norms
 *     (per IRS Bridge Manual and RDSO Guidelines)
 *   - Produce normalised BridgeAsset and BridgeInspection events
 *
 * BDMS provides:
 *   • Bridge inventory with span, type, and construction details
 *   • Inspection records (routine, special, detailed, load)
 *   • Structural condition ratings (Category A / B / C / D / E)
 *   • Hydraulic data (waterway adequacy, scour depth)
 *   • Gauge of fitness records and maintenance history
 *   • Distressed bridge / watch list status
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

const {
  BaseAdapter,
  AuthError,
  ValidationError,
  ParseError,
  ConnectionError,
} = require('./base-adapter');

// ── Bridge domain constants ───────────────────────────────────────
// IRS Bridge Manual bridge type codes
const BRIDGE_TYPES = Object.freeze([
  'GIRDER',          // Steel/PSC Girder
  'ARCH',            // Masonry / concrete arch
  'TRUSS',           // Through / deck truss
  'BOX',             // Box girder (PSC/RCC)
  'SLAB',            // RCC slab culvert
  'PIPE_CULVERT',
  'SUBMERSIBLE',
  'CABLE_STAYED',
  'SUSPENSION',
  'OTHER',
]);

// RDSO bridge condition categories
const CONDITION_CATEGORY = Object.freeze({
  A: { label: 'Good',       action: 'Routine maintenance' },
  B: { label: 'Fair',       action: 'Watch and maintain' },
  C: { label: 'Poor',       action: 'Prompt attention required' },
  D: { label: 'Dangerous',  action: 'Immediate attention / speed restriction' },
  E: { label: 'Critical',   action: 'Immediate closure and emergency repair' },
});

const INSPECTION_TYPES = Object.freeze({
  ROUTINE:    'ROUTINE',      // Annual
  SPECIAL:    'SPECIAL',      // Post-flood / post-seismic
  DETAILED:   'DETAILED',     // Every 5 years
  LOAD:       'LOAD',         // Load census inspection
  NIGHT:      'NIGHT',        // Monsoon night patrolling
  UNDERWATER: 'UNDERWATER',   // Substructure & foundation
});

// ── BDMS Adapter ──────────────────────────────────────────────────
class BdmsAdapter extends BaseAdapter {
  /**
   * @param {object} config
   * @param {string} config.auth.apiKey      - BDMS API key
   * @param {string} config.auth.apiSecret   - API secret (used in HMAC signing)
   * @param {string} config.baseUrl
   * @param {string} config.zone             - Zonal railway code
   * @param {string} [config.division]
   * @param {object} [config.retry]
   * @param {number} [config.timeoutMs]
   */
  constructor(config = {}) {
    super({ adapterName: 'BDMS', ...config });
    this.baseUrl  = config.baseUrl;
    this.zone     = config.zone;
    this.division = config.division ?? null;

    if (!this.baseUrl) throw new Error('BdmsAdapter: config.baseUrl is required');
    if (!this.zone)    throw new Error('BdmsAdapter: config.zone is required');
    if (!this.auth.apiKey) throw new Error('BdmsAdapter: config.auth.apiKey is required');
  }

  // ── Lifecycle ─────────────────────────────────────────────────
  async connect() {
    this.log.info('Connecting to BDMS', { baseUrl: this.baseUrl, zone: this.zone });
    const health = await this.healthCheck();
    if (!health.ok) throw new ConnectionError('BDMS health check failed', { health });
    this._healthy = true;
    this.log.info('BDMS connection established', { latencyMs: health.latencyMs });
  }

  async healthCheck() {
    const t0 = Date.now();
    try {
      const res = await this.fetchWithTimeout(`${this.baseUrl}/api/v1/status`, {
        headers: this._buildHeaders('GET', '/api/v1/status', ''),
      });
      return { ok: res.status === 200, latencyMs: Date.now() - t0, details: { httpStatus: res.status } };
    } catch (err) {
      return { ok: false, latencyMs: Date.now() - t0, details: { error: err.message } };
    }
  }

  // ── Authentication ────────────────────────────────────────────
  _buildHeaders(method, path, bodyStr) {
    if (!this.auth.apiKey) throw new AuthError('BDMS apiKey is not configured');

    const nonce     = Math.random().toString(36).slice(2, 10);
    const timestamp = Date.now().toString();
    const headers   = {
      'X-Api-Key':    this.auth.apiKey,
      'X-Nonce':      nonce,
      'X-Timestamp':  timestamp,
      'X-Zone':       this.zone,
      Accept:         'application/json',
      'Content-Type': 'application/json',
    };
    if (this.division) headers['X-Division'] = this.division;

    // HMAC-SHA256 request signature
    if (this.auth.apiSecret) {
      const payload   = `${method}\n${path}\n${timestamp}\n${nonce}\n${bodyStr}`;
      const signature = this.buildHmacSignature(payload, this.auth.apiSecret);
      headers['X-Signature'] = `sha256=${signature}`;
    }
    return headers;
  }

  // ── Data Fetching: Bridge inventory ──────────────────────────
  /**
   * Fetches bridge asset records.
   * @param {object} params
   * @param {string}  [params.since]           - Incremental cursor
   * @param {string}  [params.conditionCategory]- Filter: A|B|C|D|E
   * @param {boolean} [params.watchListOnly]   - Return only distressed bridges
   * @param {number}  [params.limit]           - Default 200
   */
  async fetchRaw(params = {}, log) {
    const { since, conditionCategory, watchListOnly, limit = 200 } = params;
    const qs = new URLSearchParams({ zone: this.zone, limit });
    if (since)             qs.set('modifiedAfter', since);
    if (conditionCategory) qs.set('conditionCategory', conditionCategory);
    if (watchListOnly)     qs.set('watchListOnly', 'true');
    if (this.division)     qs.set('division', this.division);

    const path = `/api/v1/bridges?${qs}`;
    const url  = `${this.baseUrl}${path}`;
    log?.debug('Fetching BDMS bridges', { url });

    const res = await this.fetchWithTimeout(url, {
      headers: this._buildHeaders('GET', path, ''),
    });

    if (res.status === 401) throw new AuthError('BDMS API key rejected', { httpStatus: 401 });
    if (!res.ok) throw new ConnectionError(`BDMS returned HTTP ${res.status}`, { url });

    let body;
    try { body = await res.json(); }
    catch { throw new ParseError('BDMS response is not valid JSON'); }

    return body.bridges ?? body.data ?? body;
  }

  // ── Data Fetching: Inspections ────────────────────────────────
  /**
   * Fetches recent inspection records for a specific bridge.
   * @param {string} bridgeId
   * @param {string} [inspectionType]
   */
  async fetchInspections(bridgeId, inspectionType) {
    const qs = new URLSearchParams({ bridgeId });
    if (inspectionType) qs.set('type', inspectionType);

    const path = `/api/v1/bridges/${bridgeId}/inspections?${qs}`;
    const url  = `${this.baseUrl}${path}`;
    this.log.debug('Fetching BDMS inspections', { bridgeId, url });

    const res = await this.fetchWithTimeout(url, {
      headers: this._buildHeaders('GET', path, ''),
    });

    if (!res.ok) throw new ConnectionError(`BDMS inspections returned HTTP ${res.status}`, { bridgeId });

    let body;
    try { body = await res.json(); }
    catch { throw new ParseError('BDMS inspection response is not valid JSON'); }

    return (body.inspections ?? body.data ?? body).map(ins => this.validateInspection(ins));
  }

  // ── Validation: Bridge asset ──────────────────────────────────
  validate(r) {
    this._requireField(r, 'bridgeId',     'string');
    this._requireField(r, 'sectionId',    'string');
    this._requireField(r, 'bridgeType',   'string');
    this._requireField(r, 'chainageKm',   'number');

    if (!BRIDGE_TYPES.includes(r.bridgeType)) {
      throw new ValidationError(
        `Unknown bridgeType: "${r.bridgeType}"`,
        { field: 'bridgeType', allowed: BRIDGE_TYPES }
      );
    }

    if (r.conditionCategory && !CONDITION_CATEGORY[r.conditionCategory]) {
      throw new ValidationError(
        `Unknown conditionCategory: "${r.conditionCategory}"`,
        { field: 'conditionCategory', allowed: Object.keys(CONDITION_CATEGORY) }
      );
    }

    if (r.totalSpanM !== undefined && (typeof r.totalSpanM !== 'number' || r.totalSpanM <= 0)) {
      throw new ValidationError('totalSpanM must be a positive number', { value: r.totalSpanM });
    }

    if (r.sanctionedSpeedKmh !== undefined && r.sanctionedSpeedKmh < 0) {
      throw new ValidationError('sanctionedSpeedKmh cannot be negative', { value: r.sanctionedSpeedKmh });
    }

    return {
      ...r,
      lastInspectedOn: r.lastInspectedOn ? this._coerceDate(r.lastInspectedOn, 'lastInspectedOn') : null,
      constructedOn:   r.constructedOn   ? this._coerceDate(r.constructedOn,   'constructedOn')   : null,
      modifiedAt:      r.modifiedAt      ? this._coerceDate(r.modifiedAt,       'modifiedAt')      : null,
    };
  }

  // ── Validation: Inspection record ────────────────────────────
  validateInspection(r) {
    this._requireField(r, 'inspectionId', 'string');
    this._requireField(r, 'bridgeId',     'string');
    this._requireField(r, 'type',         'string');
    this._requireField(r, 'conductedOn',  'string');
    this._requireField(r, 'inspectorId',  'string');

    if (!Object.values(INSPECTION_TYPES).includes(r.type)) {
      throw new ValidationError(
        `Unknown inspection type: "${r.type}"`,
        { field: 'type', allowed: Object.values(INSPECTION_TYPES) }
      );
    }

    if (r.conditionCategory && !CONDITION_CATEGORY[r.conditionCategory]) {
      throw new ValidationError(
        `Unknown conditionCategory: "${r.conditionCategory}"`,
        { field: 'conditionCategory' }
      );
    }

    return {
      ...r,
      conductedOn: this._coerceDate(r.conductedOn, 'conductedOn'),
    };
  }

  // ── Transform: Bridge asset ───────────────────────────────────
  transform(r) {
    const catInfo   = r.conditionCategory ? CONDITION_CATEGORY[r.conditionCategory] : null;
    const ageYears  = r.constructedOn
      ? Math.floor((Date.now() - new Date(r.constructedOn).getTime()) / (365.25 * 86400_000))
      : null;

    return {
      _source:        'BDMS',
      _ingestedAt:    new Date().toISOString(),
      _schemaVersion: '1.0',

      bridgeId:         r.bridgeId,
      bridgeName:       r.bridgeName   ?? null,
      bridgeNo:         r.bridgeNo     ?? null,   // IR running number
      sectionId:        r.sectionId,
      zone:             r.zone ?? this.zone,
      division:         r.division ?? this.division,

      // Physical
      bridgeType:       r.bridgeType,
      totalSpanM:       r.totalSpanM   ?? null,
      numberOfSpans:    r.numberOfSpans ?? null,
      waterway:         r.waterway     ?? null,    // m²
      rlFloodLevel:     r.rlFloodLevel ?? null,    // Reduced Level flood mark
      scourDepthM:      r.scourDepthM  ?? null,
      foundationType:   r.foundationType ?? null,

      // Classification & condition
      classificationCode:  r.classificationCode ?? null,  // Major/Minor
      conditionCategory:   r.conditionCategory  ?? null,
      conditionLabel:      catInfo?.label       ?? null,
      recommendedAction:   catInfo?.action      ?? null,
      watchList:           r.watchList          ?? false,

      // Speed / operational
      sanctionedSpeedKmh:  r.sanctionedSpeedKmh ?? null,
      actualSpeedKmh:      r.actualSpeedKmh     ?? null,
      hasSpeedRestriction: (r.actualSpeedKmh ?? 999) < (r.sanctionedSpeedKmh ?? 999),

      // Location
      chainageKm:   r.chainageKm,
      gpsLat:       r.gpsLat    ?? null,
      gpsLon:       r.gpsLon    ?? null,

      // Lifecycle
      ageYears,
      constructedOn:   r.constructedOn,
      lastInspectedOn: r.lastInspectedOn,
      nextInspectionDue: r.nextInspectionDue
        ? this._coerceDate(r.nextInspectionDue, 'nextInspectionDue')
        : null,

      modifiedAt: r.modifiedAt,
      _raw: r,
    };
  }
}

// ── Factory ───────────────────────────────────────────────────────
/**
 * Required env vars: BDMS_BASE_URL, BDMS_ZONE, BDMS_API_KEY
 * Optional: BDMS_API_SECRET, BDMS_DIVISION, BDMS_TIMEOUT_MS
 */
function createBdmsAdapter(overrides = {}) {
  return new BdmsAdapter({
    baseUrl:   process.env.BDMS_BASE_URL,
    zone:      process.env.BDMS_ZONE,
    division:  process.env.BDMS_DIVISION,
    timeoutMs: Number(process.env.BDMS_TIMEOUT_MS ?? 10_000),
    auth: {
      apiKey:    process.env.BDMS_API_KEY,
      apiSecret: process.env.BDMS_API_SECRET,
    },
    retry: { maxAttempts: 3, baseDelayMs: 700 },
    ...overrides,
  });
}

module.exports = {
  BdmsAdapter, createBdmsAdapter,
  BRIDGE_TYPES, CONDITION_CATEGORY, INSPECTION_TYPES,
};
