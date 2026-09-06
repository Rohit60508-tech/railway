/**
 * test_ai_api.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Verification suite for /backend/api/ai-api.js
 * Tests:
 *   - Authentication (401 Unauthorized for missing/invalid keys, 200 for valid)
 *   - Rate Limiting (Headers verified, 429 triggered on excess)
 *   - Request Validation (400 Bad Request on invalid payloads)
 *   - All 9 required AI endpoints working end-to-end
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const http = require('http');
const { createAiServer, rateLimitStore, RATE_LIMIT_CONFIG } = require('./backend/api/ai-api');

const TEST_PORT = 8099;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const VALID_KEY = 'ir-ai-key-2026';

function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, headers: res.headers, body: json });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=================================================================');
  console.log('AI API VERIFICATION TEST SUITE (backend/api/ai-api.js)');
  console.log('=================================================================');

  const server = await createAiServer(TEST_PORT);
  console.log(`[INIT] Standalone AI API server listening on port ${TEST_PORT}`);

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      process.exitCode = 1;
    }
  }

  try {
    // ─────────────────────────────────────────────────────────────────────────
    // 1. Authentication Tests
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- 1. Authentication Tests ---');

    // 1.1 Missing credentials -> 401
    const resNoAuth = await request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/v1/ai/models/info',
      method: 'GET',
    });
    assert(resNoAuth.status === 401, 'Rejects request without credentials (401)');
    assert(resNoAuth.body.error?.code === 'UNAUTHORIZED', 'Returns UNAUTHORIZED error code');

    // 1.2 Invalid API Key -> 401
    const resBadKey = await request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/v1/ai/models/info',
      method: 'GET',
      headers: { 'x-api-key': 'invalid-secret' },
    });
    assert(resBadKey.status === 401, 'Rejects invalid API key (401)');

    // 1.3 Valid API Key in Header -> 200
    const resGoodKey = await request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/v1/ai/models/info',
      method: 'GET',
      headers: { 'x-api-key': VALID_KEY },
    });
    assert(resGoodKey.status === 200, 'Accepts valid X-API-Key (200)');

    // 1.4 Valid Bearer Token in Authorization -> 200
    const resBearer = await request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/v1/ai/models/info',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${VALID_KEY}` },
    });
    assert(resBearer.status === 200, 'Accepts valid Authorization: Bearer token (200)');

    // ─────────────────────────────────────────────────────────────────────────
    // 2. Rate Limiting Tests
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- 2. Rate Limiting & Headers Tests ---');
    assert(resGoodKey.headers['x-ratelimit-limit'] !== undefined, 'Includes X-RateLimit-Limit header');
    assert(resGoodKey.headers['x-ratelimit-remaining'] !== undefined, 'Includes X-RateLimit-Remaining header');
    assert(resGoodKey.headers['x-ratelimit-reset'] !== undefined, 'Includes X-RateLimit-Reset header');

    // Simulate rate limit exceeded
    const testClientKey = 'test-spam-key';
    rateLimitStore.set(testClientKey, { count: 999, resetTime: Date.now() + 60000 });
    const resRateLimited = await request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/v1/ai/models/info',
      method: 'GET',
      headers: { 'x-api-key': testClientKey },
    });
    assert(resRateLimited.status === 429, 'Returns 429 Too Many Requests when rate limit exceeded');
    assert(resRateLimited.body.error?.code === 'RATE_LIMIT_EXCEEDED', 'Returns RATE_LIMIT_EXCEEDED code');
    rateLimitStore.delete(testClientKey);

    // ─────────────────────────────────────────────────────────────────────────
    // 3. Request Validation Tests
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- 3. Request Validation Tests ---');

    // 3.1 Defect validation error
    const resValDefect = await request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/v1/ai/prioritize/defect',
      method: 'POST',
      headers: { 'x-api-key': VALID_KEY, 'Content-Type': 'application/json' },
    }, { severity: 'CRITICAL' }); // Missing defect_id and section_id
    assert(resValDefect.status === 400, 'Rejects defect payload with missing required fields (400)');
    assert(resValDefect.body.error?.code === 'VALIDATION_ERROR', 'Returns VALIDATION_ERROR code');

    // 3.2 Batch validation error
    const resValBatch = await request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/v1/ai/prioritize/batch',
      method: 'POST',
      headers: { 'x-api-key': VALID_KEY, 'Content-Type': 'application/json' },
    }, { defects: [] }); // Empty defects array
    assert(resValBatch.status === 400, 'Rejects empty batch array (400)');

    // 3.3 Best-slots invalid duration
    const resValDuration = await request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/v1/ai/traffic/best-slots/NDLS-CNB/5', // duration 5 < 15
      method: 'GET',
      headers: { 'x-api-key': VALID_KEY },
    });
    assert(resValDuration.status === 400, 'Rejects duration < 15 minutes for best-slots (400)');

    // ─────────────────────────────────────────────────────────────────────────
    // 4. End-to-End AI Endpoints Tests (All 9 Endpoints)
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n--- 4. End-to-End AI Endpoints Execution ---');

    // [1] POST /api/v1/ai/prioritize/defect
    console.log('\nTesting 1/9: POST /api/v1/ai/prioritize/defect...');
    const singleDefectPayload = {
      defect_id: 'DEF-API-001',
      section_id: 'NDLS-CNB-UP',
      department: 'CIVIL',
      asset_type: 'RAIL_THERMIT_WELD',
      severity: 'CRITICAL',
      source: 'USFD',
      track_quality_index: 38.0,
      trains_per_day: 120.0,
      track_count: 2,
      overdue_days: 1.5,
    };
    const resDefect = await request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/v1/ai/prioritize/defect',
      method: 'POST',
      headers: { 'x-api-key': VALID_KEY, 'Content-Type': 'application/json' },
    }, singleDefectPayload);
    assert(resDefect.status === 200, 'POST /api/v1/ai/prioritize/defect returns 200');
    assert(resDefect.body.success === true, 'Response body success is true');
    assert(resDefect.body.data.defect?.priority_score !== undefined, 'Returns priority_score');
    assert(['P1', 'P2', 'P3', 'P4'].includes(resDefect.body.data.defect?.priority_category), 'Returns valid priority_category');

    // [2] POST /api/v1/ai/prioritize/batch
    console.log('\nTesting 2/9: POST /api/v1/ai/prioritize/batch...');
    const batchPayload = {
      defects: [
        singleDefectPayload,
        {
          defect_id: 'DEF-API-002',
          section_id: 'NDLS-CNB-UP',
          department: 'TRD_OHE',
          asset_type: 'OHE_CANTILEVER',
          severity: 'HIGH',
          source: 'ITMS',
        },
      ],
      sort_by_priority: true,
    };
    const resBatch = await request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/v1/ai/prioritize/batch',
      method: 'POST',
      headers: { 'x-api-key': VALID_KEY, 'Content-Type': 'application/json' },
    }, batchPayload);
    assert(resBatch.status === 200, 'POST /api/v1/ai/prioritize/batch returns 200');
    assert(Array.isArray(resBatch.body.data?.ranked_defects || resBatch.body.data), 'Returns ranked defects list');

    // [3] GET /api/v1/ai/traffic/slots/:sectionId
    console.log('\nTesting 3/9: GET /api/v1/ai/traffic/slots/:sectionId...');
    const resSlots = await request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/v1/ai/traffic/slots/NDLS-CNB-UP?duration=120',
      method: 'GET',
      headers: { 'x-api-key': VALID_KEY },
    });
    assert(resSlots.status === 200, 'GET /api/v1/ai/traffic/slots/:sectionId returns 200');
    assert(resSlots.body.data.section_id === 'NDLS-CNB-UP', 'Returns correct section_id');
    assert(Array.isArray(resSlots.body.data.slots), 'Returns slots array');

    // [4] GET /api/v1/ai/traffic/best-slots/:sectionId/:duration
    console.log('\nTesting 4/9: GET /api/v1/ai/traffic/best-slots/:sectionId/:duration...');
    const resBestSlots = await request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/v1/ai/traffic/best-slots/NDLS-CNB-UP/120?top_k=5',
      method: 'GET',
      headers: { 'x-api-key': VALID_KEY },
    });
    assert(resBestSlots.status === 200, 'GET /api/v1/ai/traffic/best-slots/:sectionId/:duration returns 200');
    assert(resBestSlots.body.data.duration_minutes === 120, 'Matches requested duration_minutes');
    assert(Array.isArray(resBestSlots.body.data.best_slots), 'Returns best_slots array');

    // [5] POST /api/v1/ai/optimize/schedule
    console.log('\nTesting 5/9: POST /api/v1/ai/optimize/schedule...');
    const schedulePayload = {
      tasks: [
        {
          task_id: 'TASK-01',
          department: 'CIVIL',
          section_id: 'NDLS-CNB-UP',
          duration_minutes: 120,
          priority_score: 92.0,
          required_track_closure: true,
        },
        {
          task_id: 'TASK-02',
          department: 'TRD_OHE',
          section_id: 'NDLS-CNB-UP',
          duration_minutes: 90,
          priority_score: 84.0,
          required_power_block: true,
        },
      ],
      slots: [
        {
          slot_id: 'SLOT-01',
          section_id: 'NDLS-CNB-UP',
          start_time: '2026-09-08T01:00:00Z',
          end_time: '2026-09-08T04:00:00Z',
          duration_minutes: 180,
          disruption_score: 18.5,
        },
      ],
      auto_bundle: true,
    };
    const resSchedule = await request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/v1/ai/optimize/schedule',
      method: 'POST',
      headers: { 'x-api-key': VALID_KEY, 'Content-Type': 'application/json' },
    }, schedulePayload);
    assert(resSchedule.status === 200, 'POST /api/v1/ai/optimize/schedule returns 200');
    assert(resSchedule.body.data !== undefined, 'Returns schedule optimization data');

    // [6] POST /api/v1/ai/optimize/bundle
    console.log('\nTesting 6/9: POST /api/v1/ai/optimize/bundle...');
    const resBundle = await request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/v1/ai/optimize/bundle',
      method: 'POST',
      headers: { 'x-api-key': VALID_KEY, 'Content-Type': 'application/json' },
    }, { tasks: schedulePayload.tasks });
    assert(resBundle.status === 200, 'POST /api/v1/ai/optimize/bundle returns 200');
    assert(resBundle.body.data !== undefined, 'Returns bundling evaluation data');

    // [7] GET /api/v1/ai/models/info
    console.log('\nTesting 7/9: GET /api/v1/ai/models/info...');
    const resInfo = await request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/v1/ai/models/info',
      method: 'GET',
      headers: { 'x-api-key': VALID_KEY },
    });
    assert(resInfo.status === 200, 'GET /api/v1/ai/models/info returns 200');
    assert(resInfo.body.data.models?.priority_engine !== undefined, 'Provides priority_engine model info');
    assert(resInfo.body.data.models?.traffic_predictor !== undefined, 'Provides traffic_predictor model info');
    assert(resInfo.body.data.models?.block_optimizer !== undefined, 'Provides block_optimizer model info');

    // [8] POST /api/v1/ai/models/retrain
    console.log('\nTesting 8/9: POST /api/v1/ai/models/retrain...');
    const resRetrain = await request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/v1/ai/models/retrain',
      method: 'POST',
      headers: { 'x-api-key': VALID_KEY, 'Content-Type': 'application/json' },
    }, { samples: 500, model_type: 'RandomForest' });
    assert(resRetrain.status === 200, 'POST /api/v1/ai/models/retrain returns 200');
    assert(resRetrain.body.data.job_id !== undefined, 'Returns job_id for retrain task');

    // [9] GET /api/v1/ai/models/metrics
    console.log('\nTesting 9/9: GET /api/v1/ai/models/metrics...');
    const resMetrics = await request({
      hostname: '127.0.0.1',
      port: TEST_PORT,
      path: '/api/v1/ai/models/metrics',
      method: 'GET',
      headers: { 'x-api-key': VALID_KEY },
    });
    assert(resMetrics.status === 200, 'GET /api/v1/ai/models/metrics returns 200');
    assert(resMetrics.body.data.telemetry?.concept_drift_psi !== undefined, 'Returns telemetry drift metrics');
    assert(resMetrics.body.data.performance_benchmarks?.priority_engine !== undefined, 'Returns priority benchmark metrics');
    assert(resMetrics.body.data.performance_benchmarks?.traffic_predictor !== undefined, 'Returns traffic benchmark metrics');
    assert(resMetrics.body.data.performance_benchmarks?.block_optimizer !== undefined, 'Returns optimizer benchmark metrics');

  } catch (err) {
    console.error('[TEST SUITE ERROR]', err);
    process.exitCode = 1;
  } finally {
    server.close();
    console.log(`\n=================================================================`);
    console.log(`TEST RESULTS: ${passed}/${total} assertions passed (${((passed/total)*100).toFixed(1)}%)`);
    console.log(`=================================================================`);
  }
}

runTests();
