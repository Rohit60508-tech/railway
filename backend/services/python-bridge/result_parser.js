/**
 * result_parser.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Normalizes and converts Python AI microservice results into standard
 * JavaScript domain structures for backend business logic and API responses.
 * ─────────────────────────────────────────────────────────────────────────────
 */

class ResultParser {
  /**
   * Normalizes defect priority output.
   */
  static parsePriorityResult(raw) {
    if (!raw) return null;
    const data = raw.data || raw;

    const score = typeof data.priority_score === 'number' ? data.priority_score : parseFloat(data.priority_score || 0);
    const category = data.priority_category || 'P4';
    const explanation = data.explanation || {};

    return {
      defectId: data.defect_id || data.defectId,
      sectionId: data.section_id || data.sectionId,
      priorityScore: Math.round(score * 10) / 10,
      priorityCategory: category,
      priorityName: data.priority_name || ResultParser._getCategoryLabel(category),
      slaHours: data.sla_hours || explanation.sla_hours || ResultParser._getDefaultSlaHours(category),
      explanation: {
        summary: explanation.summary || `${category} Priority (Score: ${score}/100)`,
        highlights: explanation.highlights || [],
        topDrivers: explanation.top_drivers || [],
        featureBreakdown: explanation.feature_breakdown || [],
      },
      features: data.features || {},
      evaluatedAt: data.evaluated_at || new Date().toISOString(),
    };
  }

  /**
   * Normalizes batch priority ranking output.
   */
  static parseBatchPriorityResult(raw) {
    if (!raw) return { total: 0, items: [] };
    const data = raw.data || raw;

    const list = data.ranked_defects || data.items || (Array.isArray(data) ? data : []);
    const items = list.map((item) => ResultParser.parsePriorityResult(item));

    return {
      totalDefects: items.length,
      p1Count: items.filter((d) => d.priorityCategory === 'P1').length,
      p2Count: items.filter((d) => d.priorityCategory === 'P2').length,
      p3Count: items.filter((d) => d.priorityCategory === 'P3').length,
      p4Count: items.filter((d) => d.priorityCategory === 'P4').length,
      rankedDefects: items,
      evaluatedAt: data.timestamp || new Date().toISOString(),
    };
  }

  /**
   * Normalizes section occupancy calculations.
   */
  static parseOccupancyResult(raw) {
    if (!raw) return null;
    const data = raw.occupancy_data || raw.data || raw;

    return {
      sectionId: raw.section_id || data.section_id,
      startTime: data.start_time,
      endTime: data.end_time,
      windowDurationMinutes: data.window_duration_minutes || 0,
      occupancyPercentage: data.occupancy_percentage || 0,
      trainsCount: data.trains_count || (data.trains ? data.trains.length : 0),
      passengerTrainsCount: data.passenger_trains_count || 0,
      freightTrainsCount: data.freight_trains_count || 0,
      trains: data.trains || [],
      calculatedAt: raw.timestamp || new Date().toISOString(),
    };
  }

  /**
   * Normalizes candidate corridor slots.
   */
  static parseSlotsResult(raw) {
    if (!raw) return [];
    const list = raw.best_slots || raw.slots || raw.data || (Array.isArray(raw) ? raw : []);

    return list.map((s, idx) => ({
      slotId: s.slot_id || `SLOT-${idx + 1}`,
      slotStart: s.slot_start,
      slotEnd: s.slot_end,
      durationMinutes: s.duration_minutes || 120,
      disruptionScore: s.disruption_score !== undefined ? s.disruption_score : (s.traffic_impact_score || 0),
      feasibility: s.feasibility || 'MODERATE_FEASIBILITY',
      feasibilityLabel: s.feasibility_label || 'Viable Maintenance Slot',
      timeWindowType: s.time_window_type || 'DAY_STANDARD',
      conflictsCount: s.conflicts_count || (s.conflicts ? s.conflicts.length : 0),
      conflicts: s.conflicts || [],
    }));
  }

  /**
   * Normalizes multi-department bundling output.
   */
  static parseBundleResult(raw) {
    if (!raw) return [];
    const list = raw.bundles || raw.data || (Array.isArray(raw) ? raw : []);

    return list.map((b) => ({
      bundleId: b.bundle_id,
      sectionId: b.section_id,
      tasksCount: b.tasks ? b.tasks.length : (b.tasks_count || 0),
      tasks: b.tasks || [],
      departments: b.departments || [],
      bundlingScore: b.bundling_score || 75.0,
      benefits: {
        timeSavedMinutes: b.benefits?.time_saved_minutes || 0,
        timeSavedHours: b.benefits?.time_saved_hours || 0,
        narrative: b.benefits?.benefits_list || [],
      },
    }));
  }

  /**
   * Normalizes complete schedule optimization output.
   */
  static parseOptimizationResult(raw) {
    if (!raw) return null;
    const res = raw.optimization_result || raw.data || raw;

    const rawBlocks = res.blocks || res.scheduled_blocks || [];
    const blocks = rawBlocks.map((blk) => ({
      blockId: blk.block_id || blk.schedule_id,
      sectionId: blk.section_id,
      slotId: blk.slot_id,
      startTime: blk.start_time || blk.slot_start,
      endTime: blk.end_time || blk.slot_end,
      durationMinutes: blk.duration_minutes,
      disruptionScore: blk.disruption_score || 0,
      tasks: blk.tasks || blk.tasks_assigned || [],
      departments: blk.departments || [],
      timeSavedMinutes: blk.possession_minutes_saved || blk.benefits?.time_saved_minutes || 0,
    }));

    return {
      status: res.status || 'SUCCESS',
      totalBlocksScheduled: blocks.length,
      tasksScheduled: res.tasks_scheduled || 0,
      tasksUnassigned: res.tasks_unassigned || (res.unassigned_tasks ? res.unassigned_tasks.length : 0),
      totalPossessionHoursSaved: res.total_possession_hours_saved || 0,
      blocks,
      unassignedTasks: res.unassigned_tasks || [],
      generatedAt: res.generated_at || new Date().toISOString(),
    };
  }

  // Helpers
  static _getCategoryLabel(category) {
    switch (category) {
      case 'P1': return 'Critical / Immediate Intervention';
      case 'P2': return 'High Priority / Planned Window';
      case 'P3': return 'Medium Priority / Rolling Corridor';
      case 'P4': default: return 'Low / Routine Inspection';
    }
  }

  static _getDefaultSlaHours(category) {
    switch (category) {
      case 'P1': return 24;
      case 'P2': return 72;
      case 'P3': return 168;
      case 'P4': default: return 720;
    }
  }
}

module.exports = ResultParser;
