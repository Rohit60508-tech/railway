/**
 * run-all-tests.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Master Test Suite Runner for Indian Railways AI Platform:
 *   - Runs all Unit Tests (/testing/unit-tests/)
 *   - Runs all Integration Tests (/testing/integration-tests/)
 *   - Runs all Security Tests (/testing/security-tests/)
 *   - Runs Performance Benchmarks (/testing/performance-tests/)
 *   - Aggregates overall pass/fail metrics and returns exit code 0 or 1.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const path = require('path');

// Unit Tests
const unitDefectValidator = require('./unit-tests/test_defect_validator.test');
const unitPriorityEngine = require('./unit-tests/test_priority_engine.test');
const unitTrafficAnalyzer = require('./unit-tests/test_traffic_analyzer.test');
const unitBlockOptimizer = require('./unit-tests/test_block_optimizer.test');
const unitMonitoring = require('./unit-tests/test_monitoring_services.test');

// Integration Tests
const intGateway = require('./integration-tests/test_ai_api_gateway.test');
const intPipeline = require('./integration-tests/test_pipeline_e2e.test');

// Security Tests
const secAuth = require('./security-tests/test_auth_rbac.test');
const secRateLimit = require('./security-tests/test_rate_limiting.test');
const secSanitization = require('./security-tests/test_input_sanitization.test');

// Performance Tests
const perfPrioritization = require('./performance-tests/load_test_prioritization');
const perfOptimizer = require('./performance-tests/stress_test_optimizer');

async function main() {
  console.log('=================================================================');
  console.log('  INDIAN RAILWAYS AI PLATFORM — MASTER TEST SUITE RUNNER         ');
  console.log('=================================================================');
  console.log(`Started at: ${new Date().toISOString()}\n`);

  const suites = [
    { name: 'Unit: DefectValidator', fn: unitDefectValidator.runTests },
    { name: 'Unit: PriorityEngine', fn: unitPriorityEngine.runTests },
    { name: 'Unit: TrafficAnalyzer', fn: unitTrafficAnalyzer.runTests },
    { name: 'Unit: BlockOptimizer', fn: unitBlockOptimizer.runTests },
    { name: 'Unit: MonitoringServices', fn: unitMonitoring.runTests },
    { name: 'Integration: API Gateway', fn: intGateway.runTests },
    { name: 'Integration: E2E Pipeline', fn: intPipeline.runTests },
    { name: 'Security: Auth & RBAC', fn: secAuth.runTests },
    { name: 'Security: Rate Limiting', fn: secRateLimit.runTests },
    { name: 'Security: Input Sanitization', fn: secSanitization.runTests },
    { name: 'Performance: Prioritization Load', fn: perfPrioritization.runTests },
    { name: 'Performance: CP-SAT Stress', fn: perfOptimizer.runTests },
  ];

  let passedSuites = 0;
  let failedSuites = 0;

  for (const suite of suites) {
    try {
      await suite.fn();
      passedSuites++;
    } catch (err) {
      console.error(`\n[SUITE FAILED] ${suite.name}:`, err.message);
      failedSuites++;
    }
  }

  console.log('=================================================================');
  console.log(`MASTER TEST SUMMARY: ${passedSuites}/${suites.length} test suites passed`);
  if (failedSuites === 0) {
    console.log('>>> STATUS: ALL TESTS PASSED! RAILWAY ACCEPTANCE CRITERIA MET <<<');
    process.exit(0);
  } else {
    console.error(`>>> STATUS: ${failedSuites} TEST SUITE(S) FAILED <<<`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal test runner failure:', err);
  process.exit(1);
});
