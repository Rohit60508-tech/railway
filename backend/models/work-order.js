/**
 * work-order.js
 * ─────────────────────────────────────────────────────────────────
 * Work order data model for the Indian Railways AI Maintenance
 * Orchestration Platform.
 *
 * A WorkOrder represents a sanctioned unit of maintenance or repair
 * work. It links one or more DefectEvents to a block window, a team,
 * and a set of resource requirements.
 *
 * Lifecycle:
 *   DRAFT → APPROVED → SCHEDULED → ACTIVE → COMPLETED → CLOSED
 *                ↓                              ↓
 *            REJECTED                        CANCELLED
 *
 * Key relationships:
 *   WorkOrder ← many → DefectEvent      (defects to be addressed)
 *   WorkOrder →   1  → BlockPlan        (traffic block required)
 *   WorkOrder →   1  → TeamResource     (allocated gang/team)
 *   WorkOrder ← many → Inspection       (post-work inspection)
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

const crypto = require('crypto');
const {
  ModelValidationError,
  requireString, requireEnum, requireIsoDate, requirePositiveNumber,
  optionalEnum, optionalIsoDate, optionalNumber, optionalBoolean, optionalArray,
  createGeoLocation,
  DefectDomain,
  DefectSeverity,
} = require('./defect-event');

// ══════════════════════════════════════════════════════════════════
//  ENUMS
// ══════════════════════════════════════════════════════════════════

const WorkOrderType = Object.freeze({
  CORRECTIVE:  'CORRECTIVE',   // Repairing a known defect
  PREVENTIVE:  'PREVENTIVE',   // Scheduled/planned maintenance
  PREDICTIVE:  'PREDICTIVE',   // AI-triggered before failure
  EMERGENCY:   'EMERGENCY',    // Immediate safety intervention
  INSPECTION:  'INSPECTION',   // Inspection-only (no rectification)
  RENEWAL:     'RENEWAL',      // Asset renewal / replacement
  SPECIAL:     'SPECIAL',      // Special works (monsoon, post-disaster)
});

const WorkOrderStatus = Object.freeze({
  DRAFT:       'DRAFT',        // Created, pending approval
  APPROVED:    'APPROVED',     // Approved by competent authority
  REJECTED:    'REJECTED',     // Rejected at approval stage
  SCHEDULED:   'SCHEDULED',    // Block window allocated
  ACTIVE:      'ACTIVE',       // Work physically underway
  COMPLETED:   'COMPLETED',    // Work done, pending sign-off
  CLOSED:      'CLOSED',       // Sign-off complete, records updated
  CANCELLED:   'CANCELLED',    // Cancelled before commencement
});

const ApprovalAuthority = Object.freeze({
  JE:          'JE',           // Junior Engineer
  SE:          'SE',           // Section Engineer
  AEN:         'AEN',          // Assistant Divisional Engineer
  DEN:         'DEN',          // Divisional Engineer (North/South)
  SEN:         'SEN',          // Senior Divisional Engineer
  CWE:         'CWE',          // Chief Works Engineer (zonal)
  SYSTEM:      'SYSTEM',       // Auto-approved by platform rules
});

const WorkCategory = Object.freeze({
  // Civil
  TRACK_MAINTENANCE:   'TRACK_MAINTENANCE',
  BRIDGE_MAINTENANCE:  'BRIDGE_MAINTENANCE',
  TRACK_RENEWAL:       'TRACK_RENEWAL',
  EARTHWORK:           'EARTHWORK',
  // Signal
  SIGNAL_MAINTENANCE:  'SIGNAL_MAINTENANCE',
  CABLE_WORKS:         'CABLE_WORKS',
  TELECOM:             'TELECOM',
  // Electrical
  OHE_MAINTENANCE:     'OHE_MAINTENANCE',
  SUBSTATION_WORKS:    'SUBSTATION_WORKS',
  // Multi-department
  LEVEL_CROSSING:      'LEVEL_CROSSING',
  SPECIAL_WORKS:       'SPECIAL_WORKS',
});

const ResourceType = Object.freeze({
  LABOUR:    'LABOUR',         // Gang / trackmen
  MACHINE:   'MACHINE',        // Tamping, rail crane, etc.
  MATERIAL:  'MATERIAL',       // Rails, sleepers, fittings
  VEHICLE:   'VEHICLE',        // Inspection/transport vehicles
  EQUIPMENT: 'EQUIPMENT',      // Specialised tools
});

// ══════════════════════════════════════════════════════════════════
//  SUB-SCHEMAS
// ══════════════════════════════════════════════════════════════════

/**
 * @typedef {object} ResourceRequirement
 * @property {string}      type        - ResourceType enum
 * @property {string}      description - What is needed
 * @property {number}      quantity    - Amount required
 * @property {string|null} unit        - e.g. 'nos', 'metres', 'MT', 'hours'
 * @property {boolean}     isAllocated - Whether resource has been confirmed
 * @property {string|null} allocatedId - Reference to allocated resource entity
 */
function createResourceRequirement(input = {}) {
  if (!Object.values(ResourceType).includes(input.type)) {
    throw new ModelValidationError(
      `ResourceRequirement.type must be one of [${Object.values(ResourceType).join(', ')}]`,
      'type', input.type
    );
  }
  if (typeof input.quantity !== 'number' || input.quantity <= 0) {
    throw new ModelValidationError('ResourceRequirement.quantity must be positive', 'quantity', input.quantity);
  }
  return Object.freeze({
    type:        input.type,
    description: input.description ?? null,
    quantity:    input.quantity,
    unit:        input.unit        ?? null,
    isAllocated: input.isAllocated ?? false,
    allocatedId: input.allocatedId ?? null,
  });
}

/**
 * @typedef {object} ApprovalStep
 * @property {string}      authority    - ApprovalAuthority enum
 * @property {string|null} approverName - Display name of approver
 * @property {string|null} approverId   - Staff ID
 * @property {string}      decision     - 'APPROVED' | 'REJECTED' | 'PENDING'
 * @property {string|null} remarks      - Approval / rejection note
 * @property {string|null} decidedAt    - ISO-8601
 */
function createApprovalStep(input = {}) {
  if (!Object.values(ApprovalAuthority).includes(input.authority)) {
    throw new ModelValidationError(
      `ApprovalStep.authority must be a valid ApprovalAuthority`,
      'authority', input.authority
    );
  }
  const DECISIONS = ['APPROVED', 'REJECTED', 'PENDING'];
  if (!DECISIONS.includes(input.decision)) {
    throw new ModelValidationError(
      `ApprovalStep.decision must be one of [${DECISIONS.join(', ')}]`,
      'decision', input.decision
    );
  }
  return Object.freeze({
    authority:    input.authority,
    approverName: input.approverName ?? null,
    approverId:   input.approverId   ?? null,
    decision:     input.decision,
    remarks:      input.remarks      ?? null,
    decidedAt:    input.decidedAt    ?? null,
  });
}

/**
 * @typedef {object} SafetyChecklist
 * @property {boolean} issuedCautionOrder    - Caution Order issued to drivers
 * @property {boolean} gateLockApplied       - Gate lock / block instrument locked
 * @property {boolean} staffBriefed          - Gang safety briefing done
 * @property {boolean} firstAidAvailable     - First-aid kit on site
 * @property {boolean} watchmanPosted        - Watchman / banner flag posted
 * @property {string|null} verifiedBy        - Staff ID who verified checklist
 * @property {string|null} verifiedAt        - ISO-8601
 */
function createSafetyChecklist(input = {}) {
  const fields = ['issuedCautionOrder','gateLockApplied','staffBriefed','firstAidAvailable','watchmanPosted'];
  const checklist = {};
  for (const f of fields) {
    if (input[f] != null && typeof input[f] !== 'boolean') {
      throw new ModelValidationError(`SafetyChecklist.${f} must be a boolean`, f, input[f]);
    }
    checklist[f] = input[f] ?? false;
  }
  return Object.freeze({
    ...checklist,
    verifiedBy: input.verifiedBy ?? null,
    verifiedAt: input.verifiedAt ?? null,
  });
}

// ══════════════════════════════════════════════════════════════════
//  WORK ORDER MODEL
// ══════════════════════════════════════════════════════════════════

/**
 * @typedef {object} WorkOrder
 *
 * @required
 * @property {string}   workOrderId     - UUID
 * @property {string}   type            - WorkOrderType enum
 * @property {string}   status          - WorkOrderStatus enum
 * @property {string}   department      - DefectDomain (responsible dept)
 * @property {string}   workCategory    - WorkCategory enum
 * @property {string}   priority        - DefectSeverity (inherited from driving defect)
 * @property {string}   sectionId       - Target section
 * @property {string}   divisionCode
 * @property {string}   zoneCode
 * @property {string}   createdAt       - ISO-8601
 * @property {string}   createdBy       - Staff ID of work order creator
 *
 * @optional
 * @property {string[]}         defectIds        - Linked DefectEvent IDs
 * @property {string|null}      blockPlanId      - Linked block plan
 * @property {string|null}      teamResourceId   - Allocated team
 * @property {string|null}      title            - Short descriptive title
 * @property {string|null}      description      - Detailed work description
 * @property {string|null}      remarks          - Additional notes
 * @property {number|null}      estimatedDurationHours
 * @property {number|null}      estimatedCostINR
 * @property {number|null}      actualDurationHours
 * @property {number|null}      actualCostINR
 * @property {GeoLocation}      location
 * @property {ApprovalStep[]}   approvalChain
 * @property {ResourceRequirement[]} resources
 * @property {SafetyChecklist}  safetyChecklist
 * @property {string[]}         attachmentIds    - References to uploaded docs/photos
 * @property {string|null}      scheduledStart   - ISO-8601
 * @property {string|null}      scheduledEnd     - ISO-8601
 * @property {string|null}      actualStart      - ISO-8601
 * @property {string|null}      actualEnd        - ISO-8601
 */
class WorkOrder {
  constructor(input = {}) {
    // Required
    this.workOrderId  = input.workOrderId ?? crypto.randomUUID();
    this.type         = input.type;
    this.status       = input.status      ?? WorkOrderStatus.DRAFT;
    this.department   = input.department;
    this.workCategory = input.workCategory;
    this.priority     = input.priority;
    this.sectionId    = input.sectionId;
    this.divisionCode = input.divisionCode;
    this.zoneCode     = input.zoneCode;
    this.createdAt    = input.createdAt   ?? new Date().toISOString();
    this.createdBy    = input.createdBy;

    // Optional scalars
    this.title               = input.title               ?? null;
    this.description         = input.description         ?? null;
    this.remarks             = input.remarks             ?? null;
    this.blockPlanId         = input.blockPlanId         ?? null;
    this.teamResourceId      = input.teamResourceId      ?? null;
    this.estimatedDurationHours = input.estimatedDurationHours ?? null;
    this.estimatedCostINR    = input.estimatedCostINR    ?? null;
    this.actualDurationHours = input.actualDurationHours ?? null;
    this.actualCostINR       = input.actualCostINR       ?? null;
    this.completionNotes     = input.completionNotes     ?? null;
    this.closedBy            = input.closedBy            ?? null;
    this.cancelledReason     = input.cancelledReason     ?? null;

    // Arrays
    this.defectIds     = Array.isArray(input.defectIds)     ? [...input.defectIds]     : [];
    this.attachmentIds = Array.isArray(input.attachmentIds) ? [...input.attachmentIds] : [];
    this.approvalChain = Array.isArray(input.approvalChain)
      ? input.approvalChain.map(createApprovalStep)
      : [];
    this.resources     = Array.isArray(input.resources)
      ? input.resources.map(createResourceRequirement)
      : [];

    // Sub-schemas
    this.location        = input.location ? createGeoLocation(input.location) : createGeoLocation();
    this.safetyChecklist = createSafetyChecklist(input.safetyChecklist ?? {});

    // Date fields
    this.scheduledStart = input.scheduledStart ?? null;
    this.scheduledEnd   = input.scheduledEnd   ?? null;
    this.actualStart    = input.actualStart    ?? null;
    this.actualEnd      = input.actualEnd      ?? null;
    this.approvedAt     = input.approvedAt     ?? null;
    this.closedAt       = input.closedAt       ?? null;

    // Platform metadata
    this._schemaVersion = '1.0';
    this._createdAt     = new Date().toISOString();
    this._updatedAt     = new Date().toISOString();
  }

  // ── Validation ─────────────────────────────────────────────────
  validate() {
    requireString(this, 'workOrderId');
    requireEnum(this, 'type',         WorkOrderType);
    requireEnum(this, 'status',       WorkOrderStatus);
    requireEnum(this, 'department',   DefectDomain);
    requireEnum(this, 'workCategory', WorkCategory);
    requireEnum(this, 'priority',     DefectSeverity);
    requireString(this, 'sectionId');
    requireString(this, 'divisionCode');
    requireString(this, 'zoneCode');
    requireString(this, 'createdBy');
    requireIsoDate(this, 'createdAt');

    optionalNumber(this, 'estimatedDurationHours', 0.25);
    optionalNumber(this, 'estimatedCostINR', 0);
    optionalNumber(this, 'actualDurationHours', 0);
    optionalNumber(this, 'actualCostINR', 0);
    optionalIsoDate(this, 'scheduledStart');
    optionalIsoDate(this, 'scheduledEnd');
    optionalIsoDate(this, 'actualStart');
    optionalIsoDate(this, 'actualEnd');
    optionalIsoDate(this, 'approvedAt');
    optionalIsoDate(this, 'closedAt');

    // Cross-field: scheduledEnd must be after scheduledStart
    if (this.scheduledStart && this.scheduledEnd &&
        new Date(this.scheduledEnd) <= new Date(this.scheduledStart)) {
      throw new ModelValidationError(
        'scheduledEnd must be after scheduledStart',
        'scheduledEnd', this.scheduledEnd
      );
    }

    // Cross-field: EMERGENCY type must have HIGH or CRITICAL priority
    if (this.type === WorkOrderType.EMERGENCY &&
        !['HIGH', 'CRITICAL'].includes(this.priority)) {
      throw new ModelValidationError(
        'EMERGENCY work orders must have HIGH or CRITICAL priority',
        'priority', this.priority
      );
    }

    // Cross-field: CLOSED status requires closedAt and closedBy
    if (this.status === WorkOrderStatus.CLOSED) {
      if (!this.closedAt) throw new ModelValidationError('closedAt required when CLOSED', 'closedAt', null);
      if (!this.closedBy) throw new ModelValidationError('closedBy required when CLOSED', 'closedBy', null);
    }

    // Cross-field: CANCELLED requires reason
    if (this.status === WorkOrderStatus.CANCELLED && !this.cancelledReason) {
      throw new ModelValidationError(
        'cancelledReason is required when status is CANCELLED',
        'cancelledReason', null
      );
    }

    return this;
  }

  // ── Computed properties ────────────────────────────────────────
  /** True if work order has cleared the full approval chain */
  get isFullyApproved() {
    return this.approvalChain.length > 0 &&
      this.approvalChain.every(s => s.decision === 'APPROVED');
  }

  /** Pending approval step (if any) */
  get pendingApproval() {
    return this.approvalChain.find(s => s.decision === 'PENDING') ?? null;
  }

  /** Cost variance (actual - estimated), null if either is unavailable */
  get costVarianceINR() {
    if (this.actualCostINR == null || this.estimatedCostINR == null) return null;
    return this.actualCostINR - this.estimatedCostINR;
  }

  /** Duration variance in hours */
  get durationVarianceHours() {
    if (this.actualDurationHours == null || this.estimatedDurationHours == null) return null;
    return this.actualDurationHours - this.estimatedDurationHours;
  }

  /** All resource requirements have been allocated */
  get allResourcesAllocated() {
    return this.resources.length > 0 && this.resources.every(r => r.isAllocated);
  }

  toJSON() {
    return {
      workOrderId:            this.workOrderId,
      type:                   this.type,
      status:                 this.status,
      department:             this.department,
      workCategory:           this.workCategory,
      priority:               this.priority,
      sectionId:              this.sectionId,
      divisionCode:           this.divisionCode,
      zoneCode:               this.zoneCode,
      createdAt:              this.createdAt,
      createdBy:              this.createdBy,
      title:                  this.title,
      description:            this.description,
      remarks:                this.remarks,
      blockPlanId:            this.blockPlanId,
      teamResourceId:         this.teamResourceId,
      defectIds:              this.defectIds,
      attachmentIds:          this.attachmentIds,
      approvalChain:          this.approvalChain,
      resources:              this.resources,
      safetyChecklist:        this.safetyChecklist,
      location:               this.location,
      estimatedDurationHours: this.estimatedDurationHours,
      estimatedCostINR:       this.estimatedCostINR,
      actualDurationHours:    this.actualDurationHours,
      actualCostINR:          this.actualCostINR,
      completionNotes:        this.completionNotes,
      closedBy:               this.closedBy,
      cancelledReason:        this.cancelledReason,
      scheduledStart:         this.scheduledStart,
      scheduledEnd:           this.scheduledEnd,
      actualStart:            this.actualStart,
      actualEnd:              this.actualEnd,
      approvedAt:             this.approvedAt,
      closedAt:               this.closedAt,
      // Computed
      isFullyApproved:        this.isFullyApproved,
      pendingApproval:        this.pendingApproval,
      costVarianceINR:        this.costVarianceINR,
      durationVarianceHours:  this.durationVarianceHours,
      allResourcesAllocated:  this.allResourcesAllocated,
      _schemaVersion:         this._schemaVersion,
      _updatedAt:             this._updatedAt,
    };
  }

  static fromJSON(obj) { return new WorkOrder(obj); }
  static create(input) { return new WorkOrder(input).validate(); }
}

// ══════════════════════════════════════════════════════════════════
//  EXPORTS
// ══════════════════════════════════════════════════════════════════

module.exports = {
  WorkOrder,
  WorkOrderType,
  WorkOrderStatus,
  ApprovalAuthority,
  WorkCategory,
  ResourceType,
  createResourceRequirement,
  createApprovalStep,
  createSafetyChecklist,
};
