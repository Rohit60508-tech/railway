/**
 * tms-adapter.js
 * ─────────────────────────────────────────────────────────────────
 * Adapter for the Train Management System (TMS).
 *
 * Responsibilities:
 *   - Authenticate against the TMS REST API using OAuth2
 *     client_credentials flow (token cached until expiry)
 *   - Poll the /defects and /trainMovements endpoints
 *   - Validate and normalise records into the platform's canonical
 *     TrainMovement and TrackDefect schemas
 *   - Emit data to the Integration Gateway event stream
 *
 * TMS provides:
 *   • Real-time train positions and headway data
 *   • Scheduled vs. actual departure/arrival times
 *   • Block section occupancy status
 *   • Speed restriction (ESR/TSR) active zones
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

// ── Constants ─────────────────────────────────────────────────────
const TMS_DEFECT_SEVERITY = Object.freeze({
  CRITICAL: 'CRITICAL',   // Immediate block closure required
  HIGH:     'HIGH',       // Attention within 4 hours
  MEDIUM:   'MEDIUM',     // Attention within 24 hours
  LOW:      'LOW',        // Routine maintenance cycle
});

const MOVEMENT_STATUS = Object.freeze({
  ON_TIME:  'ON_TIME',
  DELAYED:  'DELAYED',
  HALTED:   'HALTED',
  DIVERTED: 'DIVERTED',
  CANCELLED:'CANCELLED',
});

// ── TMS Adapter ───────────────────────────────────────────────────
class TmsAdapter extends BaseAdapter {
  /**
   * @param {object} config
   * @param {string} config.auth.clientId       - OAuth2 client ID
   * @param {string} config.auth.clientSecret   - OAuth2 client secret
   * @param {string} config.auth.tokenUrl       - Token endpoint URL
   * @param {string} config.baseUrl             - TMS API base URL
   * @param {string} [config.auth.scope]        - OAuth2 scope (optional)
   * @param {string} config.division            - Railway division code (e.g. 'NR/DLI')
   * @param {object} [config.retry]             - Retry options
   * @param {number} [config.timeoutMs]
   * @param {number} [config.pollIntervalMs]    - Polling interval (default 30_000)
   */
  constructor(config = {}) {
    super({ adapterName: 'TMS', ...config });

    this.baseUrl         = config.baseUrl;
    this.division        = config.division;
    this.pollIntervalMs  = config.pollIntervalMs ?? 30_000;

    // Token cache
    this._accessToken    = null;
    this._tokenExpiresAt = 0;
    this._pollTimer      = null;

    if (!this.baseUrl)  throw new Error('TmsAdapter: config.baseUrl is required');
    if (!this.division) throw new Error('TmsAdapter: config.division is required');
  }

  // ── Lifecycle ─────────────────────────────────────────────────
  async connect() {
    this.log.info('Connecting to TMS API', { baseUrl: this.baseUrl, division: this.division });
    await this._ensureToken();   // Fail fast if credentials are wrong
    const health = await this.healthCheck();
    if (!health.ok) {
      throw new ConnectionError('TMS health check failed after connect', { health });
    }
    this._healthy = true;
    this.log.info('TMS connection established', { latencyMs: health.latencyMs });
  }

  async disconnect() {
    this.log.info('Disconnecting from TMS');
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
    this._accessToken = null;
    await super.disconnect();
  }

  async healthCheck() {
    const t0 = Date.now();
    try {
      await this._ensureToken();
      const res = await this.fetchWithTimeout(`${this.baseUrl}/health`, {
        headers: { Authorization: await this.getBearerToken() },
      });
      const ok = res.status === 200;
      return { ok, latencyMs: Date.now() - t0, details: { httpStatus: res.status } };
    } catch (err) {
      this.log.error('TMS health check failed', { error: err.message });
      return { ok: false, latencyMs: Date.now() - t0, details: { error: err.message } };
    }
  }

  // ── Authentication ────────────────────────────────────────────
  async _fetchToken() {
    const { clientId, clientSecret, tokenUrl, scope = 'tms:read' } = this.auth;
    if (!clientId || !clientSecret || !tokenUrl) {
      throw new AuthError('TMS OAuth2 credentials incomplete', {
        hasClientId: !!clientId, hasSecret: !!clientSecret, hasTokenUrl: !!tokenUrl,
      });
    }

    this.log.debug('Fetching TMS OAuth2 token', { tokenUrl, scope });
    const body = new URLSearchParams({
      grant_type:    'client_credentials',
      client_id:     clientId,
      client_secret: clientSecret,
      scope,
    });

    const res = await this.fetchWithTimeout(tokenUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    body.toString(),
    });

    if (res.status === 401 || res.status === 403) {
      throw new AuthError('TMS token request rejected — check client credentials', {
        httpStatus: res.status,
      });
    }
    if (!res.ok) {
      throw new AuthError(`TMS token endpoint returned HTTP ${res.status}`, { httpStatus: res.status });
    }

    let payload;
    try {
      payload = await res.json();
    } catch {
      throw new ParseError('TMS token response is not valid JSON');
    }

    if (!payload.access_token) {
      throw new AuthError('TMS token response missing access_token', { payload });
    }

    this._accessToken    = payload.access_token;
    // Buffer 60 s before nominal expiry to avoid edge cases
    this._tokenExpiresAt = Date.now() + (payload.expires_in - 60) * 1000;

    this.log.info('TMS OAuth2 token acquired', {
      expires_in: payload.expires_in,
      scope:      payload.scope ?? scope,
    });
    return this._accessToken;
  }

  async getBearerToken() {
    await this._ensureToken();
    return `Bearer ${this._accessToken}`;
  }

  async _ensureToken() {
    if (!this._accessToken || Date.now() >= this._tokenExpiresAt) {
      await this._fetchToken();
    }
  }

  // ── Data Fetching ─────────────────────────────────────────────
  /**
   * @param {object} params
   * @param {string} [params.since]      - ISO-8601 cursor timestamp
   * @param {string} [params.sectionId] - Filter to a track section
   * @param {number} [params.limit]     - Max records (default 500)
   */
  async fetchRaw(params = {}, log) {
    const { since, sectionId, limit = 500 } = params;
    const qs = new URLSearchParams({ division: this.division, limit });
    if (since)     qs.set('since', since);
    if (sectionId) qs.set('sectionId', sectionId);

    const url = `${this.baseUrl}/v1/trains/movements?${qs}`;
    log?.debug('Fetching TMS movements', { url });

    const res = await this.fetchWithTimeout(url, {
      headers: {
        Authorization: await this.getBearerToken(),
        Accept:        'application/json',
        'X-Division':  this.division,
      },
    });

    if (res.status === 429) {
      const retryAfter = res.headers.get('Retry-After') ?? 30;
      throw new Error(`TMS rate-limited. Retry-After: ${retryAfter}s`);
    }
    if (!res.ok) {
      throw new ConnectionError(`TMS movements endpoint returned HTTP ${res.status}`, {
        httpStatus: res.status, url,
      });
    }

    let body;
    try { body = await res.json(); }
    catch { throw new ParseError('TMS response is not valid JSON'); }

    return body.data ?? body;
  }

  // ── Validation ────────────────────────────────────────────────
  /**
   * Validates a raw TMS train movement record.
   * @param {object} r - Raw record from TMS
   */
  validate(r) {
    this._requireField(r, 'trainNo',       'string');
    this._requireField(r, 'sectionId',     'string');
    this._requireField(r, 'divisionCode',  'string');
    this._requireField(r, 'timestamp',     'string');
    this._requireField(r, 'status');

    if (!Object.values(MOVEMENT_STATUS).includes(r.status)) {
      throw new ValidationError(
        `Unknown movement status: "${r.status}"`,
        { field: 'status', allowed: Object.values(MOVEMENT_STATUS) }
      );
    }

    if (r.speedKmh !== undefined && (typeof r.speedKmh !== 'number' || r.speedKmh < 0)) {
      throw new ValidationError('speedKmh must be a non-negative number', { value: r.speedKmh });
    }

    if (r.delayMinutes !== undefined && typeof r.delayMinutes !== 'number') {
      throw new ValidationError('delayMinutes must be a number', { value: r.delayMinutes });
    }

    return {
      ...r,
      timestamp: this._coerceDate(r.timestamp, 'timestamp'),
    };
  }

  // ── Transform → Canonical Schema ──────────────────────────────
  /**
   * Maps a validated TMS record to the platform's TrainMovement schema.
   */
  transform(r) {
    return {
      _source:       'TMS',
      _ingestedAt:   new Date().toISOString(),
      _schemaVersion:'1.0',

      // Identity
      trainNo:       r.trainNo,
      divisionCode:  r.divisionCode,
      sectionId:     r.sectionId,

      // Status
      status:        r.status,
      speedKmh:      r.speedKmh ?? null,
      delayMinutes:  r.delayMinutes ?? 0,
      headwaySeconds:r.headwaySeconds ?? null,

      // Location
      gpsLat:        r.gpsLat ?? null,
      gpsLon:        r.gpsLon ?? null,
      chainage:      r.chainage ?? null,      // km from section origin

      // Speed restrictions active on this train
      activeEsr: Array.isArray(r.activeEsr) ? r.activeEsr.map(esr => ({
        sectionId:   esr.sectionId,
        limitKmh:    esr.limitKmh,
        reason:      esr.reason ?? null,
        imposedAt:   esr.imposedAt ? this._coerceDate(esr.imposedAt, 'esr.imposedAt') : null,
      })) : [],

      // Timestamps
      timestamp:          r.timestamp,
      scheduledArrival:   r.scheduledArrival   ? this._coerceDate(r.scheduledArrival,   'scheduledArrival')   : null,
      actualArrival:      r.actualArrival       ? this._coerceDate(r.actualArrival,       'actualArrival')      : null,
      scheduledDeparture: r.scheduledDeparture  ? this._coerceDate(r.scheduledDeparture,  'scheduledDeparture') : null,
      actualDeparture:    r.actualDeparture     ? this._coerceDate(r.actualDeparture,     'actualDeparture')    : null,

      // Raw passthrough for debugging
      _raw: r,
    };
  }

  // ── Polling ───────────────────────────────────────────────────
  /**
   * Starts a polling loop, calling `onData(result)` each cycle.
   * @param {Function} onData   - Async callback receiving { correlationId, results, errors }
   * @param {object}  [params]  - Query params forwarded to fetchRaw
   */
  startPolling(onData, params = {}) {
    if (this._pollTimer) throw new Error('TmsAdapter polling already started');
    this.log.info('TMS polling started', { intervalMs: this.pollIntervalMs });

    let cursor = params.since ?? new Date(Date.now() - 60_000).toISOString();

    const poll = async () => {
      try {
        const result = await this.ingest({ ...params, since: cursor });
        if (result.results.length > 0) {
          cursor = result.results.at(-1).timestamp;
          await onData(result);
        }
      } catch (err) {
        this.log.error('TMS poll cycle failed', { error_code: err.code, error_msg: err.message });
      }
    };

    poll(); // immediate first run
    this._pollTimer = setInterval(poll, this.pollIntervalMs);
  }

  stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
      this.log.info('TMS polling stopped');
    }
  }
}

// ── Factory / default export ──────────────────────────────────────
/**
 * Creates a ready-to-use TmsAdapter from environment variables.
 *
 * Required env vars:
 *   TMS_BASE_URL, TMS_CLIENT_ID, TMS_CLIENT_SECRET,
 *   TMS_TOKEN_URL, TMS_DIVISION
 *
 * Optional:
 *   TMS_SCOPE, TMS_TIMEOUT_MS, TMS_POLL_INTERVAL_MS
 */
function createTmsAdapter(overrides = {}) {
  return new TmsAdapter({
    baseUrl:       process.env.TMS_BASE_URL,
    division:      process.env.TMS_DIVISION,
    pollIntervalMs:Number(process.env.TMS_POLL_INTERVAL_MS ?? 30_000),
    timeoutMs:     Number(process.env.TMS_TIMEOUT_MS       ?? 10_000),
    auth: {
      clientId:     process.env.TMS_CLIENT_ID,
      clientSecret: process.env.TMS_CLIENT_SECRET,
      tokenUrl:     process.env.TMS_TOKEN_URL,
      scope:        process.env.TMS_SCOPE ?? 'tms:read',
    },
    retry: {
      maxAttempts: 3,
      baseDelayMs: 500,
    },
    ...overrides,
  });
}

module.exports = { TmsAdapter, createTmsAdapter, TMS_DEFECT_SEVERITY, MOVEMENT_STATUS };
