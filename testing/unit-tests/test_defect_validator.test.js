/**
 * test_defect_validator.test.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Unit Tests for DefectValidator Service:
 *   - Tests defect payload schema validation
 *   - Tests boundary validation for TQI, speed limits, overdue days
 *   - Tests defect enrichment & priority classification
 *   - Tests invalid defect error handling
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const assert = require('assert');
const { defectValidator } = require('../../backend/services/defect-validator');
const syntheticDefects = require('../test-data/synthetic_defects.json');

async function runTests() {
  console.log('=== [UNIT TEST] DefectValidator ===');

  // Test 1: Valid Critical Defect
  console.log('Test 1: Valid critical USFD defect validation & scoring...');
  const res1 = await defectValidator.validateAndPrioritize(syntheticDefects[0]);
  assert.strictEqual(res1.isValid, true, 'Defect must be valid');
  assert.ok(res1.defect.priority_score >= 80, 'Critical defect score must be >= 80');
  assert.ok(['P1', 'P2'].includes(res1.defect.priority_category), 'Category must be high priority P1 or P2');
  console.log('  [PASS] Correctly scored high priority defect (Score:', res1.defect.priority_score, ', Category:', res1.defect.priority_category, ')');

  // Test 2: Valid High Defect
  console.log('Test 2: Valid high severity defect validation...');
  const res2 = await defectValidator.validateAndPrioritize(syntheticDefects[1]);
  assert.strictEqual(res2.isValid, true);
  assert.ok(res2.defect.priority_score >= 60, 'Score must be >= 60');
  console.log('  [PASS] Correctly scored High defect (Score:', res2.defect.priority_score, ')');

  // Test 3: Invalid Payload (Missing section_id)
  console.log('Test 3: Rejecting defect with missing section_id...');
  const invalidDefect = { defect_id: 'DEF-ERR', severity: 'HIGH' };
  const res3 = await defectValidator.validateAndPrioritize(invalidDefect);
  assert.strictEqual(res3.isValid, false, 'Should be invalid');
  assert.ok(res3.errors.length > 0, 'Should contain error messages');
  console.log('  [PASS] Rejected missing required fields with errors:', res3.errors);

  // Test 4: Extreme Boundary TQI value validation
  console.log('Test 4: Handling extreme track quality index values...');
  const boundaryDefect = {
    defect_id: 'DEF-BOUND',
    section_id: 'NDLS-CNB-UP',
    department: 'CIVIL',
    severity: 'LOW',
    track_quality_index: 99.9,
    speed_limit_kmh: 160,
  };
  const res4 = await defectValidator.validateAndPrioritize(boundaryDefect);
  assert.strictEqual(res4.isValid, true);
  console.log('  [PASS] Accepted valid extreme TQI boundary');

  console.log('>>> DefectValidator: ALL UNIT TESTS PASSED <<<\n');
}

module.exports = { runTests };

if (require.main === module) {
  runTests().catch((e) => { console.error(e); process.exit(1); });
}
