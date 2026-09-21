const { supabaseAuditService } = require('../backend/services/supabase-client');
const supabaseClient = supabaseAuditService;

async function runTest() {
  console.log('=== TEST PRIORITY 1: SUPABASE TABLE MAPPING & OPERATIONS ===');
  const testId = `REQ-TEST-MAP-${Date.now()}`;
  
  // 1. Insert test record via requested_windows table alias
  console.log('1. Testing INSERT to requested_windows (mapped to requested_maintenance_windows)...');
  const insertRes = await supabaseClient.insertRecord('requested_windows', {
    request_id: testId,
    section_id: 'NDLS-GZB-DN',
    station_from: 'NDLS',
    station_to: 'GZB',
    start_km: 6.4,
    end_km: 9.7,
    requested_window: '01:30 – 04:30',
    window_start_time: '01:30',
    window_end_time: '04:30',
    duration_minutes: 180,
    department: 'Civil (P-Way)',
    work_description: 'Test Table Mapping Validation',
    priority: 'P1'
  });
  console.log('Insert Result:', insertRes);

  if (!insertRes.success) {
    console.error('FAILED INSERT TEST');
    process.exit(1);
  }

  // 2. Query table
  console.log('\n2. Testing SELECT from requested_windows (fetching from Supabase Cloud)...');
  const selectRes = await supabaseClient.queryTable('requested_windows', {
    filterKey: 'request_id',
    filterVal: testId
  });
  console.log('Select Result (Source: ' + selectRes.source + '):', selectRes.data);

  // 3. Update/PATCH table
  console.log('\n3. Testing UPDATE/PATCH on requested_windows in Supabase Cloud...');
  const updateRes = await supabaseClient.updateRecord('requested_windows', 'request_id', testId, {
    status: 'SANCTIONED',
    work_description: 'Test Table Mapping Validation - Updated'
  });
  console.log('Update Result:', updateRes);

  // 4. Verify update
  const verifyRes = await supabaseClient.queryTable('requested_windows', {
    filterKey: 'request_id',
    filterVal: testId
  });
  console.log('\n4. Verification query result:', verifyRes.data);

  // 5. Cleanup test record from Supabase Cloud directly
  console.log(`\n5. Cleaning up test record: ${testId}`);
  if (supabaseClient.isConfigured) {
    const res = await fetch(`${supabaseClient.url}/rest/v1/requested_maintenance_windows?request_id=eq.${encodeURIComponent(testId)}`, {
      method: 'DELETE',
      headers: {
        apikey: supabaseClient.key,
        Authorization: `Bearer ${supabaseClient.key}`
      }
    });
    console.log('Test record deleted from Supabase Cloud. Status:', res.status);
  }
}

runTest().catch(console.error);
