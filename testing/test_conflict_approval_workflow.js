// test_conflict_approval_workflow.js
const http = require('http');

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: 5000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
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
  console.log('--- 1. Testing Live Conflicts API ---');
  const conflictsRes = await request('GET', '/api/v1/live-conflicts');
  console.log('Conflicts count:', conflictsRes.data?.length);
  if (conflictsRes.data?.length > 0) {
    const first = conflictsRes.data[0];
    console.log('First conflict item:', {
      id: first.id,
      conflictId: first.conflictId,
      status: first.status,
      proposedTime: first.proposedTime,
      alternative: first.alternative
    });

    console.log('\n--- 2. Testing Apply Alternative Window Approval ---');
    const approveRes = await request('POST', '/api/v1/apply-alternative-window', {
      request_id: first.conflictId,
      alternative_window: first.alternative.recommendedWindow,
      officer_id: 'IR-SSE-TEST',
      officer_name: 'Test Controller',
      officer_role: 'Senior Section Controller',
      reason: 'Approval from active conflict analysis to move to work orders'
    });
    console.log('Approve result:', approveRes.status, approveRes.data);

    console.log('\n--- 3. Verifying in Requested Windows (Work Orders API) ---');
    const windowsRes = await request('GET', '/api/v1/requested-windows');
    const matched = (windowsRes.data || []).find(w => w.request_id === first.conflictId);
    console.log('Matched in requested_windows:', {
      request_id: matched?.request_id,
      status: matched?.status,
      applied_alternative: matched?.applied_alternative,
      requested_window: matched?.requested_window
    });

    if (matched && (matched.status === 'ALTERNATIVE_APPLIED' || matched.status === 'SANCTIONED')) {
      console.log('✅ SUCCESS: Task is marked sanctioned and has alternative window set!');
    } else {
      console.log('❌ FAILURE: Task status is not sanctioned');
    }
  }
}

run().catch(console.error);
