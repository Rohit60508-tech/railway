// test_e2e_conflict_to_work_order.js
const http = require('http');

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 5000,
      path: path,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    }, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (_) {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function run() {
  const testId = `REQ-TEST-${Date.now().toString().slice(-4)}`;
  console.log(`\n=== STEP 1: Creating New Requisition ${testId} (PENDING_REVIEW) ===`);
  const createRes = await request('POST', '/api/v1/requested-windows', {
    request_id: testId,
    section_id: 'NDLS-CNB-UP',
    station_from: 'NDLS',
    station_to: 'CNB',
    start_km: 15.0,
    end_km: 18.5,
    km_pole: 'KM 15-18.5',
    requested_window: '09:30 – 11:30',
    window_start_time: '09:30',
    window_end_time: '11:30',
    duration_minutes: 120,
    department: 'Civil (P-Way)',
    work_description: 'Emergency Track Bed Compaction & Ballast Packing',
    priority: 'P1',
    status: 'PENDING_REVIEW'
  });
  console.log('Create result:', createRes.status, createRes.data?.success || createRes.data);

  console.log(`\n=== STEP 2: Verifying in Active Conflict Analysis ===`);
  const conflictsRes = await request('GET', '/api/v1/live-conflicts');
  const foundConflict = (conflictsRes.data || []).find(c => c.conflictId === testId);
  if (!foundConflict) {
    throw new Error(`Requisition ${testId} not found in live conflicts!`);
  }
  console.log('Found in Active Conflict Analysis:', {
    conflictId: foundConflict.conflictId,
    status: foundConflict.status,
    proposedTime: foundConflict.proposedTime,
    conflictedTrains: foundConflict.conflictedTrains,
    alternative: foundConflict.alternative
  });

  console.log(`\n=== STEP 3: Simulating Approval from Active Conflict Analysis ===`);
  const altWindow = foundConflict.alternative.recommendedWindow;
  const approveRes = await request('POST', '/api/v1/apply-alternative-window', {
    request_id: testId,
    alternative_window: altWindow,
    officer_id: 'IR-SSE-9901',
    officer_name: 'Rajesh Kumar Verma',
    officer_role: 'Senior Section Controller',
    reason: 'Approved optimal AI window to move task to work orders board'
  });
  console.log('Approval response:', approveRes.status, approveRes.data);

  console.log(`\n=== STEP 4: Verifying Task Moves to Work Orders (Pending Acceptance) ===`);
  const workOrdersRes = await request('GET', '/api/v1/requested-windows');
  const woItem = (workOrdersRes.data || []).find(w => w.request_id === testId);
  console.log('Work Order Item in DB:', {
    request_id: woItem?.request_id,
    status: woItem?.status,
    applied_alternative: woItem?.applied_alternative,
    requested_window: woItem?.requested_window,
    department: woItem?.department
  });

  // Client mapping simulation as in maintenance-dashboard.html:
  const st = (woItem.status || 'PENDING_REVIEW').toUpperCase();
  const isSanctioned = st === 'APPROVED' || st === 'SANCTIONED' || st.includes('SANCTION') || st.includes('APPROV') || st === 'ALTERNATIVE_APPLIED' || st === 'FORCE_SANCTIONED' || st === 'ACCEPTED' || st === 'COMPLETED';
  const isAccepted = st === 'ACCEPTED' || !!woItem.accepted_at;
  const isCompleted = st === 'COMPLETED' || st === 'RECTIFIED' || !!woItem.completed_at;
  const slotRecommended = woItem.applied_alternative || woItem.requested_window;

  console.log('\n=== Client Mapping Verification in Work Orders ===');
  console.log('isSanctioned:', isSanctioned);
  console.log('isAccepted:', isAccepted);
  console.log('isCompleted:', isCompleted);
  console.log('slotRecommended (should be alternative slot):', slotRecommended);
  console.log('Eligible for "Control Office Sanctioned Work Requisitions (Pending Acceptance)":', isSanctioned && !isAccepted && !isCompleted);

  if (isSanctioned && !isAccepted && !isCompleted && slotRecommended === altWindow) {
    console.log('\n🎉 ALL TESTS PASSED: Task successfully moves from Active Conflict Analysis to Work Orders (Pending Acceptance) with the sanctioned slot!');
  } else {
    console.error('\n❌ TEST FAILED: Verification conditions not met.');
    process.exit(1);
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
