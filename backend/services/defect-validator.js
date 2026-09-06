/**
 * defect-validator.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Validates track defect events from disparate railway ingestion sources
 * (USFD, TRC, OMS, ITMS, Patrol, TMS) and delegates priority scoring to
 * Python AI microservice (DefectPrioritizer).
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { aiServiceConnector } = require('./ai-service-connector');

class DefectValidator {
  constructor(connector = aiServiceConnector) {
    this.connector = connector;
  }

  /**
   * Validates structure, data types, and required fields of a raw defect event.
   */
  validate(rawDefect) {
    const errors = [];

    if (!rawDefect || typeof rawDefect !== 'object') {
      return { isValid: false, errors: ['Defect record must be a valid object.'] };
    }

    if (!rawDefect.defect_id && !rawDefect.defectId && !rawDefect.id) {
      errors.push('Missing unique defect identifier (defect_id).');
    }

    if (!rawDefect.section_id && !rawDefect.sectionId) {
      errors.push('Missing railway section identifier (section_id).');
    }

    if (!rawDefect.department) {
      errors.push('Missing department identifier (department).');
    }

    const validSeverities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
    const severity = (rawDefect.severity || '').toUpperCase();
    if (severity && !validSeverities.includes(severity)) {
      errors.push(`Invalid severity '${severity}'. Expected one of: ${validSeverities.join(', ')}.`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Normalizes defect payload fields into standard AI engine format.
   */
  normalizeForAI(defect) {
    return {
      defect_id: defect.defect_id || defect.defectId || defect.id,
      section_id: defect.section_id || defect.sectionId,
      department: defect.department,
      asset_type: defect.asset_type || defect.assetType || 'TRACK_GENERAL',
      severity: (defect.severity || 'MEDIUM').toUpperCase(),
      source: (defect.source || defect.detection_method || 'MANUAL').toUpperCase(),
      sla_deadline: defect.sla_deadline || defect.slaDeadline || null,
      detected_at: defect.detected_at || defect.detectedAt || new Date().toISOString(),
      track_quality_index: defect.track_quality_index || defect.tqi || null,
      trains_per_day: defect.trains_per_day || defect.traffic_density || null,
      track_count: defect.track_count || 2,
      overdue_days: defect.overdue_days || 0.0,
      location_criticality: defect.location_criticality || 50.0,
      speed_restriction_kmh: defect.speed_restriction_kmh || null,
      failure_probability: defect.failure_probability || null,
    };
  }

  /**
   * Validates the defect and enriches it with Python AI priority scoring.
   */
  async validateAndPrioritize(rawDefect) {
    const validation = this.validate(rawDefect);
    if (!validation.isValid) {
      return {
        isValid: false,
        errors: validation.errors,
        defect: rawDefect,
        priority: null,
      };
    }

    const aiPayload = this.normalizeForAI(rawDefect);

    try {
      const priorityResult = await this.connector.prioritizeDefect(aiPayload);

      return {
        isValid: true,
        errors: [],
        defect: {
          ...rawDefect,
          priority_score: priorityResult.priorityScore,
          priority_category: priorityResult.priorityCategory,
          priority_name: priorityResult.priorityName,
          sla_hours: priorityResult.slaHours,
        },
        priority: priorityResult,
      };
    } catch (err) {
      console.error(`[DefectValidator] Error scoring defect ${aiPayload.defect_id}: ${err.message}`);
      // Return validated defect with degraded priority fallback
      return {
        isValid: true,
        errors: [`AI priority scoring warning: ${err.message}`],
        defect: {
          ...rawDefect,
          priority_score: 50.0,
          priority_category: 'P3',
          priority_name: 'Medium Priority / Fallback',
        },
        priority: null,
      };
    }
  }

  /**
   * Validates and batch-prioritizes multiple defects.
   */
  async validateAndPrioritizeBatch(defectsList) {
    const validDefects = [];
    const rejectedDefects = [];

    for (const d of defectsList) {
      const v = this.validate(d);
      if (v.isValid) {
        validDefects.push(this.normalizeForAI(d));
      } else {
        rejectedDefects.push({ defect: d, errors: v.errors });
      }
    }

    let batchResult = { totalDefects: 0, rankedDefects: [] };
    if (validDefects.length > 0) {
      batchResult = await this.connector.prioritizeBatch(validDefects, true);
    }

    return {
      totalSubmitted: defectsList.length,
      validCount: validDefects.length,
      rejectedCount: rejectedDefects.length,
      rejectedDefects,
      rankedDefects: batchResult.rankedDefects,
      summary: {
        p1: batchResult.p1Count || 0,
        p2: batchResult.p2Count || 0,
        p3: batchResult.p3Count || 0,
        p4: batchResult.p4Count || 0,
      },
    };
  }
}

const defectValidator = new DefectValidator();

module.exports = {
  DefectValidator,
  defectValidator,
};
