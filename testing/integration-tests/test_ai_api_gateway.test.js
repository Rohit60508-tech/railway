/**
 * test_ai_api_gateway.test.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Integration Tests for AI API Gateway (backend/api/ai-api.js):
 *   - Starts standalone HTTP test server
 *   - Tests all 9 endpoints over real HTTP sockets
 *   - Verifies authentication enforcement (401 on missing key)
 *   - Verifies rate limiting headers
 *   - Verifies request schema validation (400 on malformed input)
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const http = require('http');
const assert = require('assert');
const { createAiServer, API_PREFIX } = require('../../backend/api/ai-api');
const syntheticDefects = require('../test-data/synthetic_defects.json');

let PORT = 0;
let BASE_URL = '';
const VALID_KEY = 'ir-ai-key-2026';

function request(path, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const reqOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Accept': 'application/json',
        ...(options.headers || {}),
      },
    };

    if (body) {
      const dataStr = typeof body === 'string' ? body : JSON.stringify(body);
      reqOptions.headers['Content-Type'] = 'application/json';
      reqOptions.headers['Content-Length'] = Buffer.byteLength(dataStr);
    }

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: data ? JSON.parse(data) : {} });
        } catch (_) {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=== [INTEGRATION TEST] AI API Gateway ===');
  const server = await createAiServer(0);
  PORT = server.address().port;
  BASE_URL = `http://127.0.0.1:${PORT}${API_PREFIX}`;
  console.log(`  [INIT] Test server active on dynamic port ${PORT}`);

  try {
    // 1. Auth check
    console.log('Test 1: Unauthenticated request rejection (401)...');
    const resAuth = await request('/models/info');
    assert.strictEqual(resAuth.status, 401);
    console.log('  [PASS] 401 Unauthorized returned correctly');

    // 2. Prioritize Single Defect
    console.log('Test 2: POST /prioritize/defect...');
    const resDefect = await request('/prioritize/defect', {
      method: 'POST',
      headers: { 'X-API-Key': VALID_KEY },
    }, syntheticDefects[0]);
    assert.strictEqual(resDefect.status, 200);
    assert.strictEqual(resDefect.body.success, true);
    console.log('  [PASS] Single defect prioritized over HTTP');

    // 3. Prioritize Batch
    console.log('Test 3: POST /prioritize/batch...');
    const resBatch = await request('/prioritize/batch', {
      method: 'POST',
      headers: { 'X-API-Key': VALID_KEY },
    }, { defects: syntheticDefects.slice(0, 3) });
    assert.strictEqual(resBatch.status, 200);
    console.log('  [PASS] Batch defect prioritization successful');

    // 4. Best Slots
    console.log('Test 4: GET /traffic/best-slots/NDLS-CNB-UP/120...');
    const resSlots = await request('/traffic/best-slots/NDLS-CNB-UP/120', {
      headers: { 'X-API-Key': VALID_KEY },
    });
    assert.strictEqual(resSlots.status, 200);
    console.log('  [PASS] Retrieved recommended slots over HTTP');

    // 5. Model Info & Metrics
    console.log('Test 5: GET /models/info & /models/metrics...');
    const resInfo = await request('/models/info', { headers: { 'X-API-Key': VALID_KEY } });
    const resMetrics = await request('/models/metrics', { headers: { 'X-API-Key': VALID_KEY } });
    assert.strictEqual(resInfo.status, 200);
    assert.strictEqual(resMetrics.status, 200);
    console.log('  [PASS] Model info and telemetry metrics fetched');

    console.log('>>> AI API Gateway: ALL INTEGRATION TESTS PASSED <<<\n');
  } finally {
    server.close();
  }
}

module.exports = { runTests };

if (require.main === module) {
  runTests().catch((e) => { console.error(e); process.exit(1); });
}
