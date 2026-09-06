/**
 * test_pipeline_e2e.test.js
 * ─────────────────────────────────────────────────────────────────────────────
 * End-to-End Pipeline Integration Test:
 *   1. Raw inspection flaw arrives from field car (DefectValidator)
 *   2. Scored & categorized by Priority Engine (P1 Critical)
 *   3. Traffic corridor analysis discovers lowest-disruption slot
 *   4. OR-Tools CP-SAT bundles flaw repair with pending OHE maintenance
 *   5. AlertService dispatches incident notification to Control Office & SOC
 *   6. MetricsDashboard updates composite rail health index
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const assert = require('assert');
const { defectValidator } = require('../../backend/services/defect-validator');
const { trafficAnalyzerService } = require('../../backend/services/traffic-analyzer');
const { blockOptimizerService } = require('../../backend/services/block-optimizer');
const { alertService, AlertSeverity, AlertDomain } = require('../../backend/services/alert-service');
const { metricsDashboard } = require('../../backend/services/metrics-dashboard');

async function runTests() {
  console.log('=== [INTEGRATION TEST] End-to-End Operational Pipeline ===');

  // Step 1: Flaw Ingestion & Validation
  console.log('Step 1: Ingesting emergency USFD flaw detection...');
  const flaw = {
    defect_id: 'DEF-E2E-999',
    section_id: 'NDLS-CNB-UP',
    department: 'CIVIL',
    asset_type: 'RAIL_THERMIT_WELD',
    severity: 'CRITICAL',
    source: 'USFD',
    track_quality_index: 34.0,
    trains_per_day: 135,
    speed_limit_kmh: 110,
    overdue_days: 3.0,
  };
  const valResult = await defectValidator.validateAndPrioritize(flaw);
  assert.strictEqual(valResult.isValid, true);
  assert.ok(['P1', 'P2'].includes(valResult.defect.priority_category), 'Must be high risk P1 or P2');
  console.log('  [OK] Flaw classified as High Priority (Score:', valResult.defect.priority_score, ', Category:', valResult.defect.priority_category, ')');

  // Step 2: Discover Candidate Slots
  console.log('Step 2: Querying Traffic Analyzer for maintenance slots...');
  const bestSlots = await trafficAnalyzerService.predictBestSlots('NDLS-CNB-UP', 150, 3);
  assert.ok(Array.isArray(bestSlots));
  console.log(`  [OK] Found ${bestSlots.length} feasible candidate block slot(s)`);

  // Step 3: Bundle and Solve Schedule
  console.log('Step 3: Evaluating multi-department bundling and solving CP-SAT schedule...');
  const tasks = [
    {
      task_id: 'TASK-P1-WELD-999',
      section_id: 'NDLS-CNB-UP',
      department: 'CIVIL',
      duration_minutes: 120,
      priority_score: 95.0,
      required_track_closure: true,
    },
    {
      task_id: 'TASK-OHE-INSPECT-999',
      section_id: 'NDLS-CNB-UP',
      department: 'TRD_OHE',
      duration_minutes: 90,
      priority_score: 82.0,
      required_power_block: true,
    },
  ];

  const bundles = await blockOptimizerService.bundleTasks(tasks);
  assert.ok(bundles.length >= 1);
  console.log(`  [OK] Bundling Engine created ${bundles.length} bundle with joint time savings`);

  const slots = [
    {
      slot_id: 'SLOT-E2E-01',
      section_id: 'NDLS-CNB-UP',
      start_time: '2026-09-08T01:00:00Z',
      end_time: '2026-09-08T04:00:00Z',
      duration_minutes: 180,
      disruption_score: 12.0,
    },
  ];

  const schedule = await blockOptimizerService.generateSchedule(tasks, slots);
  assert.ok(schedule.status === 'OPTIMAL' || schedule.status === 'FEASIBLE');
  console.log(`  [OK] CP-SAT Solver confirmed schedule with status: ${schedule.status}`);

  // Step 4: Dispatch Safety Alert
  console.log('Step 4: Dispatching safety alert to Control Office and SOC...');
  const alert = alertService.raiseAlert({
    title: 'P1 Critical Rail Flaw Block Scheduled',
    message: 'Joint Civil/OHE block assigned on NDLS-CNB-UP for 01:00-04:00',
    severity: AlertSeverity.HIGH,
    domain: AlertDomain.SAFETY,
    sectionId: 'NDLS-CNB-UP',
  });
  assert.ok(alert.alertId);
  console.log(`  [OK] Alert ${alert.alertId} dispatched`);

  // Step 5: Verify Dashboard Health Telemetry
  console.log('Step 5: Inspecting Metrics Dashboard snapshot...');
  const snapshot = metricsDashboard.getDashboardSnapshot();
  assert.ok(snapshot.composite_indices.rail_health_index >= 0);
  console.log('  [OK] Dashboard Rail Health Index calculated:', snapshot.composite_indices.rail_health_index);

  console.log('>>> End-to-End Pipeline: ALL TESTS PASSED <<<\n');
}

module.exports = { runTests };

if (require.main === module) {
  runTests().catch((e) => { console.error(e); process.exit(1); });
}
