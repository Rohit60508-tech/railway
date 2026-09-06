/**
 * test_monitoring_services.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Verification suite for newly implemented monitoring services:
 *   1. health-monitor.js
 *   2. performance-monitor.js
 *   3. alert-service.js
 *   4. log-aggregator.js
 *   5. metrics-dashboard.js
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const { healthMonitor, HealthStatus } = require('./backend/services/health-monitor');
const { performanceMonitor } = require('./backend/services/performance-monitor');
const { alertService, AlertSeverity, AlertDomain } = require('./backend/services/alert-service');
const { logAggregator, LogLevel } = require('./backend/services/log-aggregator');
const { metricsDashboard } = require('./backend/services/metrics-dashboard');

async function runTests() {
  console.log('=================================================================');
  console.log('OPERATIONAL MONITORING & SOC INTEGRATION TEST SUITE');
  console.log('=================================================================');

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

  // 1. Health Monitor Tests
  console.log('\n--- 1. Testing Health Monitor (health-monitor.js) ---');
  let healthChangeEmitted = false;
  healthMonitor.once('health_change', () => { healthChangeEmitted = true; });

  const report = await healthMonitor.checkHealth();
  assert(report.status !== undefined, 'Report has system status');
  assert(report.components.ai_daemon !== undefined, 'Tracks AI Daemon component');
  assert(report.components.database !== undefined, 'Tracks Database component');
  assert(report.components.system_resources.details.totalMemoryMB > 0, 'Reads system memory metrics');
  console.log(`  [INFO] Composite Health Status: ${report.status}`);

  // 2. Performance Monitor Tests
  console.log('\n--- 2. Testing Performance Monitor (performance-monitor.js) ---');
  performanceMonitor.recordRequest('POST', '/api/v1/ai/prioritize/defect', 28.5, 200);
  performanceMonitor.recordRequest('POST', '/api/v1/ai/prioritize/defect', 35.2, 200);
  performanceMonitor.recordRequest('POST', '/api/v1/ai/prioritize/defect', 120.0, 500); // 1 error
  performanceMonitor.recordAiInference('defect_prioritization', 24.1, { sample_id: 'DEF-01' });

  const perfSummary = performanceMonitor.getMetricsSummary();
  assert(perfSummary.total_requests >= 3, 'Recorded requests count');
  assert(perfSummary.total_errors >= 1, 'Recorded error count');
  assert(perfSummary.throughput_rps >= 0, 'Computes throughput RPS');
  assert(perfSummary.routes['POST /api/v1/ai/prioritize/defect'].stats.p95 > 0, 'Computes route P95 latency');

  const promMetrics = performanceMonitor.getPrometheusMetrics();
  assert(promMetrics.includes('ir_ai_requests_total'), 'Exports Prometheus total requests counter');
  assert(promMetrics.includes('ir_ai_inference_p95_ms'), 'Exports Prometheus P95 latency gauge');

  // 3. Alert Service & SOC Tests
  console.log('\n--- 3. Testing Alert Service & SOC Dispatch (alert-service.js) ---');
  let socEventDispatched = false;
  alertService.once('soc_dispatched', () => { socEventDispatched = true; });

  const alert = alertService.raiseAlert({
    title: 'Rail Flaw Escalation - USFD Signal Breach',
    message: 'Imminent risk of rail fracture at KM 45/12 NDLS-CNB-UP',
    severity: AlertSeverity.CRITICAL,
    domain: AlertDomain.SAFETY,
    sectionId: 'NDLS-CNB-UP',
  });
  assert(alert.alertId.startsWith('ALT-'), 'Generated formatted Alert ID');
  assert(alert.status === 'ACTIVE', 'Alert is in ACTIVE state');
  assert(socEventDispatched, 'Dispatched Critical alert to Railway SOC event stream');

  // Acknowledge and Resolve
  const acked = alertService.acknowledgeAlert(alert.alertId, 'CHIEF-CONTROLLER-NDLS');
  assert(acked.status === 'ACKNOWLEDGED', 'Alert successfully acknowledged');

  const resolved = alertService.resolveAlert(alert.alertId, 'CHIEF-CONTROLLER-NDLS', 'Emergency clamp installed and 20kmh caution order imposed.');
  assert(resolved.status === 'RESOLVED', 'Alert successfully marked RESOLVED');

  // 4. Log Aggregator Tests
  console.log('\n--- 4. Testing Log Aggregator (log-aggregator.js) ---');
  let socLogForwarded = false;
  logAggregator.once('soc_forwarded', () => { socLogForwarded = true; });

  logAggregator.info('API_GATEWAY', 'Processed incoming prioritization request', { defect_id: 'DEF-100' });
  logAggregator.security('AUTH_SERVICE', 'Suspicious brute-force attempt blocked on API key endpoint', { ip: '10.0.4.15' });

  assert(socLogForwarded, 'Security log forwarded to Railway SOC SIEM feed');

  const searchResults = logAggregator.query({ keyword: 'brute-force' });
  assert(searchResults.length >= 1, 'Ring buffer successfully queried log by keyword');

  const logStats = logAggregator.getStats();
  assert(logStats.total_in_memory >= 2, 'Ring buffer tracks total in-memory count');

  // 5. Metrics Dashboard Tests
  console.log('\n--- 5. Testing Metrics Dashboard (metrics-dashboard.js) ---');
  const dashSnapshot = metricsDashboard.getDashboardSnapshot();
  assert(dashSnapshot.composite_indices.rail_health_index >= 0 && dashSnapshot.composite_indices.rail_health_index <= 100, 'Calculated Rail Health Index (0-100)');
  assert(dashSnapshot.composite_indices.soc_security_posture_score >= 0, 'Calculated SOC Security Posture Score');
  assert(dashSnapshot.optimization_metrics.cp_sat_feasibility_rate_pct === 96.5, 'Provides CP-SAT optimization telemetry');

  const widgetHtml = metricsDashboard.generateStatusWidgetHtml();
  assert(widgetHtml.includes('Indian Railways AI Status'), 'Generated standalone HTML status widget');

  console.log(`\n=================================================================`);
  console.log(`MONITORING TEST RESULTS: ${passed}/${total} assertions passed (${((passed/total)*100).toFixed(1)}%)`);
  console.log(`=================================================================`);

  // Clean exit
  healthMonitor.stop();
}

runTests().catch((err) => {
  console.error('Test failed with unhandled error:', err);
  process.exit(1);
});
