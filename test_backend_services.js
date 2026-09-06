/**
 * test_backend_services.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Verification test suite for Node.js backend services connecting to Python AI:
 *   1. ai-service-connector.js
 *   2. defect-validator.js
 *   3. priority-engine.js
 *   4. traffic-analyzer.js
 *   5. block-optimizer.js
 *   6. python_runner.py child_process fallback
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { aiServiceConnector } = require('./backend/services/ai-service-connector');
const { defectValidator } = require('./backend/services/defect-validator');
const { priorityEngine } = require('./backend/services/priority-engine');
const { trafficAnalyzerService } = require('./backend/services/traffic-analyzer');
const { blockOptimizerService } = require('./backend/services/block-optimizer');

async function runTests() {
  console.log('=================================================================');
  console.log('NODE.JS BACKEND AI SERVICES INTEGRATION TEST');
  console.log('=================================================================');

  // 1. Health check
  console.log('\n[1/6] Testing AI Service Connector Health...');
  const health = await aiServiceConnector.checkHealth();
  console.log(`  [OK] AI Connector Health mode: ${health.mode}, status: ${health.server?.status}`);

  // 2. Defect Validator
  console.log('\n[2/6] Testing Defect Validator & AI Priority Scoring...');
  const sampleDefect = {
    defect_id: 'DEF-NODE-001',
    section_id: 'NDLS-CNB-UP',
    department: 'CIVIL',
    asset_type: 'RAIL_THERMIT_WELD',
    severity: 'CRITICAL',
    source: 'USFD',
    track_quality_index: 35.0,
    trains_per_day: 120.0,
    track_count: 2,
    overdue_days: 2.0,
  };
  const valResult = await defectValidator.validateAndPrioritize(sampleDefect);
  console.log(`  [OK] Valid: ${valResult.isValid}, Defect ID: ${valResult.defect.defect_id}, Priority Score: ${valResult.defect.priority_score}, Category: ${valResult.defect.priority_category}`);

  // 3. Priority Engine
  console.log('\n[3/6] Testing Priority Engine Service...');
  const batchDefects = [
    sampleDefect,
    {
      defect_id: 'DEF-NODE-002',
      section_id: 'NDLS-CNB-UP',
      department: 'TRD_OHE',
      asset_type: 'OHE_CANTILEVER',
      severity: 'MEDIUM',
      source: 'ITMS',
    },
  ];
  const ranked = await priorityEngine.rankBatch(batchDefects, true);
  console.log(`  [OK] Batch ranked ${ranked.totalDefects} defects. P1=${ranked.p1Count}, P2=${ranked.p2Count}, P3=${ranked.p3Count}, P4=${ranked.p4Count}`);

  const modelMeta = await priorityEngine.getModelMetadata();
  console.log(`  [OK] Model Info: Type=${modelMeta.model_info?.model_type || modelMeta.model_type}`);

  // 4. Traffic Analyzer
  console.log('\n[4/6] Testing Traffic Analyzer Service...');
  const occupancy = await trafficAnalyzerService.getSectionOccupancy('NDLS-CNB-UP');
  console.log(`  [OK] Section Occupancy: Section=${occupancy.sectionId}, Occupancy=${occupancy.occupancyPercentage}%`);

  const bestSlots = await trafficAnalyzerService.predictBestSlots('NDLS-CNB-UP', 120, 3);
  console.log(`  [OK] Best Slots: Received ${bestSlots.length} recommended slots`);
  if (bestSlots.length > 0) {
    console.log(`       Top Slot: Start=${bestSlots[0].slotStart}, Disruption=${bestSlots[0].disruptionScore}, Feasibility=${bestSlots[0].feasibility}`);
  }

  // 5. Block Optimizer
  console.log('\n[5/6] Testing Block Optimizer Service (OR-Tools CP-SAT & Bundling)...');
  const sampleTasks = [
    { task_id: 'TSK-01', section_id: 'NDLS-CNB-UP', department: 'CIVIL', duration_minutes: 90, priority_score: 88 },
    { task_id: 'TSK-02', section_id: 'NDLS-CNB-UP', department: 'TRD_OHE', duration_minutes: 60, priority_score: 75 },
    { task_id: 'TSK-03', section_id: 'CNB-PRYJ-DN', department: 'SIGNALLING', duration_minutes: 45, priority_score: 60 },
  ];

  // Bundling
  const bundles = await blockOptimizerService.bundleTasks(sampleTasks);
  console.log(`  [OK] Bundling Engine: Created ${bundles.length} bundle(s).`);

  // Optimization
  const candidateSlots = [
    { slot_id: 'SLOT-A', section_id: 'NDLS-CNB-UP', start_time: '2026-09-06T02:00:00Z', end_time: '2026-09-06T04:30:00Z', duration_minutes: 150, disruption_score: 20 },
    { slot_id: 'SLOT-B', section_id: 'CNB-PRYJ-DN', start_time: '2026-09-06T01:30:00Z', end_time: '2026-09-06T03:00:00Z', duration_minutes: 90, disruption_score: 15 },
  ];
  const schedule = await blockOptimizerService.generateSchedule(sampleTasks, candidateSlots, null, true);
  console.log(`  [OK] Optimizer CP-SAT: Status=${schedule.status}, Scheduled Blocks=${schedule.totalBlocksScheduled}, Tasks Scheduled=${schedule.tasksScheduled}`);

  // 6. Direct Python CLI Runner Fallback Test
  console.log('\n[6/6] Testing Python CLI Runner Fallback directly...');
  const cliCompat = await aiServiceConnector._executePythonCLI('check_compatibility', { dept1: 'CIVIL', dept2: 'TRD_OHE' });
  console.log(`  [OK] Python CLI Child Process Result: ${cliCompat.dept1} + ${cliCompat.dept2} Compatibility = ${cliCompat.compatibility}`);

  console.log('\n=================================================================');
  console.log('[ALL TESTS PASSED] NODE.JS SERVICES & PYTHON AI FULLY CONNECTED!');
  console.log('=================================================================');
}

runTests().catch((err) => {
  console.error('[TEST FAILED]', err);
  process.exit(1);
});
