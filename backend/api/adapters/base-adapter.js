/**
 * base-adapter.js
 * ─────────────────────────────────────────────────────────────────
 * Abstract base class for all Indian Railways data source adapters.
 * Provides shared infrastructure:
 *   - Structured JSON logging with correlation IDs
 *   - Token / API-key authentication helpers
 *   - Exponential-backoff retry logic
 *   - Schema validation scaffold (Zod-compatible shape)
 *   - Normalised error taxonomy
 *   - Adapter lifecycle hooks (connect / disconnect / healthCheck)
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

const crypto = require('crypto');

// ── Error taxonomy ────────────────────────────────────────────────
class AdapterError extends Error {
  /**
   * @param {string} code   - Machine-readable error code (UPPER_SNAKE)
   * @param {string} message
   * @param {object} [meta] - Arbitrary context attached to the error
   */
  constructor(code, message, meta = {}) {
    super(message);
    this.name      = 'AdapterError';
    this.code      = code;
    this.meta      = meta;
    this.timestamp = new Date().toISOString();
  }
}

class AuthError        extends AdapterError { constructor(msg, meta) { super('AUTH_FAILURE',        msg, meta); this.name = 'AuthError'; } }
class ValidationError  extends AdapterError { constructor(msg, meta) { super('VALIDATION_FAILURE',  msg, meta); this.name = 'ValidationError'; } }
class ConnectionError  extends AdapterError { constructor(msg, meta) { super('CONNECTION_FAILURE',  msg, meta); this.name = 'ConnectionError'; } }
class TimeoutError     extends AdapterError { constructor(msg, meta) { super('TIMEOUT',             msg, meta); this.name = 'TimeoutError'; } }
class RateLimitError   extends AdapterError { constructor(msg, meta) { super('RATE_LIMITED',        msg, meta); this.name = 'RateLimitError'; } }
class ParseError       extends AdapterError { constructor(msg, meta) { super('PARSE_FAILURE',       msg, meta); this.name = 'ParseError'; } }

// ── Structured logger ─────────────────────────────────────────────
class Logger {
  constructor(adapterName) {
    this.adapter = adapterName;
  }

  _write(level, message, fields = {}) {
    const entry = {
      ts:      new Date().toISOString(),
      level,
      adapter: this.adapter,
      message,
      ...fields,
    };
    // In production replace with winston / pino
    const output = JSON.stringify(entry);
    if (level === 'error' || level === 'warn') {
      process.stderr.write(output + '\n');
    } else {
      process.stdout.write(output + '\n');
    }
  }

  debug(message, fields)  { this._write('debug',  message, fields); }
  info (message, fields)  { this._write('info',   message, fields); }
  warn (message, fields)  { this._write('warn',   message, fields); }
  error(message, fields)  { this._write('error',  message, fields); }

  /** Attach a correlation / trace ID to every log for this request */
  child(correlationId) {
    const child = new Logger(this.adapter);
    const orig  = child._write.bind(child);
    child._write = (level, message, fields = {}) =>
      orig(level, message, { correlation_id: correlationId, ...fields });
    return child;
  }
}

// ── Retry helper ──────────────────────────────────────────────────
/**
 * Executes `fn` with exponential back-off.
 * @param {Function} fn              - Async function to retry
 * @param {object}   opts
 * @param {number}   opts.maxAttempts  - Default 3
 * @param {number}   opts.baseDelayMs  - Default 500
 * @param {number}   opts.maxDelayMs   - Default 15_000
 * @param {Function} opts.isRetryable  - (err) => bool. Defaults to always retry.
 * @param {object}   opts.logger
 */
async function withRetry(fn, opts = {}) {
  const {
    maxAttempts = 3,
    baseDelayMs = 500,
    maxDelayMs  = 15_000,
    isRetryable = () => true,
    logger      = console,
  } = opts;

  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      if (attempt === maxAttempts || !isRetryable(err)) throw err;
      const jitter   = Math.random() * 200;
      const delay    = Math.min(baseDelayMs * 2 ** (attempt - 1) + jitter, maxDelayMs);
      logger.warn?.(`Retry ${attempt}/${maxAttempts} after ${Math.round(delay)}ms`, {
        error_code: err.code,
        error_msg:  err.message,
      });
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

// ── Base Adapter ──────────────────────────────────────────────────
class BaseAdapter {
  /**
   * @param {object} config
   * @param {string} config.adapterName   - e.g. 'TMS'
   * @param {object} config.auth          - Auth credentials / config
   * @param {object} [config.retry]       - Retry options (see withRetry)
   * @param {number} [config.timeoutMs]   - Request timeout (default 10_000)
   */
  constructor(config = {}) {
    if (!config.adapterName) throw new Error('adapterName is required');
    this.adapterName = config.adapterName;
    this.auth        = config.auth   || {};
    this.retryOpts   = config.retry  || {};
    this.timeoutMs   = config.timeoutMs ?? 10_000;
    this.log         = new Logger(config.adapterName);
    this._healthy    = false;
  }

  // ── Lifecycle ────────────────────────────────────────────────
  /** Override in subclass to open connections, load tokens etc. */
  async connect() {
    throw new Error(`${this.adapterName}.connect() not implemented`);
  }

  /** Override in subclass to release resources gracefully */
  async disconnect() {
    this.log.info('Disconnecting adapter');
    this._healthy = false;
  }

  /** Override in subclass — should return { ok, latencyMs, details } */
  async healthCheck() {
    return { ok: this._healthy, latencyMs: null, details: {} };
  }

  // ── Auth helpers ──────────────────────────────────────────────
  /**
   * Returns a Bearer token header value.
   * Subclasses should override _fetchToken() if using OAuth / JWT.
   */
  async getBearerToken() {
    if (this.auth.token) return `Bearer ${this.auth.token}`;
    const token = await this._fetchToken();
    return `Bearer ${token}`;
  }

  /** Override to implement token refresh (OAuth2 client_credentials etc.) */
  async _fetchToken() {
    throw new AuthError('No token or _fetchToken() implementation provided');
  }

  /** Build HMAC-SHA256 signature for API-key signed requests */
  buildHmacSignature(payload, secret) {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  // ── Validation ────────────────────────────────────────────────
  /**
   * Validates a raw data record against the adapter's schema.
   * Subclasses MUST override this.
   * @param   {object} record - Raw record from the source system
   * @returns {object}        - Cleaned / coerced record
   * @throws  {ValidationError}
   */
  // eslint-disable-next-line no-unused-vars
  validate(record) {
    throw new Error(`${this.adapterName}.validate() not implemented`);
  }

  /**
   * Helper: asserts a required field is present and non-empty.
   * @param {object} record
   * @param {string} field
   * @param {string} [type] - Optional JS typeof string
   */
  _requireField(record, field, type) {
    if (record[field] === undefined || record[field] === null || record[field] === '') {
      throw new ValidationError(`Missing required field: ${field}`, { field, record });
    }
    if (type && typeof record[field] !== type) {
      throw new ValidationError(
        `Field "${field}" must be ${type}, got ${typeof record[field]}`,
        { field, expected: type, actual: typeof record[field] }
      );
    }
  }

  /**
   * Helper: coerces a value to ISO-8601 date string or throws.
   */
  _coerceDate(value, fieldName) {
    const d = new Date(value);
    if (isNaN(d.getTime())) {
      throw new ValidationError(`Invalid date for field "${fieldName}": ${value}`, { fieldName, value });
    }
    return d.toISOString();
  }

  // ── Fetch with timeout ────────────────────────────────────────
  /**
   * Wraps the global fetch with a timeout AbortController.
   * Falls back to node-fetch if native fetch unavailable.
   */
  async fetchWithTimeout(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const fetch = globalThis.fetch ?? require('node-fetch');
      const res = await fetch(url, { ...options, signal: controller.signal });
      return res;
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new TimeoutError(`Request to ${url} timed out after ${this.timeoutMs}ms`);
      }
      throw new ConnectionError(`Network error reaching ${url}: ${err.message}`);
    } finally {
      clearTimeout(timer);
    }
  }

  // ── Main ingest pipeline ─────────────────────────────────────
  /**
   * High-level method: fetch → validate → transform → emit.
   * Subclasses override fetchRaw(), validate(), and transform().
   * @param {object} [params] - Source-specific query parameters
   * @returns {Promise<object[]>} Normalised records
   */
  async ingest(params = {}) {
    const correlationId = crypto.randomUUID();
    const log = this.log.child(correlationId);
    log.info('Ingest started', { params });

    const raw = await withRetry(() => this.fetchRaw(params, log), {
      ...this.retryOpts,
      logger: log,
      isRetryable: err => !(err instanceof ValidationError || err instanceof AuthError),
    });

    log.info('Raw data fetched', { record_count: Array.isArray(raw) ? raw.length : 1 });

    const results = [];
    const errors  = [];

    for (const record of (Array.isArray(raw) ? raw : [raw])) {
      try {
        const validated  = this.validate(record);
        const normalised = this.transform(validated);
        results.push(normalised);
      } catch (err) {
        log.warn('Record skipped due to error', {
          error_code: err.code,
          error_msg:  err.message,
          record_id:  record?.id ?? record?.defectId ?? '(unknown)',
        });
        errors.push({ record, error: { code: err.code, message: err.message } });
      }
    }

    log.info('Ingest complete', {
      success_count: results.length,
      error_count:   errors.length,
    });

    return { correlationId, results, errors };
  }

  /**
   * Override to fetch raw data from the source system.
   * @param {object} params
   * @param {Logger} log
   * @returns {Promise<object|object[]>}
   */
  // eslint-disable-next-line no-unused-vars
  async fetchRaw(params, log) {
    throw new Error(`${this.adapterName}.fetchRaw() not implemented`);
  }

  /**
   * Override to transform a validated record into the platform's
   * canonical schema.
   * @param   {object} record - Validated record
   * @returns {object}        - Canonical record
   */
  transform(record) {
    // Default: pass-through; subclasses should override
    return record;
  }
}

// ── Exports ───────────────────────────────────────────────────────
module.exports = {
  BaseAdapter,
  AdapterError,
  AuthError,
  ValidationError,
  ConnectionError,
  TimeoutError,
  RateLimitError,
  ParseError,
  withRetry,
  Logger,
};
