/**
 * block-plan.js
 * ─────────────────────────────────────────────────────────────────
 * Block schedule data model for the Indian Railways AI Maintenance
 * Orchestration Platform.
 *
 * A BlockPlan represents a sanctioned traffic block — a period during
 * which a track section is withdrawn from train operations to permit
 * maintenance work. It is the core scheduling primitive that ties
 * work orders, teams, and traffic operations together.
 *
 * Block Types (per Indian Railways Traffic Book):
 *   ENGINEERING  — Civil department maintenance (most common)
 *   SIGNAL       — S&T department maintenance
 *   TRACTION     — Electrical OHE or substation work
 *   COMBINED     — Multi-department block (Civil + S&T, etc.)
 *   EMERGENCY    — Unplanned, immediate safety closure
 *   CAUTION      — Reduced-speed section (no full closure)
 *
 * Lifecycle:
 *   DRAFT → REQUESTED → SANCTIONED → ACTIVE → COMPLETED
 *                ↓                      ↓
 *           REJECTED               CANCELLED
 *
 * Key relationships:
 *   BlockPlan ← many → WorkOrder     (work to be done in this block)
 *   BlockPlan →   1  → TrainMovement (traffic impact reference)
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

const crypto = require('crypto');
const {
  ModelValidationError,
  requireString, requireEnum, requireIsoDate, requirePositiveNumber,
  optionalIsoDate, optionalNumber, optionalBoolean, optionalArray,
  createGeoLocation,
} = require('./defect-event');

// ══════════════════════════════════════════════════════════════════
//  ENUMS
// ══════════════════════════════════════════════════════════════════

const BlockType = Object.freeze({
  ENGINEERING: 'ENGINEERING',
  SIGNAL:      'SIGNAL',
  TRACTION:    'TRACTION',
  COMBINED:    'COMBINED',
  EMERGENCY:   'EMERGENCY',
  CAUTION:     'CAUTION',     // Caution Order — speed restriction, not closure
});

const BlockStatus = Object.freeze({
  DRAFT:      'DRAFT',        // Being prepared by maintenance planner
  REQUESTED:  'REQUESTED',    // Submitted to Operations Control for sanction
  SANCTIONED: 'SANCTIONED',   // Approved — block is scheduled
  ACTIVE:     'ACTIVE',       // Block is live (section withdrawn from traffic)
  COMPLETED:  'COMPLETED',    // Block lifted — section restored to traffic
  REJECTED:   'REJECTED',     // Not sanctioned by Operations Control
  CANCELLED:  'CANCELLED',    // Withdrawn before activation
});

const TrafficImpact = Object.freeze({
  SECTION_CLOSED:   'SECTION_CLOSED',    // Full closure, no traffic
  SINGLE_LINE:      'SINGLE_LINE',       // One track of doubling working
  SPEED_RESTRICTED: 'SPEED_RESTRICTED',  // Traffic continues at reduced speed
  MINIMAL:          'MINIMAL',           // Night window, very few trains affected
});

const RestorationStatus = Object.freeze({
  NOT_STARTED:  'NOT_STARTED',
  IN_PROGRESS:  'IN_PROGRESS',
  RESTORED:     'RESTORED',     // Physical work done; awaiting formal clearance
  CERTIFIED:    'CERTIFIED',    // Formally certified safe by Engineer-in-charge
});

// ══════════════════════════════════════════════════════════════════
//  SUB-SCHEMAS
// ══════════════════════════════════════════════════════════════════

/**
 * @typedef {object} TrainAffected
 * @property {string}      trainNo         - Train number
 * @property {string}      trainName       - Display name
 * @property {string}      affectType      - 'CANCELLED' | 'DIVERTED' | 'DELAYED' | 'RESCHEDULED'
 * @property {number|null} estimatedDelayMin - Delay in minutes
 * @property {string|null} alternateRoute  - Diversion route code
 */
function createTrainAffected(input = {}) {
  const AFFECT_TYPES = ['CANCELLED', 'DIVERTED', 'DELAYED', 'RESCHEDULED'];
  if (typeof input.trainNo !== 'string' || !input.trainNo) {
    throw new ModelValidationError('TrainAffected.trainNo must be a non-empty string', 'trainNo', input.trainNo);
  }
  if (!AFFECT_TYPES.includes(input.affectType)) {
    throw new ModelValidationError(
      `TrainAffected.affectType must be one of [${AFFECT_TYPES.join(', ')}]`,
      'affectType', input.affectType
    );
  }
  return Object.freeze({
    trainNo:           input.trainNo,
    trainName:         input.trainName          ?? null,
    affectType:        input.affectType,
    estimatedDelayMin: input.estimatedDelayMin  ?? null,
    alternateRoute:    input.alternateRoute      ?? null,
  });
}

/**
 * @typedef {object} BlockWindow
 * @property {string}  startAt       - ISO-8601 UTC — block start
 * @property {string}  endAt         - ISO-8601 UTC — block end
 * @property {number}  durationMinutes
 * @property {string}  dayOfWeek     - 'MON' | 'TUE' | … | 'SUN'
 * @property {boolean} isNightBlock  - True if predominantly 22:00–06:00
 * @property {boolean} isWeekend     - SAT or SUN
 */
function createBlockWindow(input = {}) {
  if (typeof input.startAt !== 'string' || isNaN(new Date(input.startAt))) {
    throw new ModelValidationError('BlockWindow.startAt must be a valid ISO-8601 date', 'startAt', input.startAt);
  }
  if (typeof input.endAt !== 'string' || isNaN(new Date(input.endAt))) {
    throw new ModelValidationError('BlockWindow.endAt must be a valid ISO-8601 date', 'endAt', input.endAt);
  }
  const start = new Date(input.startAt);
  const end   = new Date(input.endAt);
  if (end <= start) {
    throw new ModelValidationError('BlockWindow.endAt must be after startAt', 'endAt', input.endAt);
  }
  const durationMinutes = Math.round((end - start) / 60_000);
  if (durationMinutes < 15) {
    throw new ModelValidationError('Block window must be at least 15 minutes', 'durationMinutes', durationMinutes);
  }
  const DAYS = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
  const dayOfWeek = DAYS[start.getUTCDay()];
  const startHour = start.getUTCHours();
  const isNightBlock = startHour >= 22 || startHour < 6;
  const isWeekend    = dayOfWeek === 'SAT' || dayOfWeek === 'SUN';

  return Object.freeze({
    startAt:         input.startAt,
    endAt:           input.endAt,
    durationMinutes,
    dayOfWeek,
    isNightBlock,
    isWeekend,
  });
}

/**
 * @typedef {object} BlockExtension
 * @property {number}      addedMinutes    - Extension duration in minutes
 * @property {string}      reason          - Reason for extension
 * @property {string|null} requestedBy     - Staff ID
 * @property {string|null} approvedBy      - OCC staff ID
 * @property {string}      requestedAt     - ISO-8601
 */
function createBlockExtension(input = {}) {
  if (typeof input.addedMinutes !== 'number' || input.addedMinutes <= 0) {
    throw new ModelValidationError('BlockExtension.addedMinutes must be a positive number', 'addedMinutes', input.addedMinutes);
  }
  if (!input.reason) {
    throw new ModelValidationError('BlockExtension.reason is required', 'reason', null);
  }
  return Object.freeze({
    addedMinutes: input.addedMinutes,
    reason:       input.reason,
    requestedBy:  input.requestedBy ?? null,
    approvedBy:   input.approvedBy  ?? null,
    requestedAt:  input.requestedAt ?? new Date().toISOString(),
  });
}

// ══════════════════════════════════════════════════════════════════
//  BLOCK PLAN MODEL
// ══════════════════════════════════════════════════════════════════

/**
 * @typedef {object} BlockPlan
 *
 * @required
 * @property {string}      blockId          - UUID
 * @property {string}      blockType        - BlockType enum
 * @property {string}      status           - BlockStatus enum
 * @property {string}      sectionId        - Section being blocked
 * @property {string}      divisionCode
 * @property {string}      zoneCode
 * @property {string}      requestedBy      - Staff ID of requesting engineer
 * @property {string}      requestedAt      - ISO-8601
 * @property {BlockWindow} window           - Requested time window
 *
 * @optional
 * @property {string|null}   title              - Short description
 * @property {string|null}   workDescription    - Detailed work description
 * @property {string[]}      workOrderIds       - Linked WorkOrder IDs
 * @property {string[]}      departments        - Departments involved (for COMBINED blocks)
 * @property {string|null}   occStaffId         - Operations Control Centre approver
 * @property {string|null}   engineerInChargeId - Engineer certifying restoration
 * @property {TrafficImpact} trafficImpact
 * @property {number|null}   cautionSpeedKmh    - For CAUTION blocks
 * @property {TrainAffected[]} trainsAffected
 * @property {BlockExtension[]} extensions      - Extensions granted during block
 * @property {RestorationStatus} restorationStatus
 * @property {string|null}   restoredAt         - ISO-8601 (section back to traffic)
 * @property {string|null}   certifiedAt        - ISO-8601 (engineer sign-off)
 * @property {GeoLocation}   fromLocation       - Block start point
 * @property {GeoLocation}   toLocation         - Block end point
 * @property {number|null}   utilizationPct     - Actual work time / block duration × 100
 * @property {string[]}      conflictingBlockIds - Detected scheduling conflicts
 */
class BlockPlan {
  constructor(input = {}) {
    this.blockId     = input.blockId  ?? crypto.randomUUID();
    this.blockType   = input.blockType;
    this.status      = input.status   ?? BlockStatus.DRAFT;
    this.sectionId   = input.sectionId;
    this.divisionCode = input.divisionCode;
    this.zoneCode    = input.zoneCode;
    this.requestedBy = input.requestedBy;
    this.requestedAt = input.requestedAt ?? new Date().toISOString();

    // Block window (required)
    if (!input.window) throw new ModelValidationError('BlockPlan.window is required', 'window', null);
    this.window = createBlockWindow(input.window);

    // Optional scalars
    this.title              = input.title              ?? null;
    this.workDescription    = input.workDescription    ?? null;
    this.occStaffId         = input.occStaffId         ?? null;
    this.engineerInChargeId = input.engineerInChargeId ?? null;
    this.trafficImpact      = input.trafficImpact      ?? TrafficImpact.SECTION_CLOSED;
    this.cautionSpeedKmh    = input.cautionSpeedKmh    ?? null;
    this.restorationStatus  = input.restorationStatus  ?? RestorationStatus.NOT_STARTED;
    this.restoredAt         = input.restoredAt         ?? null;
    this.certifiedAt        = input.certifiedAt        ?? null;
    this.sanctionedAt       = input.sanctionedAt       ?? null;
    this.rejectedAt         = input.rejectedAt         ?? null;
    this.rejectionReason    = input.rejectionReason    ?? null;
    this.utilizationPct     = input.utilizationPct     ?? null;

    // Arrays
    this.workOrderIds     = Array.isArray(input.workOrderIds)     ? [...input.workOrderIds]     : [];
    this.departments      = Array.isArray(input.departments)      ? [...input.departments]      : [];
    this.conflictingBlockIds = Array.isArray(input.conflictingBlockIds) ? [...input.conflictingBlockIds] : [];
    this.trainsAffected   = Array.isArray(input.trainsAffected)
      ? input.trainsAffected.map(createTrainAffected)
      : [];
    this.extensions       = Array.isArray(input.extensions)
      ? input.extensions.map(createBlockExtension)
      : [];

    // Sub-schemas
    this.fromLocation = input.fromLocation ? createGeoLocation(input.fromLocation) : createGeoLocation();
    this.toLocation   = input.toLocation   ? createGeoLocation(input.toLocation)   : createGeoLocation();

    // Platform metadata
    this._schemaVersion = '1.0';
    this._createdAt     = new Date().toISOString();
    this._updatedAt     = new Date().toISOString();
  }

  // ── Validation ─────────────────────────────────────────────────
  validate() {
    requireString(this, 'blockId');
    requireEnum(this, 'blockType', BlockType);
    requireEnum(this, 'status',    BlockStatus);
    requireEnum(this, 'trafficImpact', TrafficImpact);
    requireEnum(this, 'restorationStatus', RestorationStatus);
    requireString(this, 'sectionId');
    requireString(this, 'divisionCode');
    requireString(this, 'zoneCode');
    requireString(this, 'requestedBy');
    requireIsoDate(this, 'requestedAt');

    optionalNumber(this, 'cautionSpeedKmh', 10, 100);
    optionalNumber(this, 'utilizationPct',  0, 100);
    optionalIsoDate(this, 'sanctionedAt');
    optionalIsoDate(this, 'rejectedAt');
    optionalIsoDate(this, 'restoredAt');
    optionalIsoDate(this, 'certifiedAt');

    // CAUTION block must have cautionSpeedKmh
    if (this.blockType === BlockType.CAUTION && !this.cautionSpeedKmh) {
      throw new ModelValidationError(
        'CAUTION blocks require cautionSpeedKmh',
        'cautionSpeedKmh', null
      );
    }

    // COMBINED block must have ≥ 2 departments
    if (this.blockType === BlockType.COMBINED && this.departments.length < 2) {
      throw new ModelValidationError(
        'COMBINED blocks must list at least 2 departments',
        'departments', this.departments
      );
    }

    // COMPLETED block must have restoredAt and CERTIFIED restoration
    if (this.status === BlockStatus.COMPLETED) {
      if (!this.restoredAt) {
        throw new ModelValidationError('COMPLETED block requires restoredAt', 'restoredAt', null);
      }
      if (this.restorationStatus !== RestorationStatus.CERTIFIED) {
        throw new ModelValidationError(
          'COMPLETED block restorationStatus must be CERTIFIED',
          'restorationStatus', this.restorationStatus
        );
      }
    }

    // REJECTED block must have rejectionReason
    if (this.status === BlockStatus.REJECTED && !this.rejectionReason) {
      throw new ModelValidationError('REJECTED block requires rejectionReason', 'rejectionReason', null);
    }

    return this;
  }

  // ── Computed properties ────────────────────────────────────────
  /** Total block duration in minutes (including extensions) */
  get totalDurationMinutes() {
    const extMins = this.extensions.reduce((s, e) => s + e.addedMinutes, 0);
    return this.window.durationMinutes + extMins;
  }

  /** True if block has any detected scheduling conflicts */
  get hasConflicts() { return this.conflictingBlockIds.length > 0; }

  /** Number of trains affected */
  get trainsAffectedCount() { return this.trainsAffected.length; }

  /** Estimated total delay across all affected trains (minutes) */
  get totalEstimatedDelayMin() {
    return this.trainsAffected.reduce((s, t) => s + (t.estimatedDelayMin ?? 0), 0);
  }

  /** True if block is currently live */
  get isLive() { return this.status === BlockStatus.ACTIVE; }

  toJSON() {
    return {
      blockId:              this.blockId,
      blockType:            this.blockType,
      status:               this.status,
      sectionId:            this.sectionId,
      divisionCode:         this.divisionCode,
      zoneCode:             this.zoneCode,
      requestedBy:          this.requestedBy,
      requestedAt:          this.requestedAt,
      window:               this.window,
      title:                this.title,
      workDescription:      this.workDescription,
      workOrderIds:         this.workOrderIds,
      departments:          this.departments,
      occStaffId:           this.occStaffId,
      engineerInChargeId:   this.engineerInChargeId,
      trafficImpact:        this.trafficImpact,
      cautionSpeedKmh:      this.cautionSpeedKmh,
      restorationStatus:    this.restorationStatus,
      restoredAt:           this.restoredAt,
      certifiedAt:          this.certifiedAt,
      sanctionedAt:         this.sanctionedAt,
      rejectedAt:           this.rejectedAt,
      rejectionReason:      this.rejectionReason,
      utilizationPct:       this.utilizationPct,
      trainsAffected:       this.trainsAffected,
      extensions:           this.extensions,
      conflictingBlockIds:  this.conflictingBlockIds,
      fromLocation:         this.fromLocation,
      toLocation:           this.toLocation,
      // Computed
      totalDurationMinutes:    this.totalDurationMinutes,
      hasConflicts:            this.hasConflicts,
      trainsAffectedCount:     this.trainsAffectedCount,
      totalEstimatedDelayMin:  this.totalEstimatedDelayMin,
      isLive:                  this.isLive,
      _schemaVersion:          this._schemaVersion,
      _updatedAt:              this._updatedAt,
    };
  }

  static fromJSON(obj) { return new BlockPlan(obj); }
  static create(input) { return new BlockPlan(input).validate(); }
}

// ══════════════════════════════════════════════════════════════════
//  EXPORTS
// ══════════════════════════════════════════════════════════════════

module.exports = {
  BlockPlan,
  BlockType,
  BlockStatus,
  TrafficImpact,
  RestorationStatus,
  createBlockWindow,
  createTrainAffected,
  createBlockExtension,
};
