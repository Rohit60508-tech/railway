/**
 * test_monitoring_services.test.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Unit Tests for Operational Monitoring Services:
 *   - HealthMonitor
 *   - PerformanceMonitor
 *   - AlertService
 *   - LogAggregator
 *   - MetricsDashboard
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const assert = require('assert');
const { healthMonitor } = require('../../backend/services/health-monitor');
const { performanceMonitor } = require('../../backend/services/performance-monitor');
const { alertService, AlertSeverity, AlertDomain } = require('../../backend/services/alert-service');
const { logAggregator } = require('../../backend/services/log-aggregator');
const { metricsDashboard } = require('../../backend/services/metrics-dashboard');

async function runTests() {
  console.log('=== [UNIT TEST] Operational Monitoring Services ===');

  // Test 1: Health Monitor
  console.log('Test 1: HealthMonitor audit cycle...');
  const health = await healthMonitor.checkHealth();
  assert.ok(health.status !== undefined);
  assert.ok(health.components.ai_daemon !== undefined);
  console.log('  [PASS] HealthMonitor checked components');

  // Test 2: Performance Monitor
  console.log('Test 2: PerformanceMonitor latency percentile calculation...');
  performanceMonitor.recordRequest('GET', '/api/v1/ai/models/info', 12.4, 200);
  performanceMonitor.recordRequest('GET', '/api/v1/ai/models/info', 18.1, 200);
  const summary = performanceMonitor.getMetricsSummary();
  assert.ok(summary.throughput_rps >= 0);
  console.log('  [PASS] PerformanceMonitor recorded requests & throughput');

  // Test 3: Alert Service & Escalation
  console.log('Test 3: AlertService alert lifecycle...');
  const alert = alertService.raiseAlert({
    title: 'Unit Test Alert',
    message: 'Testing lifecycle',
    severity: AlertSeverity.WARNING,
    domain: AlertDomain.OPERATIONAL,
  });
  assert.ok(alert.alertId.startsWith('ALT-'));
  const acked = alertService.acknowledgeAlert(alert.alertId, 'TEST-OFFICER');
  assert.strictEqual(acked.status, 'ACKNOWLEDGED');
  const resolved = alertService.resolveAlert(alert.alertId, 'TEST-OFFICER');
  assert.strictEqual(resolved.status, 'RESOLVED');
  console.log('  [PASS] AlertService raised, acknowledged, and resolved alert');

  // Test 4: Log Aggregator
  console.log('Test 4: LogAggregator ingestion & query...');
  logAggregator.info('TEST_SUITE', 'Executing unit test message', { id: 999 });
  const logs = logAggregator.query({ keyword: 'Executing unit test' });
  assert.ok(logs.length >= 1);
  console.log('  [PASS] LogAggregator ingested and retrieved log');

  // Test 5: Metrics Dashboard
  console.log('Test 5: MetricsDashboard snapshot generation...');
  const snap = metricsDashboard.getDashboardSnapshot();
  assert.ok(snap.composite_indices.rail_health_index >= 0);
  console.log('  [PASS] MetricsDashboard generated telemetry snapshot');

  healthMonitor.stop();
  console.log('>>> Operational Monitoring: ALL UNIT TESTS PASSED <<<\n');
}

module.exports = { runTests };

if (require.main === module) {
  runTests().catch((e) => { console.error(e); process.exit(1); });
}
