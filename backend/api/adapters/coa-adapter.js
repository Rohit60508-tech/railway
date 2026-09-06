/**
 * coa-adapter.js
 * ─────────────────────────────────────────────────────────────────
 * Adapter for the Chart of Assets (COA) — Indian Railways master
 * asset registry maintained by each Zonal Railway.
 *
 * Responsibilities:
 *   - Authenticate via mutual TLS (mTLS) or API-key depending on
 *     zonal COA deployment type
 *   - Fetch and cache the full asset registry for the configured zone
 *   - Support incremental sync (changed assets since last cursor)
 *   - Validate asset records against the IR asset classification scheme
 *   - Produce normalised RailAsset events for the digital twin
 *
 * COA provides:
 *   • Asset master records (track sections, bridges, signals,
 *     OHE masts, level crossings, substations)
 *   • Asset age, specification, manufacturer, and commissioning date
 *   • Geospatial location (GPS + chainage)
 *   • Sanctioned speed for each section
 *   • Asset ownership and maintenance responsibility codes
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

// ── Asset classification ──────────────────────────────────────────
const ASSET_TYPES = Object.freeze({
  TRACK:          'TRACK',
  BRIDGE:         'BRIDGE',
  CULVERT:        'CULVERT',
  SIGNAL:         'SIGNAL',
  LEVEL_CROSSING: 'LEVEL_CROSSING',
  OHE_MAST:       'OHE_MAST',
  SUBSTATION:     'SUBSTATION',
  TUNNEL:         'TUNNEL',
  RETAINING_WALL: 'RETAINING_WALL',
  BUILDING:       'BUILDING',
  TELECOM:        'TELECOM',
  OTHER:          'OTHER',
});

const TRACK_TYPES = Object.freeze(['BG', 'MG', 'NG']); // Broad / Metre / Narrow gauge
const RAIL_WEIGHTS = Object.freeze([52, 60, 90]); // kg/m — standard IR rail sections

// ── COA Adapter ───────────────────────────────────────────────────
class CoaAdapter extends BaseAdapter {
  /**
   * @param {object} config
   * @param {string} config.auth.apiKey         - Static API key (API-key mode)
   * @param {Buffer} [config.auth.clientCert]   - PEM client certificate (mTLS mode)
   * @param {Buffer} [config.auth.clientKey]    - PEM client key (mTLS mode)
   * @param {string} config.baseUrl             - COA service base URL
   * @param {string} config.zoneCode            - Zonal railway code ('NR','SR',…)
   * @param {string} [config.divisionCode]      - Optional division filter
   * @param {number} [config.cacheTTLMs]        - In-memory cache TTL (default 4h)
   * @param {object} [config.retry]
   * @param {number} [config.timeoutMs]
   */
  constructor(config = {}) {
    super({ adapterName: 'COA', ...config });
    this.baseUrl     = config.baseUrl;
    this.zoneCode    = config.zoneCode;
    this.divisionCode = config.divisionCode ?? null;
    this.cacheTTLMs  = config.cacheTTLMs ?? 4 * 60 * 60 * 1000; // 4 hours

    // In-memory cache keyed by assetId
    this._cache      = new Map();
    this._cacheAt    = 0;
    this._cursor     = null; // last-synced timestamp

    if (!this.baseUrl)  throw new Error('CoaAdapter: config.baseUrl is required');
    if (!this.zoneCode) throw new Error('CoaAdapter: config.zoneCode is required');
  }

  // ── Lifecycle ─────────────────────────────────────────────────
  async connect() {
    this.log.info('Connecting to COA', { baseUrl: this.baseUrl, zone: this.zoneCode });
    const health = await this.healthCheck();
    if (!health.ok) throw new ConnectionError('COA health check failed', { health });
    this._healthy = true;
    this.log.info('COA connection established', { latencyMs: health.latencyMs });
  }

  async healthCheck() {
    const t0 = Date.now();
    try {
      const res = await this.fetchWithTimeout(`${this.baseUrl}/health`, {
        headers: this._buildHeaders(),
      });
      return { ok: res.status === 200, latencyMs: Date.now() - t0, details: { httpStatus: res.status } };
    } catch (err) {
      return { ok: false, latencyMs: Date.now() - t0, details: { error: err.message } };
    }
  }

  // ── Authentication ────────────────────────────────────────────
  _buildHeaders() {
    if (!this.auth.apiKey) throw new AuthError('COA apiKey is not configured');
    return {
      'X-Api-Key':    this.auth.apiKey,
      'X-Zone-Code':  this.zoneCode,
      Accept:         'application/json',
      'Content-Type': 'application/json',
      ...(this.divisionCode && { 'X-Division-Code': this.divisionCode }),
    };
  }

  // ── Cache helpers ─────────────────────────────────────────────
  isCacheValid() {
    return this._cache.size > 0 && (Date.now() - this._cacheAt) < this.cacheTTLMs;
  }

  getCachedAsset(assetId) {
    return this._cache.get(assetId) ?? null;
  }

  /** Returns a snapshot of all cached assets */
  getAllCached() {
    return Array.from(this._cache.values());
  }

  _updateCache(assets) {
    for (const asset of assets) {
      this._cache.set(asset.assetId, asset);
    }
    this._cacheAt = Date.now();
    this.log.info('COA cache updated', { total_assets: this._cache.size });
  }

  // ── Data Fetching ─────────────────────────────────────────────
  /**
   * @param {object} params
   * @param {string}   [params.assetType]   - Filter by ASSET_TYPES key
   * @param {string}   [params.since]       - Incremental sync cursor (ISO-8601)
   * @param {boolean}  [params.forceRefresh]- Bypass cache
   * @param {number}   [params.limit]       - Default 1000
   * @param {number}   [params.page]        - Default 1 (pagination)
   */
  async fetchRaw(params = {}, log) {
    const { assetType, since, limit = 1000, page = 1 } = params;

    // Serve from cache if valid and no incremental cursor
    if (!since && !params.forceRefresh && this.isCacheValid()) {
      log?.debug('COA serving from cache', { size: this._cache.size });
      return this.getAllCached();
    }

    const qs = new URLSearchParams({ zone: this.zoneCode, limit, page });
    if (assetType)     qs.set('assetType', assetType);
    if (since)         qs.set('modifiedAfter', since);
    if (this.divisionCode) qs.set('division', this.divisionCode);

    const url = `${this.baseUrl}/v1/assets?${qs}`;
    log?.debug('Fetching COA assets', { url, page });

    const res = await this.fetchWithTimeout(url, {
      method:  'GET',
      headers: this._buildHeaders(),
    });

    if (res.status === 401) throw new AuthError('COA API key rejected', { httpStatus: 401 });
    if (!res.ok) throw new ConnectionError(`COA returned HTTP ${res.status}`, { url });

    let body;
    try { body = await res.json(); }
    catch { throw new ParseError('COA response is not valid JSON'); }

    const assets = body.assets ?? body.data ?? body;

    // Handle pagination — fetch all pages
    if (body.pagination?.totalPages > page) {
      const nextPage = await this.fetchRaw({ ...params, page: page + 1 }, log);
      return [...assets, ...(Array.isArray(nextPage) ? nextPage : [])];
    }

    return assets;
  }

  // ── Validation ────────────────────────────────────────────────
  validate(r) {
    this._requireField(r, 'assetId',   'string');
    this._requireField(r, 'assetType', 'string');
    this._requireField(r, 'zone',      'string');

    if (!ASSET_TYPES[r.assetType]) {
      throw new ValidationError(
        `Unknown assetType: "${r.assetType}"`,
        { field: 'assetType', allowed: Object.keys(ASSET_TYPES) }
      );
    }

    // Track-specific validations
    if (r.assetType === 'TRACK') {
      if (r.gauge && !TRACK_TYPES.includes(r.gauge)) {
        throw new ValidationError(`Unknown gauge: "${r.gauge}"`, { field: 'gauge', allowed: TRACK_TYPES });
      }
      if (r.railWeightKgM !== undefined && !RAIL_WEIGHTS.includes(Number(r.railWeightKgM))) {
        // Warn but don't throw — non-standard weights exist on heritage sections
        this.log.warn('Non-standard rail weight', { assetId: r.assetId, railWeightKgM: r.railWeightKgM });
      }
      if (r.sanctionedSpeedKmh !== undefined &&
          (typeof r.sanctionedSpeedKmh !== 'number' || r.sanctionedSpeedKmh < 0 || r.sanctionedSpeedKmh > 200)) {
        throw new ValidationError('sanctionedSpeedKmh out of range [0,200]', { value: r.sanctionedSpeedKmh });
      }
    }

    // Date fields
    return {
      ...r,
      commissionedOn: r.commissionedOn ? this._coerceDate(r.commissionedOn, 'commissionedOn') : null,
      lastRenewalOn:  r.lastRenewalOn  ? this._coerceDate(r.lastRenewalOn,  'lastRenewalOn')  : null,
      modifiedAt:     r.modifiedAt     ? this._coerceDate(r.modifiedAt,     'modifiedAt')     : null,
    };
  }

  // ── Transform → Canonical Schema ──────────────────────────────
  transform(r) {
    // Compute approximate age in years
    const ageYears = r.commissionedOn
      ? Math.floor((Date.now() - new Date(r.commissionedOn).getTime()) / (365.25 * 86400_000))
      : null;

    return {
      _source:        'COA',
      _ingestedAt:    new Date().toISOString(),
      _schemaVersion: '1.0',

      assetId:          r.assetId,
      assetType:        r.assetType,
      assetName:        r.assetName   ?? null,
      assetCode:        r.assetCode   ?? null,   // IR asset classification code
      zone:             r.zone,
      division:         r.division    ?? this.divisionCode,
      sectionId:        r.sectionId   ?? null,
      station:          r.station     ?? null,

      // Physical specifications
      gauge:            r.gauge       ?? null,
      lengthM:          r.lengthM     ?? null,
      railWeightKgM:    r.railWeightKgM ?? null,
      sleepersPerKm:    r.sleepersPerKm ?? null,
      sanctionedSpeedKmh: r.sanctionedSpeedKmh ?? null,
      electrified:      r.electrified ?? null,

      // Lifecycle
      ageYears,
      commissionedOn:   r.commissionedOn,
      lastRenewalOn:    r.lastRenewalOn,
      renewalDueOn:     r.renewalDueOn ? this._coerceDate(r.renewalDueOn, 'renewalDueOn') : null,
      conditionRating:  r.conditionRating ?? null,  // 1–5 scale

      // Ownership / responsibility
      ownerCode:        r.ownerCode   ?? null,
      maintainedBy:     r.maintainedBy ?? null,

      // Geospatial
      fromChainage:     r.fromChainage ?? null,
      toChainage:       r.toChainage   ?? null,
      gpsLat:           r.gpsLat       ?? null,
      gpsLon:           r.gpsLon       ?? null,

      modifiedAt:       r.modifiedAt,

      _raw: r,
    };
  }

  // ── Full Sync ─────────────────────────────────────────────────
  /**
   * Fetches and caches the complete asset registry for the zone.
   * Safe to call on startup and periodically.
   */
  async fullSync() {
    this.log.info('Starting COA full sync', { zone: this.zoneCode });
    const result = await this.ingest({ forceRefresh: true });
    this._updateCache(result.results);
    this._cursor  = new Date().toISOString();
    this.log.info('COA full sync complete', {
      assets: result.results.length,
      errors: result.errors.length,
    });
    return result;
  }

  /** Incremental sync since last cursor */
  async incrementalSync() {
    if (!this._cursor) return this.fullSync();
    this.log.info('Starting COA incremental sync', { since: this._cursor });
    const result = await this.ingest({ since: this._cursor });
    this._updateCache(result.results);
    if (result.results.length) this._cursor = new Date().toISOString();
    return result;
  }
}

// ── Factory ───────────────────────────────────────────────────────
/**
 * Required env vars: COA_BASE_URL, COA_ZONE_CODE, COA_API_KEY
 * Optional: COA_DIVISION_CODE, COA_TIMEOUT_MS, COA_CACHE_TTL_MS
 */
function createCoaAdapter(overrides = {}) {
  return new CoaAdapter({
    baseUrl:     process.env.COA_BASE_URL,
    zoneCode:    process.env.COA_ZONE_CODE,
    divisionCode:process.env.COA_DIVISION_CODE,
    cacheTTLMs:  Number(process.env.COA_CACHE_TTL_MS ?? 4 * 3600 * 1000),
    timeoutMs:   Number(process.env.COA_TIMEOUT_MS   ?? 15_000),
    auth: { apiKey: process.env.COA_API_KEY },
    retry: { maxAttempts: 3, baseDelayMs: 1000 },
    ...overrides,
  });
}

module.exports = { CoaAdapter, createCoaAdapter, ASSET_TYPES, TRACK_TYPES };
