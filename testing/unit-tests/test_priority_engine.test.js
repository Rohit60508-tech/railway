/**
 * test_priority_engine.test.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Unit Tests for PriorityEngine Service:
 *   - Tests scoring single defect with 10 risk vectors
 *   - Tests sorting and categorization of batch defects
 *   - Tests metadata and model info retrieval
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const assert = require('assert');
const { priorityEngine } = require('../../backend/services/priority-engine');
const syntheticDefects = require('../test-data/synthetic_defects.json');

async function runTests() {
  console.log('=== [UNIT TEST] PriorityEngine ===');

  // Test 1: Single Scoring
  console.log('Test 1: Scoring individual defect...');
  const res1 = await priorityEngine.scoreDefect(syntheticDefects[0]);
  assert.ok(res1 !== null, 'Result should not be null');
  assert.ok(res1.priorityScore !== undefined || res1.priority_score !== undefined, 'Has priority score');
  console.log('  [PASS] Single defect scored successfully');

  // Test 2: Batch Ranking
  console.log('Test 2: Ranking a batch of 5 defects in descending order...');
  const res2 = await priorityEngine.rankBatch(syntheticDefects, true);
  const items = res2.rankedDefects || res2.ranked_defects || res2;
  assert.ok(Array.isArray(items), 'Items must be an array');
  assert.strictEqual(items.length, 5, 'Must return all 5 scored items');
  
  // Verify descending order
  for (let i = 0; i < items.length - 1; i++) {
    const scoreA = items[i].priorityScore || items[i].priority_score || 0;
    const scoreB = items[i+1].priorityScore || items[i+1].priority_score || 0;
    assert.ok(scoreA >= scoreB, `Items must be sorted descending: ${scoreA} >= ${scoreB}`);
  }
  console.log('  [PASS] Verified batch descending priority ranking');

  // Test 3: Model Metadata
  console.log('Test 3: Fetching model metadata and hyperparameters...');
  const meta = await priorityEngine.getModelMetadata();
  assert.ok(meta !== null, 'Metadata must exist');
  console.log('  [PASS] Model metadata retrieved');

  console.log('>>> PriorityEngine: ALL UNIT TESTS PASSED <<<\n');
}

module.exports = { runTests };

if (require.main === module) {
  runTests().catch((e) => { console.error(e); process.exit(1); });
}
