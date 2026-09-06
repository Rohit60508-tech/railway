/**
 * manual-report-adapter.js
 * ─────────────────────────────────────────────────────────────────
 * Adapter for human-entered maintenance and defect reports.
 *
 * Unlike machine-generated adapters, this adapter:
 *   - Receives data pushed from the field mobile app / web portal
 *     (rather than polling a remote system)
 *   - Performs strict validation with meaningful error messages
 *     returned to the submitting user
 *   - Applies NLP-based category suggestion when free-text remarks
 *     are provided (via a lightweight local keyword classifier)
 *   - Handles file attachments (photos, documents) with reference IDs
 *   - Enforces submitter authentication (session JWT required)
 *   - Stores raw submissions to an audit log before processing
 *
 * Report types handled:
 *   PATROL     — Beat patrol defect observation
 *   INSPECTION — Structured engineering inspection
 *   EMERGENCY  — Urgent safety report
 *   COMPLETION — Gang/work completion report
 *   NEAR_MISS  — Near-miss / safety incident observation
 *   FEEDBACK   — General operational feedback
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

const crypto = require('crypto');
const {
  BaseAdapter,
  AuthError,
  ValidationError,
} = require('./base-adapter');

// ── Report type definitions ───────────────────────────────────────
const REPORT_TYPES = Object.freeze({
  PATROL:     { label: 'Patrol Report',        requiresLocation: true,  requiresDefectType: false },
  INSPECTION: { label: 'Engineering Inspection',requiresLocation: true,  requiresDefectType: true  },
  EMERGENCY:  { label: 'Emergency Report',      requiresLocation: true,  requiresDefectType: true  },
  COMPLETION: { label: 'Work Completion Report', requiresLocation: false, requiresDefectType: false },
  NEAR_MISS:  { label: 'Near-Miss Report',      requiresLocation: true,  requiresDefectType: false },
  FEEDBACK:   { label: 'Operational Feedback',   requiresLocation: false, requiresDefectType: false },
});

// Defect types available to field staff (simplified IR vocabulary)
const FIELD_DEFECT_TYPES = Object.freeze([
  'TRACK_DEFECT',
  'SIGNAL_FAILURE',
  'OHE_DEFECT',
  'BRIDGE_DEFECT',
  'LEVEL_CROSSING',
  'DRAINAGE',
  'VEGETATION',
  'INTRUDER_ANIMAL',
  'OBSTRUCTION',
  'RAIL_FRACTURE',
  'FLOOD_DAMAGE',
  'LANDSLIDE',
  'OTHER',
]);

// ── Keyword classifier for auto-categorisation ────────────────────
const KEYWORD_MAP = [
  { pattern: /\b(fracture|crack|fissure|break)\b/i,    type: 'RAIL_FRACTURE'    },
  { pattern: /\b(signal|relay|colour light|aspect)\b/i, type: 'SIGNAL_FAILURE'  },
  { pattern: /\b(OHE|overhead|pantograph|catenary)\b/i, type: 'OHE_DEFECT'      },
  { pattern: /\b(bridge|girder|arch|culvert)\b/i,       type: 'BRIDGE_DEFECT'   },
  { pattern: /\b(flood|waterlogging|inundation)\b/i,    type: 'FLOOD_DAMAGE'    },
  { pattern: /\b(landslide|cutting|embankment)\b/i,     type: 'LANDSLIDE'       },
  { pattern: /\b(animal|cattle|elephant|trespass)\b/i,  type: 'INTRUDER_ANIMAL' },
  { pattern: /\b(drain|ballast|fouling)\b/i,            type: 'DRAINAGE'        },
  { pattern: /\b(obstruction|boulder|fallen)\b/i,       type: 'OBSTRUCTION'     },
  { pattern: /\b(gauge|alignment|cross.level|twist)\b/i,type: 'TRACK_DEFECT'    },
];

function suggestDefectType(remarks) {
  if (!remarks) return null;
  for (const { pattern, type } of KEYWORD_MAP) {
    if (pattern.test(remarks)) return type;
  }
  return 'OTHER';
}

// ── Priority computation ──────────────────────────────────────────
function computePriority(reportType, defectType, severityFlag) {
  if (reportType === 'EMERGENCY')     return 'CRITICAL';
  if (reportType === 'NEAR_MISS')     return 'HIGH';
  if (defectType === 'RAIL_FRACTURE') return 'CRITICAL';
  if (defectType === 'FLOOD_DAMAGE')  return 'HIGH';
  if (defectType === 'LANDSLIDE')     return 'HIGH';
  if (severityFlag === 'HIGH')        return 'HIGH';
  if (severityFlag === 'MEDIUM')      return 'MEDIUM';
  return 'LOW';
}

// ── Manual Report Adapter ─────────────────────────────────────────
class ManualReportAdapter extends BaseAdapter {
  /**
   * @param {object} config
   * @param {string} config.auth.jwtSecret     - Secret for verifying submitter JWT
   * @param {string} [config.auth.issuer]      - Expected JWT issuer (e.g. 'ir-field-app')
   * @param {object} [config.auditLog]         - Audit log storage interface { write(entry) }
   * @param {number} [config.maxRemarksLength] - Max chars for free-text (default 2000)
   * @param {number} [config.maxAttachments]   - Max file attachments (default 5)
   */
  constructor(config = {}) {
    super({ adapterName: 'MANUAL_REPORT', ...config });
    this.jwtSecret        = config.auth?.jwtSecret;
    this.jwtIssuer        = config.auth?.issuer ?? null;
    this.auditLog         = config.auditLog ?? null;
    this.maxRemarksLength = config.maxRemarksLength ?? 2000;
    this.maxAttachments   = config.maxAttachments   ?? 5;

    if (!this.jwtSecret) throw new Error('ManualReportAdapter: config.auth.jwtSecret is required');
  }

  // ── Lifecycle ─────────────────────────────────────────────────
  async connect() {
    this._healthy = true;
    this.log.info('ManualReportAdapter ready (push-mode)');
  }

  async healthCheck() {
    return { ok: this._healthy, latencyMs: 0, details: { mode: 'push' } };
  }

  // ── JWT Verification ──────────────────────────────────────────
  /**
   * Verifies a submitter JWT (HS256) and returns the payload.
   * In production replace with a proper JWT library (e.g. jose, jsonwebtoken).
   * @param {string} token - Raw JWT string (without 'Bearer ' prefix)
   * @returns {object}     - Decoded payload
   */
  verifySubmitterToken(token) {
    if (!token) throw new AuthError('No authentication token provided');

    const parts = token.split('.');
    if (parts.length !== 3) throw new AuthError('Malformed JWT token');

    const [headerB64, payloadB64, sigB64] = parts;

    // Verify HMAC-SHA256 signature
    const expected = crypto
      .createHmac('sha256', this.jwtSecret)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');

    if (expected !== sigB64) {
      throw new AuthError('JWT signature verification failed', { hint: 'Check jwtSecret configuration' });
    }

    let payload;
    try {
      payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    } catch {
      throw new AuthError('JWT payload is not valid JSON');
    }

    // Expiry check
    if (payload.exp && Date.now() / 1000 > payload.exp) {
      throw new AuthError('JWT token has expired', { exp: payload.exp });
    }

    // Issuer check
    if (this.jwtIssuer && payload.iss !== this.jwtIssuer) {
      throw new AuthError(`JWT issuer mismatch: expected "${this.jwtIssuer}", got "${payload.iss}"`);
    }

    return payload;
  }

  // ── Audit Logging ─────────────────────────────────────────────
  async _writeAuditLog(rawReport, submitter) {
    const entry = {
      auditId:     crypto.randomUUID(),
      receivedAt:  new Date().toISOString(),
      submitterId: submitter?.sub ?? 'unknown',
      submitterRole: submitter?.role ?? 'unknown',
      reportType:  rawReport.reportType ?? 'UNKNOWN',
      sectionId:   rawReport.sectionId ?? null,
      _rawReport:  rawReport,
    };

    if (this.auditLog) {
      try {
        await this.auditLog.write(entry);
      } catch (err) {
        // Non-fatal — log warning but don't block submission
        this.log.warn('Audit log write failed', { error: err.message, auditId: entry.auditId });
      }
    } else {
      // Fallback: log to stdout
      this.log.info('AUDIT', { auditId: entry.auditId, submitterId: entry.submitterId });
    }
    return entry.auditId;
  }

  // ── Main Entry Point (push-mode) ──────────────────────────────
  /**
   * Processes a single inbound report from the field app.
   * Called by the HTTP handler — not via the polling ingest() path.
   *
   * @param {object} rawReport   - Raw JSON body from the POST request
   * @param {string} authHeader  - Authorization header value ('Bearer <token>')
   * @returns {object}           - { reportId, priority, suggestedDefectType, normalised }
   */
  async processSubmission(rawReport, authHeader) {
    const correlationId = crypto.randomUUID();
    const log = this.log.child(correlationId);
    log.info('Report submission received', { reportType: rawReport.reportType });

    // ── 1. Authenticate submitter ──────────────────────────────
    const token = authHeader?.replace(/^Bearer\s+/i, '');
    const submitter = this.verifySubmitterToken(token);
    log.debug('Submitter authenticated', { sub: submitter.sub, role: submitter.role });

    // ── 2. Audit log (before validation — capture everything) ──
    const auditId = await this._writeAuditLog(rawReport, submitter);

    // ── 3. Validate ────────────────────────────────────────────
    const validated = this.validate(rawReport, submitter);

    // ── 4. Auto-classify if defect type missing ────────────────
    const autoSuggestedType = validated.defectType ?? suggestDefectType(validated.remarks);

    // ── 5. Priority ────────────────────────────────────────────
    const priority = computePriority(
      validated.reportType,
      autoSuggestedType,
      validated.severityFlag
    );

    // ── 6. Transform ───────────────────────────────────────────
    const normalised = this.transform(validated, submitter, autoSuggestedType, priority);

    log.info('Report processed', {
      reportId:  normalised.reportId,
      priority,
      auditId,
      autoType:  autoSuggestedType,
    });

    return {
      reportId:          normalised.reportId,
      auditId,
      correlationId,
      priority,
      suggestedDefectType: autoSuggestedType,
      normalised,
    };
  }

  // ── Validation ────────────────────────────────────────────────
  /**
   * @param {object} r         - Raw report JSON
   * @param {object} submitter - Decoded JWT payload
   */
  validate(r, submitter) {
    this._requireField(r, 'reportType', 'string');
    this._requireField(r, 'submittedAt', 'string');

    // Report type
    if (!REPORT_TYPES[r.reportType]) {
      throw new ValidationError(
        `Unknown reportType: "${r.reportType}"`,
        { field: 'reportType', allowed: Object.keys(REPORT_TYPES) }
      );
    }

    const rtConfig = REPORT_TYPES[r.reportType];

    // Location required for most report types
    if (rtConfig.requiresLocation) {
      if (!r.sectionId && !(r.gpsLat && r.gpsLon)) {
        throw new ValidationError(
          `Report type "${r.reportType}" requires either sectionId or GPS coordinates`,
          { field: 'sectionId/gpsLat/gpsLon' }
        );
      }
    }

    // Defect type required for INSPECTION and EMERGENCY
    if (rtConfig.requiresDefectType && !r.defectType) {
      throw new ValidationError(
        `Report type "${r.reportType}" requires a defectType`,
        { field: 'defectType' }
      );
    }

    if (r.defectType && !FIELD_DEFECT_TYPES.includes(r.defectType)) {
      throw new ValidationError(
        `Unknown defectType: "${r.defectType}"`,
        { field: 'defectType', allowed: FIELD_DEFECT_TYPES }
      );
    }

    // GPS validation
    if (r.gpsLat !== undefined) {
      if (typeof r.gpsLat !== 'number' || r.gpsLat < 6 || r.gpsLat > 38) {
        throw new ValidationError('gpsLat out of India bounding box [6, 38]', { value: r.gpsLat });
      }
    }
    if (r.gpsLon !== undefined) {
      if (typeof r.gpsLon !== 'number' || r.gpsLon < 68 || r.gpsLon > 98) {
        throw new ValidationError('gpsLon out of India bounding box [68, 98]', { value: r.gpsLon });
      }
    }

    // Remarks length
    if (r.remarks && r.remarks.length > this.maxRemarksLength) {
      throw new ValidationError(
        `remarks exceeds maximum length of ${this.maxRemarksLength} characters`,
        { length: r.remarks.length, max: this.maxRemarksLength }
      );
    }

    // Attachments
    if (r.attachments && !Array.isArray(r.attachments)) {
      throw new ValidationError('attachments must be an array');
    }
    if (Array.isArray(r.attachments) && r.attachments.length > this.maxAttachments) {
      throw new ValidationError(
        `Too many attachments: ${r.attachments.length} (max ${this.maxAttachments})`,
        { count: r.attachments.length, max: this.maxAttachments }
      );
    }

    // COMPLETION: validate workOrderId
    if (r.reportType === 'COMPLETION') {
      if (!r.workOrderId) {
        throw new ValidationError('COMPLETION reports require workOrderId', { field: 'workOrderId' });
      }
      if (typeof r.workedHours !== 'number' || r.workedHours <= 0 || r.workedHours > 24) {
        throw new ValidationError('workedHours must be between 0 and 24', { value: r.workedHours });
      }
    }

    // Submitter privilege escalation check
    if (r.overridePriority && submitter.role !== 'ENGINEER' && submitter.role !== 'SUPERVISOR') {
      throw new ValidationError(
        'Only ENGINEERs or SUPERVISORs can override report priority',
        { submitterRole: submitter.role }
      );
    }

    return {
      ...r,
      submittedAt: this._coerceDate(r.submittedAt, 'submittedAt'),
    };
  }

  // ── Transform → Canonical Schema ──────────────────────────────
  transform(r, submitter, autoDefectType, priority) {
    const reportId = crypto.randomUUID();

    return {
      _source:        'MANUAL_REPORT',
      _ingestedAt:    new Date().toISOString(),
      _schemaVersion: '1.0',

      reportId,
      reportType:     r.reportType,
      reportTypeLabel:REPORT_TYPES[r.reportType]?.label,

      // Defect info
      defectType:          autoDefectType,
      defectTypeOverridden:!!r.defectType,  // true if user specified, false if auto-suggested
      description:         r.description ?? null,
      remarks:             r.remarks     ?? null,
      severityFlag:        r.severityFlag ?? null,

      // Priority
      priority:          r.overridePriority ?? priority,
      priorityOverridden:!!r.overridePriority,

      // Location
      sectionId:     r.sectionId    ?? null,
      stationCode:   r.stationCode  ?? null,
      chainageKm:    r.chainageKm   ?? null,
      gpsLat:        r.gpsLat       ?? null,
      gpsLon:        r.gpsLon       ?? null,
      gpsAccuracyM:  r.gpsAccuracyM ?? null,

      // Submitter
      submitterId:    submitter.sub,
      submitterName:  submitter.name   ?? null,
      submitterRole:  submitter.role   ?? null,
      submitterDivision: submitter.division ?? null,

      // Work completion fields (COMPLETION reports only)
      workOrderId:    r.workOrderId  ?? null,
      workedHours:    r.workedHours  ?? null,
      gangId:         r.gangId       ?? null,
      gangSize:       r.gangSize     ?? null,

      // Attachments (array of { attachmentId, fileType, url } from file upload service)
      attachments: Array.isArray(r.attachments)
        ? r.attachments.map((a, i) => ({
            index:        i,
            attachmentId: a.attachmentId ?? null,
            fileType:     a.fileType     ?? null,
            url:          a.url          ?? null,
          }))
        : [],

      // Timestamps
      submittedAt:    r.submittedAt,
      incidentAt:     r.incidentAt ? this._coerceDate(r.incidentAt, 'incidentAt') : null,

      _raw: r,
    };
  }

  // ── fetchRaw / ingest are not used in push-mode ───────────────
  async fetchRaw() {
    throw new Error('ManualReportAdapter operates in push-mode. Use processSubmission() instead.');
  }
}

// ── Factory ───────────────────────────────────────────────────────
/**
 * Required env vars: MANUAL_REPORT_JWT_SECRET
 * Optional: MANUAL_REPORT_JWT_ISSUER, MANUAL_REPORT_MAX_REMARKS,
 *           MANUAL_REPORT_MAX_ATTACHMENTS
 */
function createManualReportAdapter(overrides = {}) {
  return new ManualReportAdapter({
    maxRemarksLength: Number(process.env.MANUAL_REPORT_MAX_REMARKS     ?? 2000),
    maxAttachments:   Number(process.env.MANUAL_REPORT_MAX_ATTACHMENTS ?? 5),
    auth: {
      jwtSecret: process.env.MANUAL_REPORT_JWT_SECRET,
      issuer:    process.env.MANUAL_REPORT_JWT_ISSUER ?? 'ir-field-app',
    },
    ...overrides,
  });
}

module.exports = {
  ManualReportAdapter, createManualReportAdapter,
  REPORT_TYPES, FIELD_DEFECT_TYPES, suggestDefectType, computePriority,
};
