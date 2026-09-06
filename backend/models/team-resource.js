/**
 * team-resource.js
 * ─────────────────────────────────────────────────────────────────
 * Team and resource data models for the Indian Railways AI
 * Maintenance Orchestration Platform.
 *
 * Covers three related entities:
 *
 *  1. StaffMember — Individual engineer, supervisor, or field worker
 *     profile with skills, certifications, and availability.
 *
 *  2. MaintenanceGang — The primary field deployment unit in Indian
 *     Railways (analogous to a crew/team). A gang is a named group
 *     of trackmen with a KeyMan or Gangmate in charge, assigned to
 *     a specific section. Gangs are allocated to work orders and
 *     block windows.
 *
 *  3. Equipment — Rolling plant, machines, and major tools that
 *     require explicit allocation and scheduling (tamping machines,
 *     rail cranes, USFD trolleys, OHE tower wagons, etc.).
 *
 * Key relationships:
 *   MaintenanceGang → many → StaffMember   (gang members)
 *   WorkOrder      →   1  → MaintenanceGang (allocated gang)
 *   WorkOrder      → many → Equipment       (allocated machines)
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

const crypto = require('crypto');
const {
  ModelValidationError,
  requireString, requireEnum,
  optionalIsoDate, optionalNumber, optionalBoolean,
} = require('./defect-event');

// ══════════════════════════════════════════════════════════════════
//  ENUMS
// ══════════════════════════════════════════════════════════════════

const StaffRole = Object.freeze({
  // Engineering
  JE:          'JE',           // Junior Engineer
  SE:          'SE',           // Section Engineer
  AEN:         'AEN',          // Asst. Divisional Engineer
  DEN:         'DEN',          // Divisional Engineer
  // Field
  KEYMAN:      'KEYMAN',       // Gang KeyMan (track patrol)
  GANGMATE:    'GANGMATE',     // Gangmate (senior field worker)
  TRACKMAN:    'TRACKMAN',     // Track maintainer
  WELDER:      'WELDER',       // Alumino-thermit / Flash butt welder
  SIGNALLER:   'SIGNALLER',    // Signal maintainer
  OHE_STAFF:   'OHE_STAFF',   // OHE supervisor / linesman
  USFD_OP:     'USFD_OP',     // USFD trolley operator
  DRIVER:      'DRIVER',       // Vehicle / tamping machine driver
  SUPERVISOR:  'SUPERVISOR',  // Generic supervisor
  OTHER:       'OTHER',
});

const CertificationType = Object.freeze({
  SAFETY_COUNSELLING: 'SAFETY_COUNSELLING',  // Annual refresher (mandatory all staff)
  TRACK_SUPERVISION:  'TRACK_SUPERVISION',   // For supervising track work
  OHE_SUPERVISION:    'OHE_SUPERVISION',     // For working near live OHE
  USFD_OPERATOR:      'USFD_OPERATOR',       // Ultrasonic flaw detection operator
  WELDING:            'WELDING',             // AT / Flash butt welding
  MACHINE_OPERATOR:   'MACHINE_OPERATOR',    // Heavy plant operator
  FIRST_AID:          'FIRST_AID',           // Mandatory for gang supervisors
  DRONE_PILOT:        'DRONE_PILOT',         // UAV pilot certification
});

const AvailabilityStatus = Object.freeze({
  AVAILABLE:    'AVAILABLE',
  DEPLOYED:     'DEPLOYED',     // Currently on an active work order
  ON_LEAVE:     'ON_LEAVE',
  TRAINING:     'TRAINING',
  SICK:         'SICK',
  OFF_DUTY:     'OFF_DUTY',
  SUSPENDED:    'SUSPENDED',
});

const GangType = Object.freeze({
  TRACK:        'TRACK',        // Standard track maintenance gang
  BRIDGE:       'BRIDGE',       // Bridge inspection/repair
  SIGNAL:       'SIGNAL',       // S&T gang
  OHE:          'OHE',          // Overhead equipment
  WELDING:      'WELDING',      // Specialist weld gang
  MACHINE:      'MACHINE',      // Machine gang (tamping, packing)
  MULTI:        'MULTI',        // Multi-disciplinary for combined blocks
});

const EquipmentType = Object.freeze({
  TAMPING_MACHINE:    'TAMPING_MACHINE',
  RAIL_CRANE:         'RAIL_CRANE',
  BALLAST_CLEANER:    'BALLAST_CLEANER',
  TRACK_RECORDING_CAR:'TRACK_RECORDING_CAR',
  USFD_TROLLEY:       'USFD_TROLLEY',
  OHE_TOWER_WAGON:    'OHE_TOWER_WAGON',
  MOTOR_TROLLEY:      'MOTOR_TROLLEY',
  RAIL_GRINDER:       'RAIL_GRINDER',
  WELD_EQUIPMENT:     'WELD_EQUIPMENT',
  DRONE_UAV:          'DRONE_UAV',
  INSPECTION_VEHICLE: 'INSPECTION_VEHICLE',
  GENERATOR:          'GENERATOR',
  OTHER:              'OTHER',
});

const EquipmentStatus = Object.freeze({
  AVAILABLE:    'AVAILABLE',
  DEPLOYED:     'DEPLOYED',
  IN_MAINTENANCE:'IN_MAINTENANCE',
  BREAKDOWN:    'BREAKDOWN',
  RETIRED:      'RETIRED',
});

// ══════════════════════════════════════════════════════════════════
//  SUB-SCHEMA: CERTIFICATION
// ══════════════════════════════════════════════════════════════════

/**
 * @typedef {object} Certification
 * @property {string}      type         - CertificationType enum
 * @property {string}      issuedAt     - ISO-8601
 * @property {string}      expiresAt    - ISO-8601
 * @property {string|null} issuedBy     - Issuing authority
 * @property {boolean}     isActive     - Not expired and not revoked
 * @property {boolean}     isRevoked
 */
function createCertification(input = {}) {
  if (!Object.values(CertificationType).includes(input.type)) {
    throw new ModelValidationError(
      `Certification.type must be one of [${Object.values(CertificationType).join(', ')}]`,
      'type', input.type
    );
  }
  const issued  = new Date(input.issuedAt);
  const expires = new Date(input.expiresAt);
  if (isNaN(issued.getTime()))  throw new ModelValidationError('Certification.issuedAt invalid', 'issuedAt',  input.issuedAt);
  if (isNaN(expires.getTime())) throw new ModelValidationError('Certification.expiresAt invalid', 'expiresAt', input.expiresAt);
  if (expires <= issued)        throw new ModelValidationError('expiresAt must be after issuedAt', 'expiresAt', input.expiresAt);

  const isRevoked = input.isRevoked ?? false;
  const isActive  = !isRevoked && Date.now() < expires.getTime();
  const daysUntilExpiry = Math.floor((expires.getTime() - Date.now()) / 86400_000);

  return Object.freeze({
    type:             input.type,
    issuedAt:         input.issuedAt,
    expiresAt:        input.expiresAt,
    issuedBy:         input.issuedBy ?? null,
    isRevoked,
    isActive,
    daysUntilExpiry:  isActive ? daysUntilExpiry : 0,
  });
}

// ══════════════════════════════════════════════════════════════════
//  MODEL 1: STAFF MEMBER
// ══════════════════════════════════════════════════════════════════

class StaffMember {
  /**
   * @param {object} input
   * @param {string} input.staffId        - IR employee number (required)
   * @param {string} input.name           - Full name (required)
   * @param {string} input.role           - StaffRole enum (required)
   * @param {string} input.divisionCode   - Home division (required)
   * @param {string} input.zoneCode       - Zonal railway (required)
   * @param {string} [input.mobile]       - 10-digit mobile
   * @param {string} [input.email]
   * @param {string} [input.sectionId]    - Assigned section/beat
   * @param {string} [input.gangId]       - Gang membership
   * @param {string} [input.availability] - AvailabilityStatus enum
   * @param {object[]} [input.certifications]
   * @param {string[]} [input.skills]
   * @param {number} [input.yearsExperience]
   */
  constructor(input = {}) {
    this.staffId      = input.staffId;
    this.name         = input.name;
    this.role         = input.role;
    this.divisionCode = input.divisionCode;
    this.zoneCode     = input.zoneCode;

    this.mobile              = input.mobile              ?? null;
    this.email               = input.email               ?? null;
    this.sectionId           = input.sectionId           ?? null;
    this.gangId              = input.gangId              ?? null;
    this.availability        = input.availability        ?? AvailabilityStatus.AVAILABLE;
    this.currentDeploymentId = input.currentDeploymentId ?? null;  // work order ID

    this.certifications  = Array.isArray(input.certifications)
      ? input.certifications.map(createCertification)
      : [];
    this.skills          = Array.isArray(input.skills) ? [...input.skills] : [];
    this.yearsExperience = input.yearsExperience ?? null;
    this.joinedAt        = input.joinedAt        ?? null;
    this.notes           = input.notes           ?? null;

    this._schemaVersion = '1.0';
    this._updatedAt     = new Date().toISOString();
  }

  validate() {
    requireString(this, 'staffId');
    requireString(this, 'name');
    requireEnum(this, 'role',         StaffRole);
    requireEnum(this, 'availability', AvailabilityStatus);
    requireString(this, 'divisionCode');
    requireString(this, 'zoneCode');
    optionalNumber(this, 'yearsExperience', 0, 50);
    optionalIsoDate(this, 'joinedAt');

    if (this.mobile && !/^\d{10}$/.test(this.mobile)) {
      throw new ModelValidationError('mobile must be exactly 10 digits', 'mobile', this.mobile);
    }
    if (this.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.email)) {
      throw new ModelValidationError('email is not valid', 'email', this.email);
    }
    if (this.availability === AvailabilityStatus.DEPLOYED && !this.currentDeploymentId) {
      throw new ModelValidationError(
        'DEPLOYED staff must have currentDeploymentId set',
        'currentDeploymentId', null
      );
    }
    return this;
  }

  // ── Computed ─────────────────────────────────────────────────
  get activeCertifications() {
    return this.certifications.filter(c => c.isActive);
  }

  /** Certifications expiring within `days` days */
  expiringCertifications(days = 30) {
    return this.certifications.filter(c => c.isActive && c.daysUntilExpiry <= days);
  }

  get canSuperviseOHE() {
    return this.activeCertifications.some(c => c.type === CertificationType.OHE_SUPERVISION);
  }

  get canOperateUSFD() {
    return this.activeCertifications.some(c => c.type === CertificationType.USFD_OPERATOR);
  }

  get hasMandatorySafetyCert() {
    return this.activeCertifications.some(c => c.type === CertificationType.SAFETY_COUNSELLING);
  }

  toJSON() {
    return {
      staffId: this.staffId, name: this.name, role: this.role,
      divisionCode: this.divisionCode, zoneCode: this.zoneCode,
      mobile: this.mobile, email: this.email,
      sectionId: this.sectionId, gangId: this.gangId,
      availability: this.availability, currentDeploymentId: this.currentDeploymentId,
      certifications: this.certifications, skills: this.skills,
      yearsExperience: this.yearsExperience, joinedAt: this.joinedAt, notes: this.notes,
      // Computed
      activeCertificationCount: this.activeCertifications.length,
      canSuperviseOHE:      this.canSuperviseOHE,
      canOperateUSFD:       this.canOperateUSFD,
      hasMandatorySafetyCert: this.hasMandatorySafetyCert,
      _schemaVersion: this._schemaVersion, _updatedAt: this._updatedAt,
    };
  }

  static fromJSON(obj)  { return new StaffMember(obj); }
  static create(input)  { return new StaffMember(input).validate(); }
}

// ══════════════════════════════════════════════════════════════════
//  MODEL 2: MAINTENANCE GANG
// ══════════════════════════════════════════════════════════════════

class MaintenanceGang {
  /**
   * @param {object} input
   * @param {string} input.gangName       - Official gang name/number (required)
   * @param {string} input.gangType       - GangType enum (required)
   * @param {string} input.divisionCode   (required)
   * @param {string} input.zoneCode       (required)
   * @param {string} input.sectionId      - Assigned beat (required)
   * @param {string} [input.keymanId]     - StaffMember ID of KeyMan
   * @param {string[]} [input.memberIds]
   * @param {number} [input.strength]     - Sanctioned strength
   * @param {string} [input.availability]
   * @param {number} [input.beatLengthKm]
   */
  constructor(input = {}) {
    this.gangId       = input.gangId   ?? crypto.randomUUID();
    this.gangName     = input.gangName;
    this.gangType     = input.gangType;
    this.divisionCode = input.divisionCode;
    this.zoneCode     = input.zoneCode;
    this.sectionId    = input.sectionId;

    this.keymanId           = input.keymanId          ?? null;
    this.memberIds          = Array.isArray(input.memberIds) ? [...input.memberIds] : [];
    this.strength           = input.strength          ?? null;
    this.availability       = input.availability      ?? AvailabilityStatus.AVAILABLE;
    this.currentWorkOrderId = input.currentWorkOrderId ?? null;
    this.beatLengthKm       = input.beatLengthKm       ?? null;
    this.basedAt            = input.basedAt            ?? null;
    this.notes              = input.notes              ?? null;

    this._schemaVersion = '1.0';
    this._updatedAt     = new Date().toISOString();
  }

  validate() {
    requireString(this, 'gangId');
    requireString(this, 'gangName');
    requireEnum(this, 'gangType',     GangType);
    requireEnum(this, 'availability', AvailabilityStatus);
    requireString(this, 'divisionCode');
    requireString(this, 'zoneCode');
    requireString(this, 'sectionId');
    optionalNumber(this, 'strength',    1, 100);
    optionalNumber(this, 'beatLengthKm', 0.1);

    if (this.strength != null && this.memberIds.length > this.strength) {
      throw new ModelValidationError(
        `memberIds count (${this.memberIds.length}) exceeds sanctioned strength (${this.strength})`,
        'memberIds', this.memberIds.length
      );
    }
    if (this.availability === AvailabilityStatus.DEPLOYED && !this.currentWorkOrderId) {
      throw new ModelValidationError('DEPLOYED gang must have currentWorkOrderId', 'currentWorkOrderId', null);
    }
    return this;
  }

  get currentStrength() { return this.memberIds.length; }
  get isUnderStrength() { return this.strength != null && this.memberIds.length < this.strength; }
  get vacancies()       { return this.strength != null ? Math.max(0, this.strength - this.memberIds.length) : null; }
  get isDeployed()      { return this.availability === AvailabilityStatus.DEPLOYED; }

  toJSON() {
    return {
      gangId: this.gangId, gangName: this.gangName, gangType: this.gangType,
      divisionCode: this.divisionCode, zoneCode: this.zoneCode, sectionId: this.sectionId,
      keymanId: this.keymanId, memberIds: this.memberIds,
      strength: this.strength, availability: this.availability,
      currentWorkOrderId: this.currentWorkOrderId,
      beatLengthKm: this.beatLengthKm, basedAt: this.basedAt, notes: this.notes,
      // Computed
      currentStrength: this.currentStrength,
      isUnderStrength: this.isUnderStrength,
      vacancies:       this.vacancies,
      isDeployed:      this.isDeployed,
      _schemaVersion: this._schemaVersion, _updatedAt: this._updatedAt,
    };
  }

  static fromJSON(obj)  { return new MaintenanceGang(obj); }
  static create(input)  { return new MaintenanceGang(input).validate(); }
}

// ══════════════════════════════════════════════════════════════════
//  MODEL 3: EQUIPMENT
// ══════════════════════════════════════════════════════════════════

class Equipment {
  /**
   * @param {object} input
   * @param {string} input.name            - e.g. 'RM-80 Tamping Machine' (required)
   * @param {string} input.equipmentType   - EquipmentType enum (required)
   * @param {string} input.divisionCode    (required)
   * @param {string} input.zoneCode        (required)
   * @param {string} [input.assetNo]       - IR fleet number
   * @param {string} [input.status]        - EquipmentStatus enum
   * @param {string} [input.basedAt]       - Home depot/station
   * @param {number} [input.hourlyRateINR] - Internal hire rate
   * @param {string} [input.nextServiceDue]- ISO-8601
   */
  constructor(input = {}) {
    this.equipmentId   = input.equipmentId ?? crypto.randomUUID();
    this.name          = input.name;
    this.equipmentType = input.equipmentType;
    this.divisionCode  = input.divisionCode;
    this.zoneCode      = input.zoneCode;

    this.assetNo           = input.assetNo           ?? null;
    this.manufacturerModel = input.manufacturerModel ?? null;
    this.yearOfMfg         = input.yearOfMfg         ?? null;
    this.status            = input.status            ?? EquipmentStatus.AVAILABLE;
    this.basedAt           = input.basedAt           ?? null;
    this.currentLocation   = input.currentLocation   ?? null;
    this.currentWorkOrderId= input.currentWorkOrderId ?? null;
    this.lastServicingKm   = input.lastServicingKm   ?? null;
    this.nextServiceDue    = input.nextServiceDue     ?? null;
    this.hourlyRateINR     = input.hourlyRateINR      ?? null;
    this.operatorId        = input.operatorId         ?? null;
    this.notes             = input.notes              ?? null;

    this._schemaVersion = '1.0';
    this._updatedAt     = new Date().toISOString();
  }

  validate() {
    requireString(this, 'equipmentId');
    requireString(this, 'name');
    requireEnum(this, 'equipmentType', EquipmentType);
    requireEnum(this, 'status',        EquipmentStatus);
    requireString(this, 'divisionCode');
    requireString(this, 'zoneCode');
    optionalNumber(this, 'yearOfMfg',       1950, new Date().getFullYear());
    optionalNumber(this, 'lastServicingKm', 0);
    optionalNumber(this, 'hourlyRateINR',   0);
    optionalIsoDate(this, 'nextServiceDue');

    if (this.status === EquipmentStatus.DEPLOYED && !this.currentWorkOrderId) {
      throw new ModelValidationError(
        'DEPLOYED equipment must have currentWorkOrderId',
        'currentWorkOrderId', null
      );
    }
    return this;
  }

  get isAvailable()      { return this.status === EquipmentStatus.AVAILABLE; }
  get isServiceOverdue() {
    if (!this.nextServiceDue) return false;
    return Date.now() > new Date(this.nextServiceDue).getTime();
  }
  get ageYears() {
    if (!this.yearOfMfg) return null;
    return new Date().getFullYear() - this.yearOfMfg;
  }

  toJSON() {
    return {
      equipmentId: this.equipmentId, name: this.name, equipmentType: this.equipmentType,
      divisionCode: this.divisionCode, zoneCode: this.zoneCode,
      assetNo: this.assetNo, manufacturerModel: this.manufacturerModel, yearOfMfg: this.yearOfMfg,
      status: this.status, basedAt: this.basedAt, currentLocation: this.currentLocation,
      currentWorkOrderId: this.currentWorkOrderId, lastServicingKm: this.lastServicingKm,
      nextServiceDue: this.nextServiceDue, hourlyRateINR: this.hourlyRateINR,
      operatorId: this.operatorId, notes: this.notes,
      // Computed
      isAvailable: this.isAvailable,
      isServiceOverdue: this.isServiceOverdue,
      ageYears: this.ageYears,
      _schemaVersion: this._schemaVersion, _updatedAt: this._updatedAt,
    };
  }

  static fromJSON(obj)  { return new Equipment(obj); }
  static create(input)  { return new Equipment(input).validate(); }
}

// ══════════════════════════════════════════════════════════════════
//  EXPORTS
// ══════════════════════════════════════════════════════════════════

module.exports = {
  StaffMember,
  MaintenanceGang,
  Equipment,
  StaffRole,
  CertificationType,
  AvailabilityStatus,
  GangType,
  EquipmentType,
  EquipmentStatus,
  createCertification,
};
