/**
 * log-aggregator.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Indian Railways AI Maintenance Platform - Centralized Log Collection
 * 
 * Aggregates, correlates, and indexes structured log streams across:
 *   - Node.js AI API Gateway & Service Connector
 *   - Python AI Inference Microservices (Priority, Traffic, Optimizer)
 *   - Data Source Adapters (TMS, TDMS, SMMS, USFD, COA)
 *   - Security & Audit Trails (Authentication, Rate limits, Manual Overrides)
 * 
 * Capabilities:
 *   - Unified schema with correlationId, subsystem, level, and timestamp
 *   - Circular in-memory ring buffer (5,000 logs) for instant query & UI inspection
 *   - Search & filter by level (DEBUG, INFO, WARN, ERROR, SECURITY), subsystem, keyword
 *   - Daily file append stream with automatic log rotation
 *   - Forwarding of SECURITY & AUDIT logs to Railway SOC SIEM pipeline
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Log Levels
const LogLevel = Object.freeze({
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
  SECURITY: 'SECURITY',
  AUDIT: 'AUDIT',
});

class LogAggregator extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      bufferSize: options.bufferSize || 5000,
      logDir: options.logDir || path.resolve(__dirname, '..', '..', 'ai-models', 'logs'),
      logFileNamePrefix: options.logFileNamePrefix || 'ir_ai_system',
      socForwardingEnabled: options.socForwardingEnabled !== false,
      ...options,
    };

    // Circular Ring Buffer
    this.ringBuffer = [];
    this.logFileStream = null;
    this.currentLogDate = null;

    this._initializeLogDirectory();
  }

  /**
   * Initializes log directory and sets up the active daily write stream.
   */
  _initializeLogDirectory() {
    try {
      if (!fs.existsSync(this.options.logDir)) {
        fs.mkdirSync(this.options.logDir, { recursive: true });
      }
      this._rotateFileStream();
    } catch (err) {
      console.error('[LogAggregator] Failed to initialize log directory:', err.message);
    }
  }

  /**
   * Rotates log write stream daily (YYYY-MM-DD).
   */
  _rotateFileStream() {
    const today = new Date().toISOString().split('T')[0];
    if (this.currentLogDate === today && this.logFileStream) return;

    if (this.logFileStream) {
      try { this.logFileStream.end(); } catch (_) {}
    }

    this.currentLogDate = today;
    const logFilePath = path.join(this.options.logDir, `${this.options.logFileNamePrefix}_${today}.log`);
    this.logFileStream = fs.createWriteStream(logFilePath, { flags: 'a', encoding: 'utf8' });
  }

  /**
   * Ingests a structured log entry into the centralized aggregator.
   *
   * @param {object} entry
   * @param {keyof typeof LogLevel} [entry.level='INFO']
   * @param {string} entry.subsystem Subsystem name (e.g. 'API_GATEWAY', 'PRIORITY_ENGINE')
   * @param {string} entry.message Log message
   * @param {string} [entry.correlationId] Request correlation/tracing UUID
   * @param {object} [entry.context] Additional metadata fields
   * @returns {object} Processed log object
   */
  ingest(entry) {
    const timestamp = new Date().toISOString();
    const logRecord = {
      id: `LOG-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      timestamp,
      level: entry.level || LogLevel.INFO,
      subsystem: entry.subsystem || 'SYSTEM',
      correlationId: entry.correlationId || null,
      message: entry.message || '',
      context: entry.context || {},
      hostname: os.hostname(),
    };

    // 1. Add to In-Memory Ring Buffer
    this.ringBuffer.unshift(logRecord);
    if (this.ringBuffer.length > this.options.bufferSize) {
      this.ringBuffer.pop();
    }

    // 2. Append to Persistent Daily Stream
    this._writeToDisk(logRecord);

    // 3. Emit Ingestion Event
    this.emit('log_ingested', logRecord);

    // 4. Forward Security and Critical Errors to Railway SOC
    if (logRecord.level === LogLevel.SECURITY || logRecord.level === LogLevel.AUDIT || logRecord.level === LogLevel.ERROR) {
      this._forwardToRailwaySoc(logRecord);
    }

    return logRecord;
  }

  /**
   * Safe asynchronous file stream writing.
   */
  _writeToDisk(record) {
    try {
      this._rotateFileStream();
      if (this.logFileStream && this.logFileStream.writable) {
        this.logFileStream.write(JSON.stringify(record) + '\n');
      }
    } catch (_) {
      // Non-blocking disk writing
    }
  }

  /**
   * Forwards high-severity security events to Indian Railways Cyber SOC.
   */
  _forwardToRailwaySoc(record) {
    if (!this.options.socForwardingEnabled) return;

    const socEvent = {
      socEventId: `SOC-LOG-${Date.now()}`,
      ingestedAt: new Date().toISOString(),
      logLevel: record.level,
      subsystem: record.subsystem,
      securityContext: record.context,
      message: record.message,
    };

    this.emit('soc_forwarded', socEvent);
  }

  /**
   * Convenience logging helpers
   */
  debug(subsystem, message, context = {}, correlationId = null) {
    return this.ingest({ level: LogLevel.DEBUG, subsystem, message, context, correlationId });
  }

  info(subsystem, message, context = {}, correlationId = null) {
    return this.ingest({ level: LogLevel.INFO, subsystem, message, context, correlationId });
  }

  warn(subsystem, message, context = {}, correlationId = null) {
    return this.ingest({ level: LogLevel.WARN, subsystem, message, context, correlationId });
  }

  error(subsystem, message, context = {}, correlationId = null) {
    return this.ingest({ level: LogLevel.ERROR, subsystem, message, context, correlationId });
  }

  security(subsystem, message, context = {}, correlationId = null) {
    return this.ingest({ level: LogLevel.SECURITY, subsystem, message, context, correlationId });
  }

  audit(subsystem, message, context = {}, correlationId = null) {
    return this.ingest({ level: LogLevel.AUDIT, subsystem, message, context, correlationId });
  }

  /**
   * Searches and filters ingested logs from the ring buffer.
   *
   * @param {object} query
   * @param {string} [query.level]
   * @param {string} [query.subsystem]
   * @param {string} [query.correlationId]
   * @param {string} [query.keyword] Search text in message
   * @param {number} [query.limit=100]
   * @returns {Array<object>}
   */
  query(query = {}) {
    let results = this.ringBuffer;

    if (query.level) {
      results = results.filter((l) => l.level === query.level);
    }
    if (query.subsystem) {
      results = results.filter((l) => l.subsystem === query.subsystem);
    }
    if (query.correlationId) {
      results = results.filter((l) => l.correlationId === query.correlationId);
    }
    if (query.keyword) {
      const kw = query.keyword.toLowerCase();
      results = results.filter((l) => l.message.toLowerCase().includes(kw));
    }

    const limit = query.limit || 100;
    return results.slice(0, limit);
  }

  /**
   * Returns log ingestion statistics.
   */
  getStats() {
    const counts = { DEBUG: 0, INFO: 0, WARN: 0, ERROR: 0, SECURITY: 0, AUDIT: 0 };
    for (const log of this.ringBuffer) {
      if (counts[log.level] !== undefined) counts[log.level] += 1;
    }

    return {
      total_in_memory: this.ringBuffer.length,
      buffer_capacity: this.options.bufferSize,
      counts_by_level: counts,
      active_log_file: this.currentLogDate ? `${this.options.logFileNamePrefix}_${this.currentLogDate}.log` : null,
      timestamp: new Date().toISOString(),
    };
  }
}

// Global Singleton
const logAggregator = new LogAggregator();

module.exports = {
  LogAggregator,
  logAggregator,
  LogLevel,
};
