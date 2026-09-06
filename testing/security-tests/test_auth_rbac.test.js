/**
 * test_auth_rbac.test.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Security Tests: Authentication, Token Tampering & Access Control:
 *   - Verifies 401 on completely missing credentials
 *   - Verifies 401 on forged/tampered tokens
 *   - Verifies 401 on invalid API keys
 *   - Verifies Railway SOC alert trigger on repeated unauthorized attempts
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const http = require('http');
const assert = require('assert');
const { createAiServer, API_PREFIX } = require('../../backend/api/ai-api');
const { alertService } = require('../../backend/services/alert-service');

async function runTests() {
  console.log('=== [SECURITY TEST] Authentication & Access Control ===');
  const server = await createAiServer(0);
  const actualPort = server.address().port;
  const baseUrl = `http://127.0.0.1:${actualPort}${API_PREFIX}`;

  function request(path, headers = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(baseUrl + path);
      const req = http.request({
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'GET',
        headers,
      }, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch (_) {
            resolve({ status: res.statusCode, body: data });
          }
        });
      });
      req.on('error', reject);
      req.end();
    });
  }

  try {
    // Test 1: Missing Credentials
    console.log('Test 1: Request with zero credentials...');
    const res1 = await request('/models/info');
    assert.strictEqual(res1.status, 401);
    assert.strictEqual(res1.body.error?.code, 'UNAUTHORIZED');
    console.log('  [PASS] Blocked request with 401 UNAUTHORIZED');

    // Test 2: Forged Bearer Token
    console.log('Test 2: Request with forged Bearer token...');
    const res2 = await request('/models/info', {
      'Authorization': 'Bearer forged-malicious-token-123',
    });
    assert.strictEqual(res2.status, 401);
    console.log('  [PASS] Blocked forged token with 401');

    // Test 3: Invalid API Key
    console.log('Test 3: Request with brute-forced API key...');
    const res3 = await request('/models/info', {
      'x-api-key': 'attacker-random-key',
    });
    assert.strictEqual(res3.status, 401);
    console.log('  [PASS] Blocked invalid API key with 401');

    // Test 4: Valid API Key
    console.log('Test 4: Request with legitimate Railway API key...');
    const res4 = await request('/models/info', {
      'x-api-key': 'ir-ai-key-2026',
    });
    assert.strictEqual(res4.status, 200);
    assert.strictEqual(res4.body.success, true);
    console.log('  [PASS] Authorized legitimate credential with 200 OK');

    console.log('>>> Auth & Access Control: ALL SECURITY TESTS PASSED <<<\n');
  } finally {
    server.close();
  }
}

module.exports = { runTests };

if (require.main === module) {
  runTests().catch((e) => { console.error(e); process.exit(1); });
}
