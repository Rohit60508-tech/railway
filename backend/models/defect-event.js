/**
 * defect-event.js
 * ─────────────────────────────────────────────────────────────────
 * Unified JSON defect event schema for the Indian Railways AI
 * Maintenance Orchestration Platform.
 *
 * This model is the canonical representation of a defect regardless
 * of its origin (TDMS, SMMS, USFD, BDMS, manual report, SCADA).
 * Every adapter transforms its source record into this shape before
 * publishing to the Integration Gateway event stream.
 *
 * Schema design principles:
 *   - All required fields are explicitly marked with @required JSDoc
 *   - All optional fields default to null (never undefined)
 *   - Dates are always ISO-8601 UTC strings
 *   - Enum values are defined as frozen constants and reused in validators
 *   - A `meta` bag captures source-specific extensions without polluting
 *     the canonical schema
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

const crypto = require('crypto');

// ══════════════════════════════════════════════════════════════════
//  ENUM CONSTANTS
// ══════════════════════════════════════════════════════════════════

/** Source system that generated the defect event */
const DefectSource = Object.freeze({
  TMS:           'TMS',
  SMMS:          'SMMS',
  TDMS:          'TDMS',
  COA:           'COA',
  BDMS:          'BDMS',
  USFD:          'USFD',
  SCADA:         'SCADA',
  DRONE:         'DRONE',
  PATROL:        'PATROL',
  MANUAL_REPORT: 'MANUAL_REPORT',
  WEATHER:       'WEATHER',
  ITMS:          'ITMS',
  OMS:           'OMS',
  SYSTEM:        'SYSTEM',   // Platform-generated (e.g., TQI threshold breach)
});

/** Top-level defect domain — maps to a responsible department */
const DefectDomain = Object.freeze({
  CIVIL:      'CIVIL',       // Track, bridges, formations
  SIGNAL:     'SIGNAL',      // Signals, interlocking, telecom
  ELECTRICAL: 'ELECTRICAL',  // OHE, traction power, substations
  MECHANICAL: 'MECHANICAL',  // Rolling stock interfaces
  OPERATIONS: 'OPERATIONS',  // Traffic, operational safety
});

/** Specific defect category within domain */
const DefectCategory = Object.freeze({
  // Civil
  TRACK_GEOMETRY:     'TRACK_GEOMETRY',
  RAIL_FLAW:          'RAIL_FLAW',
  WELD_DEFECT:        'WELD_DEFECT',
  JOINT_DEFECT:       'JOINT_DEFECT',
  SLEEPER_DEFECT:     'SLEEPER_DEFECT',
  BALLAST_DEFICIENCY: 'BALLAST_DEFICIENCY',
  DRAINAGE:           'DRAINAGE',
  BRIDGE_DEFECT:      'BRIDGE_DEFECT',
  FORMATION:          'FORMATION',
  EARTHWORK:          'EARTHWORK',
  // Signal
  SIGNAL_FAILURE:     'SIGNAL_FAILURE',
  INTERLOCKING:       'INTERLOCKING',
  AXLE_COUNTER:       'AXLE_COUNTER',
  CABLE_FAULT:        'CABLE_FAULT',
  LEVEL_CROSSING:     'LEVEL_CROSSING',
  // Electrical
  OHE_DEFECT:         'OHE_DEFECT',
  SUBSTATION:         'SUBSTATION',
  TRACTION_FAULT:     'TRACTION_FAULT',
  // Operational
  OBSTRUCTION:        'OBSTRUCTION',
  INTRUDER:           'INTRUDER',
  FLOOD_DAMAGE:       'FLOOD_DAMAGE',
  LANDSLIDE:          'LANDSLIDE',
  OTHER:              'OTHER',
});

/** Unified severity across all source systems */
const DefectSeverity = Object.freeze({
  CRITICAL: 'CRITICAL',  // Immediate section closure / train stop
  HIGH:     'HIGH',      // Speed restriction or 4-hour response
  MEDIUM:   'MEDIUM',    // 24-hour response required
  LOW:      'LOW',       // Routine planned maintenance cycle
});

/** Lifecycle status of the defect */
const DefectStatus = Object.freeze({
  OPEN:        'OPEN',         // Detected, not yet assigned
  ASSIGNED:    'ASSIGNED',     // Work order raised, assigned to gang
  IN_PROGRESS: 'IN_PROGRESS',  // Active maintenance underway
  RESOLVED:    'RESOLVED',     // Rectification complete, pending closure
  CLOSED:      'CLOSED',       // Formally closed, verified
  DEFERRED:    'DEFERRED',     // Acknowledged but deferred (with justification)
  REOPENED:    'REOPENED',     // Previously closed, defect recurred
  DUPLICATE:   'DUPLICATE',    // Identified as duplicate of another event
});

/** How the defect was discovered */
const DetectionMethod = Object.freeze({
  AUTOMATED_SENSOR: 'AUTOMATED_SENSOR',
  USFD_SURVEY:      'USFD_SURVEY',
  TRC_SURVEY:       'TRC_SURVEY',
  DRONE_INSPECTION: 'DRONE_INSPECTION',
  PATROL:           'PATROL',
  ROUTINE_INSPECTION:'ROUTINE_INSPECTION',
  POST_FAILURE:     'POST_FAILURE',
  PASSENGER_REPORT: 'PASSENGER_REPORT',
  AI_ANOMALY:       'AI_ANOMALY',   // Platform's own ML detection
  OTHER:            'OTHER',
});

// ══════════════════════════════════════════════════════════════════
//  VALIDATION ERROR
// ══════════════════════════════════════════════════════════════════

class ModelValidationError extends Error {
  constructor(message, field, value) {
    super(message);
    this.name  = 'ModelValidationError';
    this.field = field;
    this.value = value;
  }
}

// ══════════════════════════════════════════════════════════════════
//  HELPER VALIDATORS
// ══════════════════════════════════════════════════════════════════

function requireString(obj, field) {
  if (typeof obj[field] !== 'string' || obj[field].trim() === '') {
    throw new ModelValidationError(`"${field}" must be a non-empty string`, field, obj[field]);
  }
}

function requireEnum(obj, field, enumObj) {
  requireString(obj, field);
  if (!Object.values(enumObj).includes(obj[field])) {
    throw new ModelValidationError(
      `"${field}" must be one of [${Object.values(enumObj).join(', ')}], got "${obj[field]}"`,
      field, obj[field]
    );
  }
}

function optionalEnum(obj, field, enumObj) {
  if (obj[field] != null) requireEnum(obj, field, enumObj);
}

function requireIsoDate(obj, field) {
  if (typeof obj[field] !== 'string') {
    throw new ModelValidationError(`"${field}" must be an ISO-8601 string`, field, obj[field]);
  }
  const d = new Date(obj[field]);
  if (isNaN(d.getTime())) {
    throw new ModelValidationError(`"${field}" is not a valid date: "${obj[field]}"`, field, obj[field]);
  }
}

function optionalIsoDate(obj, field) {
  if (obj[field] != null) requireIsoDate(obj, field);
}

function requirePositiveNumber(obj, field) {
  if (typeof obj[field] !== 'number' || obj[field] <= 0) {
    throw new ModelValidationError(`"${field}" must be a positive number`, field, obj[field]);
  }
}

function optionalNumber(obj, field, min, max) {
  if (obj[field] == null) return;
  if (typeof obj[field] !== 'number') {
    throw new ModelValidationError(`"${field}" must be a number`, field, obj[field]);
  }
  if (min !== undefined && obj[field] < min) {
    throw new ModelValidationError(`"${field}" must be >= ${min}`, field, obj[field]);
  }
  if (max !== undefined && obj[field] > max) {
    throw new ModelValidationError(`"${field}" must be <= ${max}`, field, obj[field]);
  }
}

function optionalBoolean(obj, field) {
  if (obj[field] != null && typeof obj[field] !== 'boolean') {
    throw new ModelValidationError(`"${field}" must be a boolean`, field, obj[field]);
  }
}

function optionalArray(obj, field) {
  if (obj[field] != null && !Array.isArray(obj[field])) {
    throw new ModelValidationError(`"${field}" must be an array`, field, obj[field]);
  }
}

// ══════════════════════════════════════════════════════════════════
//  SUB-SCHEMAS
// ══════════════════════════════════════════════════════════════════

/**
 * @typedef {object} GeoLocation
 * @property {number|null} lat       - WGS-84 latitude
 * @property {number|null} lon       - WGS-84 longitude
 * @property {number|null} chainageKm- Distance from section origin (km)
 * @property {string|null} railSide  - 'LEFT' | 'RIGHT' | 'BOTH'
 * @property {string|null} track     - 'UP' | 'DOWN' | 'LOOP' | 'YARD'
 */
function createGeoLocation(input = {}) {
  const loc = {
    lat:        input.lat        ?? null,
    lon:        input.lon        ?? null,
    chainageKm: input.chainageKm ?? null,
    railSide:   input.railSide   ?? null,
    track:      input.track      ?? null,
  };
  // India bounding box check
  if (loc.lat  != null && (loc.lat  < 6  || loc.lat  > 38)) {
    throw new ModelValidationError('lat out of India bounds [6, 38]', 'lat', loc.lat);
  }
  if (loc.lon  != null && (loc.lon  < 68 || loc.lon  > 98)) {
    throw new ModelValidationError('lon out of India bounds [68, 98]', 'lon', loc.lon);
  }
  if (loc.chainageKm != null && loc.chainageKm < 0) {
    throw new ModelValidationError('chainageKm cannot be negative', 'chainageKm', loc.chainageKm);
  }
  const VALID_SIDES  = ['LEFT', 'RIGHT', 'BOTH'];
  const VALID_TRACKS = ['UP', 'DOWN', 'LOOP', 'YARD'];
  if (loc.railSide && !VALID_SIDES.includes(loc.railSide)) {
    throw new ModelValidationError(`railSide must be one of [${VALID_SIDES.join(', ')}]`, 'railSide', loc.railSide);
  }
  if (loc.track && !VALID_TRACKS.includes(loc.track)) {
    throw new ModelValidationError(`track must be one of [${VALID_TRACKS.join(', ')}]`, 'track', loc.track);
  }
  return Object.freeze(loc);
}

/**
 * @typedef {object} SpeedRestriction
 * @property {number}      limitKmh    - Imposed speed limit
 * @property {string}      reason      - Human-readable reason
 * @property {string|null} imposedAt   - ISO-8601
 * @property {string|null} liftedAt    - ISO-8601, null if still active
 * @property {string|null} imposedBy   - Staff ID / system ID
 */
function createSpeedRestriction(input = {}) {
  if (typeof input.limitKmh !== 'number' || input.limitKmh < 0) {
    throw new ModelValidationError('limitKmh must be a non-negative number', 'limitKmh', input.limitKmh);
  }
  return Object.freeze({
    limitKmh:  input.limitKmh,
    reason:    input.reason    ?? null,
    imposedAt: input.imposedAt ?? null,
    liftedAt:  input.liftedAt  ?? null,
    imposedBy: input.imposedBy ?? null,
  });
}

/**
 * @typedef {object} AiAnnotation
 * @property {number}      riskScore        - 0–100 platform risk score
 * @property {number|null} failureProbability - 0.0–1.0 predicted 30-day failure probability
 * @property {string|null} suggestedAction  - Natural language action suggestion
 * @property {string[]}    contributingFactors - Factors driving the score
 * @property {string|null} modelVersion     - ML model version that scored this event
 * @property {string|null} scoredAt         - ISO-8601
 */
function createAiAnnotation(input = {}) {
  if (typeof input.riskScore !== 'number' || input.riskScore < 0 || input.riskScore > 100) {
    throw new ModelValidationError('riskScore must be 0–100', 'riskScore', input.riskScore);
  }
  if (input.failureProbability != null &&
      (typeof input.failureProbability !== 'number' || input.failureProbability < 0 || input.failureProbability > 1)) {
    throw new ModelValidationError('failureProbability must be 0.0–1.0', 'failureProbability', input.failureProbability);
  }
  return Object.freeze({
    riskScore:           input.riskScore,
    failureProbability:  input.failureProbability ?? null,
    suggestedAction:     input.suggestedAction    ?? null,
    contributingFactors: Array.isArray(input.contributingFactors) ? [...input.contributingFactors] : [],
    modelVersion:        input.modelVersion        ?? null,
    scoredAt:            input.scoredAt            ?? new Date().toISOString(),
  });
}

// ══════════════════════════════════════════════════════════════════
//  DEFECT EVENT MODEL
// ══════════════════════════════════════════════════════════════════

/**
 * @typedef {object} DefectEvent
 *
 * @required
 * @property {string}  defectId          - UUID — generated if not provided by source
 * @property {string}  source            - DefectSource enum
 * @property {string}  domain            - DefectDomain enum
 * @property {string}  category          - DefectCategory enum
 * @property {string}  severity          - DefectSeverity enum
 * @property {string}  status            - DefectStatus enum
 * @property {string}  detectionMethod   - DetectionMethod enum
 * @property {string}  sectionId         - IR section identifier
 * @property {string}  divisionCode      - IR division code (e.g. 'DLI')
 * @property {string}  zoneCode          - IR zone code (e.g. 'NR')
 * @property {string}  detectedAt        - ISO-8601 UTC
 *
 * @optional
 * @property {string|null}  sourceDefectId   - Original ID in source system
 * @property {string|null}  assetId          - COA asset ID (if linked)
 * @property {string|null}  description      - Human-readable description
 * @property {string|null}  remarks          - Additional free-text notes
 * @property {GeoLocation}  location         - Geospatial context
 * @property {SpeedRestriction|null} speedRestriction - Active ESR/TSR if imposed
 * @property {AiAnnotation|null}     aiAnnotation     - Platform AI risk scoring
 * @property {string|null}  workOrderId      - Linked work order (if assigned)
 * @property {string|null}  assignedTo       - Staff/gang ID
 * @property {string|null}  reportedBy       - Submitter staff ID
 * @property {boolean}      isRepeatDefect   - Seen in prior inspection cycle
 * @property {string|null}  parentDefectId   - Parent if this is a sub-defect
 * @property {string[]}     linkedDefectIds  - Other defects caused by same root
 * @property {object}       meta             - Source-specific extra fields
 * @property {string}       _schemaVersion
 * @property {string}       _ingestedAt      - Platform ingestion timestamp
 */
class DefectEvent {
  /**
   * @param {object} input - Raw input; partial validation happens here.
   */
  constructor(input = {}) {
    // ── Required fields ──────────────────────────────────────────
    this.defectId       = input.defectId ?? crypto.randomUUID();
    this.source         = input.source;
    this.domain         = input.domain;
    this.category       = input.category;
    this.severity       = input.severity;
    this.status         = input.status         ?? DefectStatus.OPEN;
    this.detectionMethod= input.detectionMethod;
    this.sectionId      = input.sectionId;
    this.divisionCode   = input.divisionCode;
    this.zoneCode       = input.zoneCode;
    this.detectedAt     = input.detectedAt;

    // ── Optional scalar fields ───────────────────────────────────
    this.sourceDefectId  = input.sourceDefectId  ?? null;
    this.assetId         = input.assetId         ?? null;
    this.description     = input.description     ?? null;
    this.remarks         = input.remarks         ?? null;
    this.workOrderId     = input.workOrderId     ?? null;
    this.assignedTo      = input.assignedTo      ?? null;
    this.reportedBy      = input.reportedBy      ?? null;
    this.isRepeatDefect  = input.isRepeatDefect  ?? false;
    this.parentDefectId  = input.parentDefectId  ?? null;
    this.linkedDefectIds = Array.isArray(input.linkedDefectIds) ? [...input.linkedDefectIds] : [];

    // ── Optional date fields ─────────────────────────────────────
    this.acknowledgedAt = input.acknowledgedAt ?? null;
    this.assignedAt     = input.assignedAt     ?? null;
    this.resolvedAt     = input.resolvedAt     ?? null;
    this.closedAt       = input.closedAt       ?? null;
    this.deferredUntil  = input.deferredUntil  ?? null;
    this.responseDeadline = input.responseDeadline ?? null;  // Computed from severity SLA

    // ── Structured sub-schemas ───────────────────────────────────
    this.location        = input.location
      ? createGeoLocation(input.location)
      : createGeoLocation();

    this.speedRestriction = input.speedRestriction
      ? createSpeedRestriction(input.speedRestriction)
      : null;

    this.aiAnnotation    = input.aiAnnotation
      ? createAiAnnotation(input.aiAnnotation)
      : null;

    // ── Source-specific extensions ───────────────────────────────
    this.meta = input.meta && typeof input.meta === 'object' ? { ...input.meta } : {};

    // ── Platform metadata ────────────────────────────────────────
    this._schemaVersion = '1.0';
    this._ingestedAt    = new Date().toISOString();
    this._sourceRaw     = input._raw ?? null;   // Original source record for audit
  }

  // ── Validation ─────────────────────────────────────────────────
  /**
   * Validates all fields. Throws ModelValidationError on first failure.
   * @returns {DefectEvent} this (for chaining)
   */
  validate() {
    requireString(this, 'defectId');
    requireEnum(this, 'source',          DefectSource);
    requireEnum(this, 'domain',          DefectDomain);
    requireEnum(this, 'category',        DefectCategory);
    requireEnum(this, 'severity',        DefectSeverity);
    requireEnum(this, 'status',          DefectStatus);
    requireEnum(this, 'detectionMethod', DetectionMethod);
    requireString(this, 'sectionId');
    requireString(this, 'divisionCode');
    requireString(this, 'zoneCode');
    requireIsoDate(this, 'detectedAt');

    optionalIsoDate(this, 'acknowledgedAt');
    optionalIsoDate(this, 'assignedAt');
    optionalIsoDate(this, 'resolvedAt');
    optionalIsoDate(this, 'closedAt');
    optionalIsoDate(this, 'deferredUntil');
    optionalIsoDate(this, 'responseDeadline');
    optionalBoolean(this, 'isRepeatDefect');
    optionalArray(this, 'linkedDefectIds');

    // Cross-field: resolvedAt must be after detectedAt
    if (this.resolvedAt && new Date(this.resolvedAt) < new Date(this.detectedAt)) {
      throw new ModelValidationError(
        'resolvedAt cannot be before detectedAt',
        'resolvedAt', this.resolvedAt
      );
    }

    // Cross-field: CLOSED status requires closedAt
    if (this.status === DefectStatus.CLOSED && !this.closedAt) {
      throw new ModelValidationError(
        'closedAt is required when status is CLOSED',
        'closedAt', null
      );
    }

    // Cross-field: DEFERRED status requires deferredUntil
    if (this.status === DefectStatus.DEFERRED && !this.deferredUntil) {
      throw new ModelValidationError(
        'deferredUntil is required when status is DEFERRED',
        'deferredUntil', null
      );
    }

    return this;
  }

  // ── Computed properties ────────────────────────────────────────
  /** Returns the SLA response window in hours for this severity */
  get slaDurationHours() {
    return { CRITICAL: 1, HIGH: 4, MEDIUM: 24, LOW: 168 }[this.severity] ?? 24;
  }

  /** True if the defect is overdue based on SLA */
  get isOverdue() {
    if ([DefectStatus.RESOLVED, DefectStatus.CLOSED, DefectStatus.DUPLICATE].includes(this.status)) return false;
    const deadline = new Date(this.detectedAt).getTime() + this.slaDurationHours * 3600_000;
    return Date.now() > deadline;
  }

  /** Age of defect in hours (since detection) */
  get ageHours() {
    return (Date.now() - new Date(this.detectedAt).getTime()) / 3600_000;
  }

  // ── Serialisation ──────────────────────────────────────────────
  toJSON() {
    return {
      defectId:        this.defectId,
      source:          this.source,
      domain:          this.domain,
      category:        this.category,
      severity:        this.severity,
      status:          this.status,
      detectionMethod: this.detectionMethod,
      sectionId:       this.sectionId,
      divisionCode:    this.divisionCode,
      zoneCode:        this.zoneCode,
      detectedAt:      this.detectedAt,
      sourceDefectId:  this.sourceDefectId,
      assetId:         this.assetId,
      description:     this.description,
      remarks:         this.remarks,
      location:        this.location,
      speedRestriction:this.speedRestriction,
      aiAnnotation:    this.aiAnnotation,
      workOrderId:     this.workOrderId,
      assignedTo:      this.assignedTo,
      reportedBy:      this.reportedBy,
      isRepeatDefect:  this.isRepeatDefect,
      parentDefectId:  this.parentDefectId,
      linkedDefectIds: this.linkedDefectIds,
      acknowledgedAt:  this.acknowledgedAt,
      assignedAt:      this.assignedAt,
      resolvedAt:      this.resolvedAt,
      closedAt:        this.closedAt,
      deferredUntil:   this.deferredUntil,
      responseDeadline:this.responseDeadline,
      meta:            this.meta,
      _schemaVersion:  this._schemaVersion,
      _ingestedAt:     this._ingestedAt,
      // Computed (read-only, not stored)
      slaDurationHours:this.slaDurationHours,
      isOverdue:       this.isOverdue,
      ageHours:        Math.round(this.ageHours * 10) / 10,
    };
  }

  /** Parses a plain JSON object back into a DefectEvent instance */
  static fromJSON(obj) {
    return new DefectEvent(obj);
  }

  /** Creates and validates in one call */
  static create(input) {
    return new DefectEvent(input).validate();
  }
}

// ══════════════════════════════════════════════════════════════════
//  EXPORTS
// ══════════════════════════════════════════════════════════════════

module.exports = {
  DefectEvent,
  DefectSource,
  DefectDomain,
  DefectCategory,
  DefectSeverity,
  DefectStatus,
  DetectionMethod,
  ModelValidationError,
  // Sub-schema builders (re-exported for composition in other models)
  createGeoLocation,
  createSpeedRestriction,
  createAiAnnotation,
  // Validator helpers (re-exported for composition)
  requireString,
  requireEnum,
  requireIsoDate,
  optionalEnum,
  optionalIsoDate,
  optionalNumber,
  optionalBoolean,
  optionalArray,
  requirePositiveNumber,
};
