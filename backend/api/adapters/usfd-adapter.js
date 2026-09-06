/**
 * usfd-adapter.js
 * ─────────────────────────────────────────────────────────────────
 * Adapter for the Ultrasonic Flaw Detection (USFD) System.
 *
 * Responsibilities:
 *   - Authenticate against the USFD data portal (API-key or
 *     certificate-based depending on RDSO/zonal deployment)
 *   - Parse and ingest USFD survey result files (JSON or CSV export)
 *     and real-time flaw alert events
 *   - Validate flaw records against IR/RDSO rail defect taxonomy
 *     and severity thresholds
 *   - Normalise into platform RailFlaw events with actionability score
 *
 * USFD provides:
 *   • Per-survey rail flaw detection results with rail type and position
 *   • Flaw category (A/B/C) with depth, width, and echo amplitude
 *   • Section-wise survey coverage timestamps
 *   • Repeat-detection flags (flaw seen in prior survey)
 *   • Rail renewal recommendations from USFD gang supervisor
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

// ── RDSO Rail Flaw Classification ─────────────────────────────────
// Based on RDSO Report No. CT-37 (Ultrasonic Testing of Rails)
const FLAW_CATEGORIES = Object.freeze({
  A: {
    label:  'Imminent fracture',
    action: 'CLOSE_SECTION',
    urgency: 1,
  },
  B: {
    label:  'Propagating flaw — prone to fracture',
    action: 'SPEED_RESTRICTION_10',
    urgency: 2,
  },
  C: {
    label:  'Flaw detectable — under observation',
    action: 'ENHANCED_MONITORING',
    urgency: 3,
  },
});

// Rail defect type codes per RDSO classification
const DEFECT_TYPES = Object.freeze([
  'TRANSVERSE_FISSURE',       // Most dangerous — perpendicular to rail axis
  'LONGITUDINAL_FISSURE',
  'DETAIL_FRACTURE',
  'SHELL_AND_FLAKING',
  'HEAD_CHECK',
  'RAIL_FOOT_CRACK',
  'BOLT_HOLE_CRACK',
  'CORROSION_FATIGUE',
  'WELD_DEFECT',
  'SQUAT',
  'CRUSHED_HEAD',
  'OTHER',
]);

const RAIL_POSITION = Object.freeze({ UP: 'UP', DOWN: 'DOWN', LOOP: 'LOOP' });
const RAIL_SIDE     = Object.freeze({ LEFT: 'LEFT', RIGHT: 'RIGHT' });

// ── USFD Adapter ──────────────────────────────────────────────────
class UsfdAdapter extends BaseAdapter {
  /**
   * @param {object} config
   * @param {string} config.auth.apiKey       - USFD portal API key
   * @param {string} [config.auth.certPem]    - Client certificate PEM string
   * @param {string} [config.auth.keyPem]     - Client key PEM string
   * @param {string} config.baseUrl
   * @param {string} config.zone
   * @param {string} [config.division]
   * @param {number} [config.flawCategoryFilter] - Min urgency to ingest: 1,2,3
   * @param {object} [config.retry]
   * @param {number} [config.timeoutMs]
   */
  constructor(config = {}) {
    super({ adapterName: 'USFD', ...config });
    this.baseUrl             = config.baseUrl;
    this.zone                = config.zone;
    this.division            = config.division ?? null;
    this.flawCategoryFilter  = config.flawCategoryFilter ?? 3; // All categories

    if (!this.baseUrl) throw new Error('UsfdAdapter: config.baseUrl is required');
    if (!this.zone)    throw new Error('UsfdAdapter: config.zone is required');
    if (!this.auth.apiKey) throw new Error('UsfdAdapter: config.auth.apiKey is required');
  }

  // ── Lifecycle ─────────────────────────────────────────────────
  async connect() {
    this.log.info('Connecting to USFD portal', { baseUrl: this.baseUrl });
    const health = await this.healthCheck();
    if (!health.ok) throw new ConnectionError('USFD health check failed', { health });
    this._healthy = true;
    this.log.info('USFD connection established', { latencyMs: health.latencyMs });
  }

  async healthCheck() {
    const t0 = Date.now();
    try {
      const res = await this.fetchWithTimeout(`${this.baseUrl}/health`, {
        headers: this._buildHeaders(),
      });
      return { ok: res.ok, latencyMs: Date.now() - t0, details: { httpStatus: res.status } };
    } catch (err) {
      return { ok: false, latencyMs: Date.now() - t0, details: { error: err.message } };
    }
  }

  // ── Authentication ────────────────────────────────────────────
  _buildHeaders() {
    if (!this.auth.apiKey) throw new AuthError('USFD apiKey not configured');
    return {
      'X-Api-Key':   this.auth.apiKey,
      'X-Zone':      this.zone,
      Accept:        'application/json',
      'Content-Type':'application/json',
      ...(this.division && { 'X-Division': this.division }),
    };
  }

  // ── Data Fetching ─────────────────────────────────────────────
  /**
   * @param {object} params
   * @param {string} [params.since]       - ISO-8601 survey cursor
   * @param {string} [params.sectionId]   - Filter to section
   * @param {string} [params.flawCategory]- Filter by A / B / C
   * @param {number} [params.limit]       - Default 500
   */
  async fetchRaw(params = {}, log) {
    const { since, sectionId, flawCategory, limit = 500 } = params;

    const qs = new URLSearchParams({ zone: this.zone, limit });
    if (since)        qs.set('surveyedAfter', since);
    if (sectionId)    qs.set('sectionId', sectionId);
    if (flawCategory) qs.set('flawCategory', flawCategory);
    if (this.division) qs.set('division', this.division);

    const url = `${this.baseUrl}/v1/usfd/flaws?${qs}`;
    log?.debug('Fetching USFD flaws', { url });

    const res = await this.fetchWithTimeout(url, {
      headers: this._buildHeaders(),
    });

    if (res.status === 401) throw new AuthError('USFD API key rejected');
    if (!res.ok) throw new ConnectionError(`USFD returned HTTP ${res.status}`, { url });

    let body;
    try { body = await res.json(); }
    catch { throw new ParseError('USFD response is not valid JSON'); }

    const flaws = body.flaws ?? body.data ?? body;

    // Client-side urgency filter
    return flaws.filter(f =>
      !f.flawCategory ||
      (FLAW_CATEGORIES[f.flawCategory]?.urgency ?? 99) <= this.flawCategoryFilter
    );
  }

  // ── Validation ────────────────────────────────────────────────
  validate(r) {
    this._requireField(r, 'flawId',     'string');
    this._requireField(r, 'sectionId',  'string');
    this._requireField(r, 'surveyedAt', 'string');
    this._requireField(r, 'chainageKm', 'number');
    this._requireField(r, 'flawCategory');

    if (!FLAW_CATEGORIES[r.flawCategory]) {
      throw new ValidationError(
        `Unknown flawCategory: "${r.flawCategory}"`,
        { field: 'flawCategory', allowed: Object.keys(FLAW_CATEGORIES) }
      );
    }

    if (r.defectType && !DEFECT_TYPES.includes(r.defectType)) {
      throw new ValidationError(
        `Unknown defectType: "${r.defectType}"`,
        { field: 'defectType', allowed: DEFECT_TYPES }
      );
    }

    if (r.railSide && !Object.values(RAIL_SIDE).includes(r.railSide)) {
      throw new ValidationError(`Unknown railSide: "${r.railSide}"`, { field: 'railSide' });
    }

    if (r.railPosition && !Object.values(RAIL_POSITION).includes(r.railPosition)) {
      throw new ValidationError(`Unknown railPosition: "${r.railPosition}"`, { field: 'railPosition' });
    }

    // Amplitude in dB — must be numeric if provided
    if (r.echoAmplitudeDb !== undefined && typeof r.echoAmplitudeDb !== 'number') {
      throw new ValidationError('echoAmplitudeDb must be a number', { value: r.echoAmplitudeDb });
    }

    // Cross-section depth/width as percentage of rail cross-section
    if (r.depthPct !== undefined && (r.depthPct < 0 || r.depthPct > 100)) {
      throw new ValidationError('depthPct must be 0–100', { value: r.depthPct });
    }

    return {
      ...r,
      surveyedAt:  this._coerceDate(r.surveyedAt, 'surveyedAt'),
      confirmedAt: r.confirmedAt ? this._coerceDate(r.confirmedAt, 'confirmedAt') : null,
    };
  }

  // ── Transform → Canonical Schema ──────────────────────────────
  transform(r) {
    const cat = FLAW_CATEGORIES[r.flawCategory];

    // Actionability score: 0–100, inversely related to urgency
    const actionabilityScore = { 1: 100, 2: 70, 3: 40 }[cat.urgency] ?? 20;

    return {
      _source:        'USFD',
      _ingestedAt:    new Date().toISOString(),
      _schemaVersion: '1.0',

      flawId:         r.flawId,
      sectionId:      r.sectionId,
      zone:           r.zone ?? this.zone,
      division:       r.division ?? this.division,

      // Flaw classification
      flawCategory:       r.flawCategory,
      flawCategoryLabel:  cat.label,
      recommendedAction:  cat.action,
      urgency:            cat.urgency,         // 1 = most urgent
      actionabilityScore,                      // For AI risk ranking

      defectType:         r.defectType  ?? null,
      isRepeatDetection:  r.isRepeatDetection ?? false,

      // Measurement data
      echoAmplitudeDb:    r.echoAmplitudeDb ?? null,
      depthPct:           r.depthPct        ?? null,
      widthMm:            r.widthMm         ?? null,
      railSection:        r.railSection     ?? null,  // e.g. '60kg/m'

      // Location
      chainageKm:     r.chainageKm,
      railSide:       r.railSide     ?? null,
      railPosition:   r.railPosition ?? null,
      gpsLat:         r.gpsLat       ?? null,
      gpsLon:         r.gpsLon       ?? null,

      // Survey metadata
      surveyTeamId:   r.surveyTeamId ?? null,
      equipmentId:    r.equipmentId  ?? null,  // USFD trolley/vehicle ID
      operatorId:     r.operatorId   ?? null,
      supervisorId:   r.supervisorId ?? null,
      remarks:        r.remarks      ?? null,

      // Status
      status:      r.status      ?? 'OPEN',
      confirmedAt: r.confirmedAt ?? null,
      confirmedBy: r.confirmedBy ?? null,

      // Timestamps
      surveyedAt:   r.surveyedAt,

      _raw: r,
    };
  }
}

// ── Factory ───────────────────────────────────────────────────────
/**
 * Required env vars: USFD_BASE_URL, USFD_ZONE, USFD_API_KEY
 * Optional: USFD_DIVISION, USFD_FLAW_CATEGORY_FILTER (1|2|3), USFD_TIMEOUT_MS
 */
function createUsfdAdapter(overrides = {}) {
  return new UsfdAdapter({
    baseUrl:            process.env.USFD_BASE_URL,
    zone:               process.env.USFD_ZONE,
    division:           process.env.USFD_DIVISION,
    flawCategoryFilter: Number(process.env.USFD_FLAW_CATEGORY_FILTER ?? 3),
    timeoutMs:          Number(process.env.USFD_TIMEOUT_MS ?? 10_000),
    auth: { apiKey: process.env.USFD_API_KEY },
    retry: { maxAttempts: 3, baseDelayMs: 800 },
    ...overrides,
  });
}

module.exports = {
  UsfdAdapter, createUsfdAdapter,
  FLAW_CATEGORIES, DEFECT_TYPES, RAIL_POSITION, RAIL_SIDE,
};
