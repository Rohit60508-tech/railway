/**
 * test_traffic_analyzer.test.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Unit Tests for TrafficAnalyzerService:
 *   - Section occupancy calculation
 *   - Available corridor maintenance slot discovery
 *   - Best maintenance slot prediction & disruption scoring
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const assert = require('assert');
const { trafficAnalyzerService } = require('../../backend/services/traffic-analyzer');

async function runTests() {
  console.log('=== [UNIT TEST] TrafficAnalyzerService ===');

  // Test 1: Section Occupancy
  console.log('Test 1: Section occupancy calculation for NDLS-CNB-UP...');
  const occ = await trafficAnalyzerService.getSectionOccupancy('NDLS-CNB-UP');
  assert.ok(occ !== null, 'Occupancy should return data');
  console.log('  [PASS] Section occupancy calculated successfully');

  // Test 2: Corridor Slot Discovery
  console.log('Test 2: Corridor slot discovery (120 min duration)...');
  const slots = await trafficAnalyzerService.findAvailableCorridorSlots('NDLS-CNB-UP', 120);
  assert.ok(Array.isArray(slots), 'Slots must be an array');
  console.log(`  [PASS] Discovered ${slots.length} available slots`);

  // Test 3: Best Recommended Slots
  console.log('Test 3: Best slot prediction ranking (top 5)...');
  const bestSlots = await trafficAnalyzerService.predictBestSlots('NDLS-CNB-UP', 120, 5);
  assert.ok(Array.isArray(bestSlots), 'Best slots must be an array');
  assert.ok(bestSlots.length <= 5, 'Must respect top_k limit');
  if (bestSlots.length > 0) {
    assert.ok(bestSlots[0].disruptionScore !== undefined || bestSlots[0].disruption_score !== undefined, 'Has disruption score');
  }
  console.log(`  [PASS] Returned ${bestSlots.length} top recommended slots`);

  console.log('>>> TrafficAnalyzerService: ALL UNIT TESTS PASSED <<<\n');
}

module.exports = { runTests };

if (require.main === module) {
  runTests().catch((e) => { console.error(e); process.exit(1); });
}
