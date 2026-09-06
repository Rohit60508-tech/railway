/**
 * test_block_optimizer.test.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Unit Tests for BlockOptimizerService:
 *   - Cross-department task bundling logic
 *   - Google OR-Tools CP-SAT schedule formulation & solving
 *   - Departmental compatibility checking
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const assert = require('assert');
const { blockOptimizerService } = require('../../backend/services/block-optimizer');
const maintenanceTasks = require('../test-data/maintenance_tasks.json');

async function runTests() {
  console.log('=== [UNIT TEST] BlockOptimizerService ===');

  // Test 1: Department Compatibility
  console.log('Test 1: Checking Civil and TRD_OHE compatibility...');
  const comp = await blockOptimizerService.checkDepartmentCompatibility('CIVIL', 'TRD_OHE');
  assert.ok(comp !== null, 'Compatibility result should exist');
  console.log('  [PASS] Department compatibility checked');

  // Test 2: Task Bundling
  console.log('Test 2: Evaluating cross-department task bundling...');
  const bundles = await blockOptimizerService.bundleTasks(maintenanceTasks);
  assert.ok(Array.isArray(bundles), 'Bundles must be an array');
  assert.ok(bundles.length >= 1, 'Should find at least 1 bundle opportunity');
  console.log(`  [PASS] Successfully formed ${bundles.length} bundle(s)`);

  // Test 3: Schedule Generation (OR-Tools CP-SAT)
  console.log('Test 3: Formulating and solving schedule with candidate slots...');
  const candidateSlots = [
    {
      slot_id: 'SLOT-OPT-01',
      section_id: 'NDLS-CNB-UP',
      start_time: '2026-09-08T01:00:00Z',
      end_time: '2026-09-08T04:30:00Z',
      duration_minutes: 210,
      disruption_score: 12.5,
    },
  ];

  const schedule = await blockOptimizerService.generateSchedule(maintenanceTasks, candidateSlots);
  assert.ok(schedule !== null, 'Schedule result must exist');
  assert.ok(schedule.status === 'OPTIMAL' || schedule.status === 'FEASIBLE', 'Must return feasible or optimal status');
  console.log(`  [PASS] Solver completed with status: ${schedule.status}`);

  console.log('>>> BlockOptimizerService: ALL UNIT TESTS PASSED <<<\n');
}

module.exports = { runTests };

if (require.main === module) {
  runTests().catch((e) => { console.error(e); process.exit(1); });
}
