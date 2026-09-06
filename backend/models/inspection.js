/**
 * inspection.js
 * ─────────────────────────────────────────────────────────────────
 * Inspection and observation data models for the Indian Railways AI
 * Maintenance Orchestration Platform.
 *
 * Covers:
 *
 *  1. InspectionSchedule — Planned inspection programme for a section
 *     (mandated by RDSO norms: patrol cycles, TRC frequency, USFD
 *     frequency, bridge inspection periods).
 *
 *  2. InspectionRecord — A specific completed inspection event with
 *     observations, findings, and follow-up actions.
 *
 *  3. Observation — An individual finding within an inspection record.
 *     Observations map to DefectEvents when they cross action thresholds.
 *
 * Inspection type → mandatory frequency mapping (RDSO Track Manual 2021):
 *   FOOT_PATROL        → Every 3 days (for 'A' group routes)
 *   GANG_INSPECTION    → Monthly (SE inspection)
 *   TRC_SURVEY         → Quarterly (speed ≥ 100 km/h sections)
 *   USFD_SURVEY        → Every 3 months (new rails) / 1 month (worn)
 *   BRIDGE_ROUTINE     → Annual
 *   BRIDGE_DETAILED    → Every 5 years
 *   BRIDGE_SPECIAL     → Post-flood / post-seismic
 *   OHE_INSPECTION     → Monthly
 *   SIGNAL_INSPECTION  → Quarterly
 *   LEVEL_CROSSING     → Biannual
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

const crypto = require('crypto');
const {
  ModelValidationError,
  requireString, requireEnum, requireIsoDate, requirePositiveNumber,
  optionalEnum, optionalIsoDate, optionalNumber, optionalBoolean,
  createGeoLocation,
  DefectDomain,
  DefectSeverity,
  DefectCategory,
} = require('./defect-event');

// ══════════════════════════════════════════════════════════════════
//  ENUMS
// ══════════════════════════════════════════════════════════════════

const InspectionType = Object.freeze({
  FOOT_PATROL:       'FOOT_PATROL',
  GANG_INSPECTION:   'GANG_INSPECTION',
  TRC_SURVEY:        'TRC_SURVEY',
  USFD_SURVEY:       'USFD_SURVEY',
  BRIDGE_ROUTINE:    'BRIDGE_ROUTINE',
  BRIDGE_DETAILED:   'BRIDGE_DETAILED',
  BRIDGE_SPECIAL:    'BRIDGE_SPECIAL',
  BRIDGE_NIGHT:      'BRIDGE_NIGHT',
  OHE_INSPECTION:    'OHE_INSPECTION',
  SIGNAL_INSPECTION: 'SIGNAL_INSPECTION',
  LEVEL_CROSSING:    'LEVEL_CROSSING',
  DRONE_SURVEY:      'DRONE_SURVEY',
  POST_WORK:         'POST_WORK',     // Post-maintenance sign-off inspection
  SPECIAL:           'SPECIAL',       // Ad-hoc or directed inspection
});

const InspectionStatus = Object.freeze({
  SCHEDULED:   'SCHEDULED',    // On the inspection programme
  IN_PROGRESS: 'IN_PROGRESS',  // Inspector on section
  COMPLETED:   'COMPLETED',    // Inspection done, report submitted
  OVERDUE:     'OVERDUE',      // Past due date, not yet conducted
  CANCELLED:   'CANCELLED',    // Legitimately cancelled (weather, block)
  MISSED:      'MISSED',       // Not done, no cancellation reason
});

const ObservationSeverity = Object.freeze({
  NORMAL:   'NORMAL',    // Within permissible limits
  WATCH:    'WATCH',     // Approaching limit — monitor
  CAUTION:  'CAUTION',   // At limit — maintenance action needed
  CRITICAL: 'CRITICAL',  // Exceeds limit — immediate action
});

const ObservationStatus = Object.freeze({
  NOTED:      'NOTED',       // Recorded, no action yet
  ACTIONED:   'ACTIONED',    // Work order / defect raised
  MONITORING: 'MONITORING',  // Under enhanced monitoring
  RESOLVED:   'RESOLVED',    // Maintenance completed
  DEFERRED:   'DEFERRED',    // Acknowledged, deferred with justification
});

// RDSO mandated inspection frequencies in days
const MANDATED_FREQUENCY_DAYS = Object.freeze({
  FOOT_PATROL:       3,
  GANG_INSPECTION:   30,
  TRC_SURVEY:        90,
  USFD_SURVEY:       30,
  BRIDGE_ROUTINE:    365,
  BRIDGE_DETAILED:   1825,
  BRIDGE_SPECIAL:    null,   // Event-triggered, no fixed frequency
  BRIDGE_NIGHT:      1,      // Daily during monsoon
  OHE_INSPECTION:    30,
  SIGNAL_INSPECTION: 90,
  LEVEL_CROSSING:    180,
  DRONE_SURVEY:      null,   // Depends on section risk rating
  POST_WORK:         null,   // Immediately after maintenance
  SPECIAL:           null,
});

// ══════════════════════════════════════════════════════════════════
//  SUB-SCHEMAS
// ══════════════════════════════════════════════════════════════════

/**
 * @typedef {object} Observation
 * @property {string}  observationId
 * @property {string}  category          - DefectCategory enum
 * @property {string}  severity          - ObservationSeverity enum
 * @property {string}  status            - ObservationStatus enum
 * @property {string}  description       - What was observed
 * @property {GeoLocation} location
 * @property {number|null} measuredValue - Measured deviation / reading
 * @property {string|null} unit          - Measurement unit (mm, %, dB etc.)
 * @property {number|null} permissibleLimit
 * @property {string|null} defectEventId - Linked DefectEvent (if actioned)
 * @property {string|null} photoRef      - Attachment reference ID
 * @property {string|null} notes
 */
function createObservation(input = {}) {
  if (!Object.values(DefectCategory).includes(input.category)) {
    throw new ModelValidationError(
      `Observation.category must be a valid DefectCategory`,
      'category', input.category
    );
  }
  if (!Object.values(ObservationSeverity).includes(input.severity)) {
    throw new ModelValidationError(
      `Observation.severity must be one of [${Object.values(ObservationSeverity).join(', ')}]`,
      'severity', input.severity
    );
  }
  if (!Object.values(ObservationStatus).includes(input.status ?? ObservationStatus.NOTED)) {
    throw new ModelValidationError(
      `Observation.status must be a valid ObservationStatus`,
      'status', input.status
    );
  }
  if (!input.description || typeof input.description !== 'string') {
    throw new ModelValidationError('Observation.description is required', 'description', input.description);
  }

  return Object.freeze({
    observationId:   input.observationId   ?? crypto.randomUUID(),
    category:        input.category,
    severity:        input.severity,
    status:          input.status          ?? ObservationStatus.NOTED,
    description:     input.description,
    location:        createGeoLocation(input.location ?? {}),
    measuredValue:   input.measuredValue   ?? null,
    unit:            input.unit            ?? null,
    permissibleLimit:input.permissibleLimit ?? null,
    deviation:       (input.measuredValue != null && input.permissibleLimit != null)
      ? Math.abs(input.measuredValue) - input.permissibleLimit
      : null,
    defectEventId:   input.defectEventId   ?? null,
    workOrderId:     input.workOrderId     ?? null,
    photoRef:        input.photoRef        ?? null,
    notes:           input.notes           ?? null,
    recordedAt:      input.recordedAt      ?? new Date().toISOString(),
  });
}

/**
 * @typedef {object} TqiMeasurement
 * Track Quality Index measurement (per RDSO TRC analysis).
 * @property {number}  tqi             - Overall TQI score (lower = better)
 * @property {number|null} gaugeUnevenness
 * @property {number|null} alignmentUnevenness
 * @property {number|null} crossLevelUnevenness
 * @property {number|null} twistUnevenness
 * @property {number|null} longitudinalUnevenness
 * @property {string}  category        - 'A' | 'B' | 'C' | 'D' (RDSO classification)
 */
function createTqiMeasurement(input = {}) {
  if (typeof input.tqi !== 'number' || input.tqi < 0) {
    throw new ModelValidationError('TQI must be a non-negative number', 'tqi', input.tqi);
  }
  const CATS = ['A', 'B', 'C', 'D'];
  if (input.category && !CATS.includes(input.category)) {
    throw new ModelValidationError(`TQI category must be one of [${CATS.join(', ')}]`, 'category', input.category);
  }
  return Object.freeze({
    tqi:                   input.tqi,
    gaugeUnevenness:       input.gaugeUnevenness       ?? null,
    alignmentUnevenness:   input.alignmentUnevenness   ?? null,
    crossLevelUnevenness:  input.crossLevelUnevenness  ?? null,
    twistUnevenness:       input.twistUnevenness       ?? null,
    longitudinalUnevenness:input.longitudinalUnevenness ?? null,
    category:              input.category               ?? null,
  });
}

// ══════════════════════════════════════════════════════════════════
//  MODEL 1: INSPECTION SCHEDULE
// ══════════════════════════════════════════════════════════════════

/**
 * @typedef {object} InspectionSchedule
 * Defines the planned inspection programme for a section.
 *
 * @required
 * @property {string}  scheduleId
 * @property {string}  inspectionType    - InspectionType enum
 * @property {string}  sectionId
 * @property {string}  divisionCode
 * @property {string}  zoneCode
 *
 * @optional
 * @property {string|null}  assignedInspectorId - StaffMember ID
 * @property {number|null}  frequencyDays       - Override mandated frequency
 * @property {string|null}  lastConductedAt     - ISO-8601
 * @property {string|null}  nextDueAt           - ISO-8601 (computed or set)
 * @property {boolean}      isActive
 * @property {string|null}  notes
 */
class InspectionSchedule {
  constructor(input = {}) {
    this.scheduleId          = input.scheduleId    ?? crypto.randomUUID();
    this.inspectionType      = input.inspectionType;
    this.sectionId           = input.sectionId;
    this.divisionCode        = input.divisionCode;
    this.zoneCode            = input.zoneCode;
    this.assignedInspectorId = input.assignedInspectorId ?? null;
    this.assetId             = input.assetId       ?? null;  // For bridge-specific schedules

    // Frequency: use input override, else mandated default
    this.frequencyDays = input.frequencyDays
      ?? MANDATED_FREQUENCY_DAYS[input.inspectionType]
      ?? null;

    this.lastConductedAt = input.lastConductedAt ?? null;
    this.nextDueAt       = input.nextDueAt
      ?? (this.lastConductedAt && this.frequencyDays
        ? new Date(new Date(this.lastConductedAt).getTime() + this.frequencyDays * 86400_000).toISOString()
        : null);

    this.isActive    = input.isActive    ?? true;
    this.notes       = input.notes       ?? null;

    this._schemaVersion = '1.0';
    this._updatedAt     = new Date().toISOString();
  }

  validate() {
    requireString(this, 'scheduleId');
    requireEnum(this, 'inspectionType', InspectionType);
    requireString(this, 'sectionId');
    requireString(this, 'divisionCode');
    requireString(this, 'zoneCode');
    optionalNumber(this, 'frequencyDays', 1);
    optionalIsoDate(this, 'lastConductedAt');
    optionalIsoDate(this, 'nextDueAt');
    optionalBoolean(this, 'isActive');
    return this;
  }

  /** True if this inspection is overdue based on frequency */
  get isOverdue() {
    if (!this.nextDueAt) return false;
    return this.isActive && Date.now() > new Date(this.nextDueAt).getTime();
  }

  /** Days since last conducted (null if never conducted) */
  get daysSinceLastConducted() {
    if (!this.lastConductedAt) return null;
    return Math.floor((Date.now() - new Date(this.lastConductedAt).getTime()) / 86400_000);
  }

  /** Days until next due (negative if overdue) */
  get daysUntilDue() {
    if (!this.nextDueAt) return null;
    return Math.floor((new Date(this.nextDueAt).getTime() - Date.now()) / 86400_000);
  }

  /** Advance the schedule after a completed inspection */
  markConducted(conductedAt = new Date().toISOString()) {
    this.lastConductedAt = conductedAt;
    if (this.frequencyDays) {
      this.nextDueAt = new Date(
        new Date(conductedAt).getTime() + this.frequencyDays * 86400_000
      ).toISOString();
    }
    this._updatedAt = new Date().toISOString();
    return this;
  }

  toJSON() {
    return {
      scheduleId: this.scheduleId, inspectionType: this.inspectionType,
      sectionId: this.sectionId, divisionCode: this.divisionCode, zoneCode: this.zoneCode,
      assignedInspectorId: this.assignedInspectorId, assetId: this.assetId,
      frequencyDays: this.frequencyDays, lastConductedAt: this.lastConductedAt,
      nextDueAt: this.nextDueAt, isActive: this.isActive, notes: this.notes,
      isOverdue: this.isOverdue, daysSinceLastConducted: this.daysSinceLastConducted,
      daysUntilDue: this.daysUntilDue,
      mandatedFrequencyDays: MANDATED_FREQUENCY_DAYS[this.inspectionType],
      _schemaVersion: this._schemaVersion, _updatedAt: this._updatedAt,
    };
  }

  static fromJSON(obj) { return new InspectionSchedule(obj); }
  static create(input) { return new InspectionSchedule(input).validate(); }
}

// ══════════════════════════════════════════════════════════════════
//  MODEL 2: INSPECTION RECORD
// ══════════════════════════════════════════════════════════════════

/**
 * @typedef {object} InspectionRecord
 * A completed (or in-progress) inspection event.
 *
 * @required
 * @property {string}  recordId
 * @property {string}  inspectionType     - InspectionType enum
 * @property {string}  status             - InspectionStatus enum
 * @property {string}  sectionId
 * @property {string}  divisionCode
 * @property {string}  zoneCode
 * @property {string}  inspectorId        - StaffMember ID
 * @property {string}  scheduledAt        - ISO-8601 planned time
 *
 * @optional
 * @property {string|null}   startedAt           - ISO-8601 actual start
 * @property {string|null}   completedAt         - ISO-8601 actual end
 * @property {string|null}   scheduleId          - Linked InspectionSchedule
 * @property {string|null}   workOrderId         - Linked to post-work inspection
 * @property {Observation[]} observations        - Findings during inspection
 * @property {TqiMeasurement|null} tqiMeasurement - For TRC surveys
 * @property {number|null}   sectionLengthKm     - Length inspected
 * @property {number}        observationCount     - Count of all observations
 * @property {number}        criticalCount        - Count of CRITICAL severity obs
 * @property {string|null}   summary             - Free-text overall condition summary
 * @property {string|null}   overallRating       - 'GOOD'|'FAIR'|'POOR'|'DANGEROUS'
 * @property {string[]}      defectEventIds       - DefectEvents raised from this inspection
 * @property {string[]}      attachmentIds        - Photo/document references
 * @property {string|null}   supervisorSignOff    - Supervisor StaffMember ID
 * @property {string|null}   supervisorSignedAt   - ISO-8601
 * @property {string|null}   cancellationReason
 */
class InspectionRecord {
  constructor(input = {}) {
    this.recordId       = input.recordId    ?? crypto.randomUUID();
    this.inspectionType = input.inspectionType;
    this.status         = input.status      ?? InspectionStatus.SCHEDULED;
    this.sectionId      = input.sectionId;
    this.divisionCode   = input.divisionCode;
    this.zoneCode       = input.zoneCode;
    this.inspectorId    = input.inspectorId;
    this.scheduledAt    = input.scheduledAt;

    // Optional scalars
    this.scheduleId          = input.scheduleId          ?? null;
    this.workOrderId         = input.workOrderId         ?? null;
    this.startedAt           = input.startedAt           ?? null;
    this.completedAt         = input.completedAt         ?? null;
    this.sectionLengthKm     = input.sectionLengthKm     ?? null;
    this.summary             = input.summary             ?? null;
    this.overallRating       = input.overallRating       ?? null;
    this.cancellationReason  = input.cancellationReason  ?? null;
    this.supervisorSignOff   = input.supervisorSignOff   ?? null;
    this.supervisorSignedAt  = input.supervisorSignedAt  ?? null;
    this.weatherConditions   = input.weatherConditions   ?? null;
    this.vehicleId           = input.vehicleId           ?? null;   // TRC vehicle, USFD trolley etc.

    // Observations
    this.observations = Array.isArray(input.observations)
      ? input.observations.map(createObservation)
      : [];

    // TRC / TQI
    this.tqiMeasurement = input.tqiMeasurement
      ? createTqiMeasurement(input.tqiMeasurement)
      : null;

    // Linked entities
    this.defectEventIds  = Array.isArray(input.defectEventIds)  ? [...input.defectEventIds]  : [];
    this.attachmentIds   = Array.isArray(input.attachmentIds)   ? [...input.attachmentIds]   : [];

    this._schemaVersion = '1.0';
    this._createdAt     = new Date().toISOString();
    this._updatedAt     = new Date().toISOString();
  }

  validate() {
    requireString(this, 'recordId');
    requireEnum(this, 'inspectionType', InspectionType);
    requireEnum(this, 'status',         InspectionStatus);
    requireString(this, 'sectionId');
    requireString(this, 'divisionCode');
    requireString(this, 'zoneCode');
    requireString(this, 'inspectorId');
    requireIsoDate(this, 'scheduledAt');
    optionalIsoDate(this, 'startedAt');
    optionalIsoDate(this, 'completedAt');
    optionalIsoDate(this, 'supervisorSignedAt');
    optionalNumber(this, 'sectionLengthKm', 0);

    const RATINGS = ['GOOD', 'FAIR', 'POOR', 'DANGEROUS'];
    if (this.overallRating && !RATINGS.includes(this.overallRating)) {
      throw new ModelValidationError(
        `overallRating must be one of [${RATINGS.join(', ')}]`,
        'overallRating', this.overallRating
      );
    }

    // COMPLETED requires completedAt
    if (this.status === InspectionStatus.COMPLETED && !this.completedAt) {
      throw new ModelValidationError('completedAt required when status is COMPLETED', 'completedAt', null);
    }

    // completedAt must be after startedAt
    if (this.startedAt && this.completedAt &&
        new Date(this.completedAt) <= new Date(this.startedAt)) {
      throw new ModelValidationError('completedAt must be after startedAt', 'completedAt', this.completedAt);
    }

    // CANCELLED requires reason
    if ([InspectionStatus.CANCELLED, InspectionStatus.MISSED].includes(this.status) &&
        !this.cancellationReason && this.status === InspectionStatus.CANCELLED) {
      throw new ModelValidationError('cancellationReason required when CANCELLED', 'cancellationReason', null);
    }

    return this;
  }

  // ── Computed ───────────────────────────────────────────────────
  get observationCount() { return this.observations.length; }

  get criticalCount() {
    return this.observations.filter(o => o.severity === ObservationSeverity.CRITICAL).length;
  }

  get cautionCount() {
    return this.observations.filter(o => o.severity === ObservationSeverity.CAUTION).length;
  }

  get durationMinutes() {
    if (!this.startedAt || !this.completedAt) return null;
    return Math.round((new Date(this.completedAt) - new Date(this.startedAt)) / 60_000);
  }

  get isSigned() { return !!this.supervisorSignOff && !!this.supervisorSignedAt; }

  toJSON() {
    return {
      recordId: this.recordId, inspectionType: this.inspectionType,
      status: this.status, sectionId: this.sectionId,
      divisionCode: this.divisionCode, zoneCode: this.zoneCode,
      inspectorId: this.inspectorId, scheduledAt: this.scheduledAt,
      scheduleId: this.scheduleId, workOrderId: this.workOrderId,
      startedAt: this.startedAt, completedAt: this.completedAt,
      sectionLengthKm: this.sectionLengthKm,
      summary: this.summary, overallRating: this.overallRating,
      cancellationReason: this.cancellationReason,
      supervisorSignOff: this.supervisorSignOff, supervisorSignedAt: this.supervisorSignedAt,
      weatherConditions: this.weatherConditions, vehicleId: this.vehicleId,
      observations: this.observations,
      tqiMeasurement: this.tqiMeasurement,
      defectEventIds: this.defectEventIds, attachmentIds: this.attachmentIds,
      // Computed
      observationCount: this.observationCount,
      criticalCount: this.criticalCount,
      cautionCount: this.cautionCount,
      durationMinutes: this.durationMinutes,
      isSigned: this.isSigned,
      _schemaVersion: this._schemaVersion, _updatedAt: this._updatedAt,
    };
  }

  static fromJSON(obj) { return new InspectionRecord(obj); }
  static create(input) { return new InspectionRecord(input).validate(); }
}

// ══════════════════════════════════════════════════════════════════
//  EXPORTS
// ══════════════════════════════════════════════════════════════════

module.exports = {
  // Models
  InspectionSchedule,
  InspectionRecord,
  // Enums
  InspectionType,
  InspectionStatus,
  ObservationSeverity,
  ObservationStatus,
  MANDATED_FREQUENCY_DAYS,
  // Sub-schema builders
  createObservation,
  createTqiMeasurement,
};
