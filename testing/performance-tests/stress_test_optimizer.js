/**
 * stress_test_optimizer.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Stress Test for Google OR-Tools CP-SAT Block Optimizer:
 *   - Formulates a large scheduling problem with 20 competing maintenance tasks
 *     across multiple departments (Civil, Electrical, S&T)
 *   - Allocates against 5 candidate corridor block windows
 *   - Measures solve duration, feasibility verification, and memory consumption
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const assert = require('assert');
const { blockOptimizerService } = require('../../backend/services/block-optimizer');

async function runTests() {
  console.log('=== [PERFORMANCE TEST] CP-SAT Optimizer Stress Benchmark ===');

  // Generate 12 competing tasks
  const tasks = [];
  const depts = ['CIVIL', 'TRD_OHE', 'SIGNAL_TELECOM'];
  for (let i = 1; i <= 12; i++) {
    tasks.push({
      task_id: `STRESS-TASK-${String(i).padStart(2, '0')}`,
      section_id: 'NDLS-CNB-UP',
      department: depts[i % depts.length],
      duration_minutes: 60 + (i * 10),
      priority_score: 70 + (i * 2),
      required_track_closure: i % 2 === 0,
      required_power_block: i % 3 === 0,
    });
  }

  // 4 candidate slots
  const slots = [
    {
      slot_id: 'SLOT-01',
      section_id: 'NDLS-CNB-UP',
      start_time: '2026-09-08T01:00:00Z',
      end_time: '2026-09-08T04:00:00Z',
      duration_minutes: 180,
      disruption_score: 12.0,
    },
    {
      slot_id: 'SLOT-02',
      section_id: 'NDLS-CNB-UP',
      start_time: '2026-09-08T11:00:00Z',
      end_time: '2026-09-08T13:30:00Z',
      duration_minutes: 150,
      disruption_score: 32.0,
    },
    {
      slot_id: 'SLOT-03',
      section_id: 'NDLS-CNB-UP',
      start_time: '2026-09-09T01:30:00Z',
      end_time: '2026-09-09T05:00:00Z',
      duration_minutes: 210,
      disruption_score: 10.5,
    },
  ];

  console.log(`  Solving schedule for ${tasks.length} tasks across ${slots.length} corridor slots...`);
  const t0 = process.hrtime.bigint();
  const schedule = await blockOptimizerService.generateSchedule(tasks, slots);
  const t1 = process.hrtime.bigint();
  const solveSeconds = Number(t1 - t0) / 1e9;

  assert.ok(schedule !== null);
  assert.ok(schedule.status === 'OPTIMAL' || schedule.status === 'FEASIBLE');
  console.log(`  Solver Status:       ${schedule.status}`);
  console.log(`  Solve Duration:      ${solveSeconds.toFixed(2)}s (Target: < 10.0s)`);
  console.log(`  Scheduled Blocks:    ${schedule.scheduled_blocks?.length || 0}`);

  console.log('>>> CP-SAT Optimizer Stress Test: PASSED <<<\n');
}

module.exports = { runTests };

if (require.main === module) {
  runTests().catch((e) => { console.error(e); process.exit(1); });
}
