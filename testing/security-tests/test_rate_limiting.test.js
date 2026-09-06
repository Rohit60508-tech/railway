/**
 * test_rate_limiting.test.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Security Tests: Rate Limiting & DoS Protection:
 *   - Verifies standard rate limit headers (X-RateLimit-Limit, Remaining, Reset)
 *   - Verifies 429 Too Many Requests response on burst exhaustion
 *   - Verifies Retry-After header presence
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const http = require('http');
const assert = require('assert');
const { createAiServer, API_PREFIX, rateLimitStore } = require('../../backend/api/ai-api');

const VALID_KEY = 'ir-ai-key-2026';

async function runTests() {
  console.log('=== [SECURITY TEST] Rate Limiting & DoS Protection ===');
  const server = await createAiServer(0);
  const actualPort = server.address().port;
  const baseUrl = `http://127.0.0.1:${actualPort}${API_PREFIX}`;

  function request(path, apiKey) {
    return new Promise((resolve, reject) => {
      const url = new URL(baseUrl + path);
      const req = http.request({
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'GET',
        headers: { 'X-API-Key': apiKey },
      }, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
          } catch (_) {
            resolve({ status: res.statusCode, headers: res.headers, body: data });
          }
        });
      });
      req.on('error', reject);
      req.end();
    });
  }

  try {
    // Test 1: Header Verification
    console.log('Test 1: Verifying standard RFC rate limiting headers...');
    const res1 = await request('/models/info', VALID_KEY);
    assert.strictEqual(res1.status, 200);
    assert.ok(res1.headers['x-ratelimit-limit'] !== undefined, 'Has limit header');
    assert.ok(res1.headers['x-ratelimit-remaining'] !== undefined, 'Has remaining header');
    assert.ok(res1.headers['x-ratelimit-reset'] !== undefined, 'Has reset header');
    console.log('  [PASS] Rate limit headers verified:', {
      limit: res1.headers['x-ratelimit-limit'],
      remaining: res1.headers['x-ratelimit-remaining'],
    });

    // Test 2: Simulating Burst Limit Breach
    console.log('Test 2: Simulating burst request spike beyond threshold...');
    const floodKey = 'flood-test-key-01';
    rateLimitStore.set(floodKey, { count: 9999, resetTime: Date.now() + 45000 });

    const res2 = await request('/models/info', floodKey);
    assert.strictEqual(res2.status, 429, 'Must return 429 Too Many Requests');
    assert.strictEqual(res2.body.error?.code, 'RATE_LIMIT_EXCEEDED');
    assert.ok(res2.headers['retry-after'] !== undefined, 'Must provide Retry-After header');
    console.log('  [PASS] Successfully blocked burst flooding with 429 and Retry-After:', res2.headers['retry-after'], 'seconds');

    rateLimitStore.delete(floodKey);
    console.log('>>> Rate Limiting: ALL SECURITY TESTS PASSED <<<\n');
  } finally {
    server.close();
  }
}

module.exports = { runTests };

if (require.main === module) {
  runTests().catch((e) => { console.error(e); process.exit(1); });
}
