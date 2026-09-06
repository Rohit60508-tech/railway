/**
 * tdms-adapter.js
 * ─────────────────────────────────────────────────────────────────
 * Adapter for the Track Defect Management System (TDMS).
 *
 * Responsibilities:
 *   - Authenticate via session-cookie login (legacy TDMS deployments)
 *     OR via Bearer JWT if TDMS REST API is available
 *   - Ingest open track defects, ultrasonic anomalies, and geometry
 *     deviations from the Civil engineering department
 *   - Map Indian Railways standard track defect classification codes
 *     (per RDSO Track Manual) to the platform's defect taxonomy
 *   - Produce normalised TrackDefect events
 *
 * TDMS provides:
 *   • Track defect records (gauge, alignment, cross-level, twist)
 *   • Rail flaw (USFD) results linked to section
 *   • Joint condition records
 *   • Weld failure events
 *   • Sanctioned speed restriction (SSR / TSR) issuance data
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

// ── RDSO Track Defect Classification ─────────────────────────────
// Based on RDSO Track Manual 2021, Annexure I
const DEFECT_CATEGORIES = Object.freeze({
  A: 'GAUGE',          // Gauge deviation
  B: 'ALIGNMENT',      // Horizontal alignment (slew)
  C: 'CROSS_LEVEL',    // Cross-level (cant) error
  D: 'TWIST',          // Twist (spiral deviation)
  E: 'UNEVENNESS',     // Longitudinal level (vertical alignment)
  F: 'RAIL_FLAW',      // Ultrasonic flaw
  G: 'WELD',           // Weld failure / defect
  H: 'JOINT',          // Rail joint condition
  I: 'SLEEPER',        // Sleeper condition (cracked, missing)
  J: 'BALLAST',        // Ballast deficiency / fouling
  K: 'DRAINAGE',       // Drainage deficiency
  L: 'STRUCTURE',      // Bridge, culvert, or formation defect
  Z: 'OTHER',
});

// Severity maps to RDSO TQI thresholds
const SEVERITY_LEVEL = Object.freeze({
  1: 'RED',    // Immediate attention — train speed restriction or closure
  2: 'YELLOW', // Urgent attention within 24 hours
  3: 'GREEN',  // Planned maintenance cycle
});

const DEFECT_STATUS = Object.freeze({
  OPEN:        'OPEN',
  ASSIGNED:    'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  RECTIFIED:   'RECTIFIED',
  CLOSED:      'CLOSED',
});

// ── TDMS Adapter ──────────────────────────────────────────────────
class TdmsAdapter extends BaseAdapter {
  /**
   * @param {object} config
   * @param {string} config.auth.username    - TDMS login username
   * @param {string} config.auth.password    - TDMS login password
   * @param {string} [config.auth.token]     - Static JWT (bypasses login flow)
   * @param {string} config.baseUrl          - TDMS API / portal base URL
   * @param {string} config.divisionCode     - e.g. 'DLI', 'MAS', 'HWH'
   * @param {string} [config.sectionFilter]  - Optional section ID filter
   * @param {object} [config.retry]
   * @param {number} [config.timeoutMs]
   */
  constructor(config = {}) {
    super({ adapterName: 'TDMS', ...config });
    this.baseUrl       = config.baseUrl;
    this.divisionCode  = config.divisionCode;
    this.sectionFilter = config.sectionFilter ?? null;

    this._sessionCookie  = null;
    this._sessionExpiry  = 0;
    this.SESSION_TTL_MS  = 55 * 60 * 1000; // 55-minute session TTL

    if (!this.baseUrl)      throw new Error('TdmsAdapter: config.baseUrl is required');
    if (!this.divisionCode) throw new Error('TdmsAdapter: config.divisionCode is required');
  }

  // ── Lifecycle ─────────────────────────────────────────────────
  async connect() {
    this.log.info('Connecting to TDMS', { baseUrl: this.baseUrl, division: this.divisionCode });
    if (!this.auth.token) {
      await this._login(); // Establish session cookie
    }
    const health = await this.healthCheck();
    if (!health.ok) throw new ConnectionError('TDMS health check failed after connect', { health });
    this._healthy = true;
    this.log.info('TDMS connection established');
  }

  async disconnect() {
    if (this._sessionCookie) {
      try {
        await this.fetchWithTimeout(`${this.baseUrl}/session/logout`, {
          method:  'POST',
          headers: this._buildHeaders(),
        });
        this.log.info('TDMS session logged out');
      } catch (err) {
        this.log.warn('TDMS logout request failed (ignoring)', { error: err.message });
      }
      this._sessionCookie = null;
    }
    await super.disconnect();
  }

  async healthCheck() {
    const t0 = Date.now();
    try {
      await this._ensureSession();
      const res = await this.fetchWithTimeout(`${this.baseUrl}/api/status`, {
        headers: this._buildHeaders(),
      });
      return { ok: res.status === 200, latencyMs: Date.now() - t0, details: { httpStatus: res.status } };
    } catch (err) {
      return { ok: false, latencyMs: Date.now() - t0, details: { error: err.message } };
    }
  }

  // ── Authentication (session cookie) ──────────────────────────
  async _login() {
    const { username, password } = this.auth;
    if (!username || !password) {
      throw new AuthError('TDMS credentials (username/password) not configured');
    }
    this.log.debug('Logging into TDMS', { username });

    const body = JSON.stringify({ username, password, divisionCode: this.divisionCode });
    const res  = await this.fetchWithTimeout(`${this.baseUrl}/api/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    if (res.status === 401) throw new AuthError('TDMS login rejected — invalid credentials');
    if (!res.ok) throw new AuthError(`TDMS login returned HTTP ${res.status}`);

    // Capture Set-Cookie
    const setCookie = res.headers.get('set-cookie');
    if (!setCookie) throw new AuthError('TDMS login response did not set a session cookie');
    this._sessionCookie = setCookie.split(';')[0];
    this._sessionExpiry = Date.now() + this.SESSION_TTL_MS;
    this.log.info('TDMS session established');
  }

  async _ensureSession() {
    if (this.auth.token) return; // Using static JWT
    if (!this._sessionCookie || Date.now() >= this._sessionExpiry) {
      await this._login();
    }
  }

  _buildHeaders() {
    if (this.auth.token) {
      return {
        Authorization:  `Bearer ${this.auth.token}`,
        Accept:         'application/json',
        'Content-Type': 'application/json',
        'X-Division':   this.divisionCode,
      };
    }
    if (!this._sessionCookie) throw new AuthError('No TDMS session cookie available');
    return {
      Cookie:         this._sessionCookie,
      Accept:         'application/json',
      'Content-Type': 'application/json',
      'X-Division':   this.divisionCode,
    };
  }

  // ── Data Fetching ─────────────────────────────────────────────
  /**
   * @param {object} params
   * @param {string} [params.since]         - ISO-8601 cursor
   * @param {string} [params.status]        - Filter by defect status
   * @param {string} [params.category]      - RDSO category code (A–Z)
   * @param {number} [params.severityLevel] - 1, 2, or 3
   * @param {number} [params.limit]         - Default 300
   */
  async fetchRaw(params = {}, log) {
    await this._ensureSession();
    const { since, status, category, severityLevel, limit = 300 } = params;

    const qs = new URLSearchParams({ division: this.divisionCode, limit });
    if (since)         qs.set('modifiedAfter', since);
    if (status)        qs.set('status', status);
    if (category)      qs.set('category', category);
    if (severityLevel) qs.set('severityLevel', severityLevel);
    if (this.sectionFilter) qs.set('sectionId', this.sectionFilter);

    const url = `${this.baseUrl}/api/defects?${qs}`;
    log?.debug('Fetching TDMS defects', { url });

    const res = await this.fetchWithTimeout(url, {
      method:  'GET',
      headers: this._buildHeaders(),
    });

    if (res.status === 401 || res.status === 403) {
      // Force re-login on next attempt
      this._sessionCookie = null;
      throw new AuthError(`TDMS auth error (HTTP ${res.status}) — session may have expired`);
    }
    if (!res.ok) throw new ConnectionError(`TDMS returned HTTP ${res.status}`, { url });

    let body;
    try { body = await res.json(); }
    catch { throw new ParseError('TDMS response is not valid JSON'); }

    return body.defects ?? body.records ?? body;
  }

  // ── Validation ────────────────────────────────────────────────
  validate(r) {
    this._requireField(r, 'defectId',    'string');
    this._requireField(r, 'sectionId',   'string');
    this._requireField(r, 'category',    'string');
    this._requireField(r, 'detectedAt',  'string');

    if (!DEFECT_CATEGORIES[r.category]) {
      throw new ValidationError(
        `Unknown RDSO defect category: "${r.category}"`,
        { field: 'category', allowed: Object.keys(DEFECT_CATEGORIES) }
      );
    }

    if (r.severityLevel !== undefined) {
      const lvl = Number(r.severityLevel);
      if (![1, 2, 3].includes(lvl)) {
        throw new ValidationError('severityLevel must be 1, 2, or 3', { value: r.severityLevel });
      }
    }

    if (r.status && !Object.values(DEFECT_STATUS).includes(r.status)) {
      throw new ValidationError(`Unknown status: "${r.status}"`, { field: 'status' });
    }

    // Validate measurement value (e.g. gauge deviation in mm)
    if (r.measurementValue !== undefined && typeof r.measurementValue !== 'number') {
      throw new ValidationError('measurementValue must be a number', { value: r.measurementValue });
    }

    // Validate chainage
    if (r.chainageKm !== undefined && (typeof r.chainageKm !== 'number' || r.chainageKm < 0)) {
      throw new ValidationError('chainageKm must be a non-negative number', { value: r.chainageKm });
    }

    return {
      ...r,
      severityLevel: r.severityLevel ? Number(r.severityLevel) : null,
      detectedAt:    this._coerceDate(r.detectedAt, 'detectedAt'),
      rectifiedAt:   r.rectifiedAt ? this._coerceDate(r.rectifiedAt, 'rectifiedAt') : null,
      closedAt:      r.closedAt    ? this._coerceDate(r.closedAt,    'closedAt')    : null,
    };
  }

  // ── Transform → Canonical Schema ──────────────────────────────
  transform(r) {
    const severityLabel = r.severityLevel ? SEVERITY_LEVEL[r.severityLevel] ?? 'UNKNOWN' : 'UNKNOWN';

    return {
      _source:       'TDMS',
      _ingestedAt:   new Date().toISOString(),
      _schemaVersion:'1.0',

      defectId:       r.defectId,
      sectionId:      r.sectionId,
      divisionCode:   r.divisionCode ?? this.divisionCode,
      zoneCode:       r.zoneCode ?? null,

      // Classification
      rdsoCategory:   r.category,
      categoryLabel:  DEFECT_CATEGORIES[r.category],
      severityLevel:  r.severityLevel,
      severityLabel,

      // Measurement
      measurementValue: r.measurementValue ?? null,
      measurementUnit:  r.measurementUnit  ?? null,
      permissibleLimit: r.permissibleLimit ?? null,
      deviation:        r.deviation        ?? null,   // excess over permissible

      // Location
      chainageKm:   r.chainageKm  ?? null,
      gpsLat:       r.gpsLat      ?? null,
      gpsLon:       r.gpsLon      ?? null,
      railSide:     r.railSide    ?? null,  // 'LEFT' | 'RIGHT' | 'BOTH'
      track:        r.track       ?? null,  // 'UP' | 'DOWN' | 'LOOP'

      // Status & lifecycle
      status:         r.status      ?? DEFECT_STATUS.OPEN,
      reportedBy:     r.reportedBy  ?? null,
      assignedTo:     r.assignedTo  ?? null,
      workOrderId:    r.workOrderId ?? null,
      remarks:        r.remarks     ?? null,

      // Speed restriction raised (if any)
      speedRestriction: r.speedRestriction
        ? {
            limitKmh:    r.speedRestriction.limitKmh,
            imposedAt:   r.speedRestriction.imposedAt
              ? this._coerceDate(r.speedRestriction.imposedAt, 'speedRestriction.imposedAt')
              : null,
            liftedAt:    r.speedRestriction.liftedAt
              ? this._coerceDate(r.speedRestriction.liftedAt, 'speedRestriction.liftedAt')
              : null,
          }
        : null,

      // Timestamps
      detectedAt:  r.detectedAt,
      rectifiedAt: r.rectifiedAt,
      closedAt:    r.closedAt,

      _raw: r,
    };
  }
}

// ── Factory ───────────────────────────────────────────────────────
/**
 * Required env vars:
 *   TDMS_BASE_URL, TDMS_DIVISION_CODE
 * Auth (one of):
 *   TDMS_USERNAME + TDMS_PASSWORD   (session-cookie mode)
 *   TDMS_TOKEN                      (JWT mode)
 * Optional:
 *   TDMS_SECTION_FILTER, TDMS_TIMEOUT_MS
 */
function createTdmsAdapter(overrides = {}) {
  return new TdmsAdapter({
    baseUrl:       process.env.TDMS_BASE_URL,
    divisionCode:  process.env.TDMS_DIVISION_CODE,
    sectionFilter: process.env.TDMS_SECTION_FILTER,
    timeoutMs:     Number(process.env.TDMS_TIMEOUT_MS ?? 12_000),
    auth: {
      username: process.env.TDMS_USERNAME,
      password: process.env.TDMS_PASSWORD,
      token:    process.env.TDMS_TOKEN,
    },
    retry: { maxAttempts: 3, baseDelayMs: 1000 },
    ...overrides,
  });
}

module.exports = {
  TdmsAdapter, createTdmsAdapter,
  DEFECT_CATEGORIES, SEVERITY_LEVEL, DEFECT_STATUS,
};
