const http = require('http');
const { supabaseAuditService } = require('../backend/services/supabase-client');

const PORT = 5000;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function makeRequest(path, method, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data || '{}');
          resolve({ status: res.statusCode, data: json, raw: data });
        } catch (_) {
          resolve({ status: res.statusCode, data: null, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runEndToEndVerification() {
  console.log('===============================================================');
  console.log('  END-TO-END VERIFICATION: PRIORITIES 1 THROUGH 6              ');
  console.log('===============================================================');

  const testRequestId = `REQ-TEST-E2E-${Date.now()}`;
  const testDefectId = `DEF-TEST-E2E-${Date.now()}`;

  try {
    // 0. Setup test defect in maintenance_defects
    console.log(`\n--- SETUP: Creating Linked Test Defect (${testDefectId}) ---`);
    const defectRes = await supabaseAuditService.insertRecord('maintenance_defects', {
      external_ref_id: testDefectId,
      source_system: 'TMS',
      department: 'CIVIL',
      section_id: 'NDLS-CNB-UP',
      start_km: 12.4,
      end_km: 14.8,
      defect_type: 'Test Rail Flaw Ultrasonic Verification',
      severity: 'HIGH',
      criticality_score: 8,
      status: 'ACTIVE_DEFECT'
    });
    console.log('Defect insert result:', defectRes.storage_destination, defectRes.success ? '✓' : 'FAILED');

    // 0b. Setup test maintenance request in requested_windows (mapped to requested_maintenance_windows)
    console.log(`\n--- SETUP: Creating Test Maintenance Request (${testRequestId}) ---`);
    const reqRes = await makeRequest('/api/v1/requested-windows', 'POST', {
      request_id: testRequestId,
      section_id: 'NDLS-CNB-UP',
      station_from: 'NDLS',
      station_to: 'CNB',
      start_km: 12.4,
      end_km: 14.8,
      requested_window: '02:00 – 04:00',
      window_start_time: '02:00',
      window_end_time: '04:00',
      duration_minutes: 120,
      department: 'Civil (P-Way)',
      work_description: 'Test P-Way Rail Weld Overhaul',
      priority: 'P1',
      defect_ref_id: testDefectId
    });
    console.log('Request creation response:', reqRes.status, reqRes.data.storage_destination);

    // ══════════════════════════════════════════════════════════
    // TEST A: CONTROL OFFICE ENDPOINTS
    // ══════════════════════════════════════════════════════════
    console.log('\n--- TEST A1: Apply Alternative Window ---');
    const applyAltRes = await makeRequest('/api/v1/apply-alternative-window', 'POST', {
      request_id: testRequestId,
      alternative_window: '02:30 – 04:30',
      officer_id: 'IR-SEC-402',
      officer_name: 'Senior Section Controller Test',
      officer_role: 'Senior Section Controller',
      reason: 'Avoid clash with Vande Bharat Express'
    });
    console.log('Apply Alternative Response:', applyAltRes.status, applyAltRes.data);

    // Verify status changed to ALTERNATIVE_APPLIED
    const verifyAlt = await makeRequest(`/api/v1/requested-windows?key=request_id&val=${testRequestId}`, 'GET');
    const altRecord = (verifyAlt.data || []).find(r => r.request_id === testRequestId);
    console.log('Verified Status in DB:', altRecord ? altRecord.status : 'NOT FOUND', '| Applied Window:', altRecord?.applied_alternative);

    console.log('\n--- TEST A2: Force Sanction Window ---');
    const forceRes = await makeRequest('/api/v1/force-sanction-window', 'POST', {
      request_id: testRequestId,
      officer_id: 'DOM-AGRA-109',
      officer_name: 'Divisional Operations Manager Test',
      officer_role: 'DOM',
      reason: 'Force sanction override for urgent track safety'
    });
    console.log('Force Sanction Response:', forceRes.status, forceRes.data);

    const verifyForce = await makeRequest(`/api/v1/requested-windows?key=request_id&val=${testRequestId}`, 'GET');
    const forceRecord = (verifyForce.data || []).find(r => r.request_id === testRequestId);
    console.log('Verified Status in DB:', forceRecord ? forceRecord.status : 'NOT FOUND');

    // ══════════════════════════════════════════════════════════
    // TEST B: MAINTENANCE DASHBOARD PERSISTENCE & LIFECYCLE
    // ══════════════════════════════════════════════════════════
    console.log('\n--- TEST B1: Accept & Lock Slot ---');
    const acceptRes = await makeRequest(`/api/v1/supabase/data/requested_windows?key=request_id&val=${testRequestId}`, 'PATCH', {
      status: 'ACCEPTED',
      accepted_at: new Date().toISOString()
    });
    console.log('Accept & Lock Response:', acceptRes.status, acceptRes.data);

    const verifyAccept = await makeRequest(`/api/v1/requested-windows?key=request_id&val=${testRequestId}`, 'GET');
    const acceptRecord = (verifyAccept.data || []).find(r => r.request_id === testRequestId);
    console.log('Verified Status in DB:', acceptRecord ? acceptRecord.status : 'NOT FOUND', '| Accepted At:', acceptRecord?.accepted_at);

    console.log('\n--- TEST B2: Work Completion & Fitness Certification ---');
    const completeRes = await makeRequest(`/api/v1/supabase/data/requested_windows?key=request_id&val=${testRequestId}`, 'PATCH', {
      status: 'COMPLETED',
      completed_at: new Date().toISOString(),
      action_taken: 'Replaced weld section & torqued fasteners to 180 Nm per IRPWM',
      condition_now: 'FIT_UNRESTRICTED_SECTIONAL_SPEED',
      fit_cert_no: `IR-FIT-TEST-${Date.now()}`,
      t351_memo: `T-351-TEST-${Date.now()}`,
      actual_possession_minutes: 110,
      track_geometry: 'Gauge: 1676mm (+0.2mm) | Cross-level: 0mm',
      sse_staff_id: 'IR-SSE-4402',
      defect_ref_id: testDefectId
    });
    console.log('Completion Response:', completeRes.status, completeRes.data);

    const verifyComplete = await makeRequest(`/api/v1/requested-windows?key=request_id&val=${testRequestId}`, 'GET');
    const completeRecord = (verifyComplete.data || []).find(r => r.request_id === testRequestId);
    console.log('Verified Status in DB:', completeRecord ? completeRecord.status : 'NOT FOUND');
    console.log('Verified Action Taken:', completeRecord?.action_taken);
    console.log('Verified Fit Cert No:', completeRecord?.fit_cert_no);

    // ══════════════════════════════════════════════════════════
    // PRIORITY 5: DEFECT STATUS SYNCHRONIZATION
    // ══════════════════════════════════════════════════════════
    console.log('\n--- TEST B3: Verify Linked Defect Synchronization (RECTIFIED) ---');
    const verifyDefect = await supabaseAuditService.queryTable('maintenance_defects', {
      filterKey: 'external_ref_id',
      filterVal: testDefectId
    });
    const defectObj = (verifyDefect.data || []).find(d => d.external_ref_id === testDefectId || d.defect_id === testDefectId);
    console.log('Linked Defect Status in DB:', defectObj ? defectObj.status : 'NOT FOUND', '| Rectified At:', defectObj?.rectified_at);

    // ══════════════════════════════════════════════════════════
    // TEST C: DIRECT SUPABASE CLOUD REST API VERIFICATION
    // ══════════════════════════════════════════════════════════
    console.log('\n--- TEST C: Direct PostgREST Verification Against Supabase Cloud ---');
    if (supabaseAuditService.isConfigured) {
      const cloudRes = await fetch(`${supabaseAuditService.url}/rest/v1/requested_maintenance_windows?request_id=eq.${encodeURIComponent(testRequestId)}`, {
        headers: {
          apikey: supabaseAuditService.key,
          Authorization: `Bearer ${supabaseAuditService.key}`
        }
      });
      const cloudData = await cloudRes.json();
      console.log('Supabase Cloud REST Response (requested_maintenance_windows):', cloudRes.status, cloudData);
      
      const cloudAuditRes = await fetch(`${supabaseAuditService.url}/rest/v1/immutable_action_audit_log?target_entity_id=eq.${encodeURIComponent(testRequestId)}`, {
        headers: {
          apikey: supabaseAuditService.key,
          Authorization: `Bearer ${supabaseAuditService.key}`
        }
      });
      const cloudAuditData = await cloudAuditRes.json();
      console.log('Supabase Cloud Audit Log Records for Test Item:', cloudAuditData.length);
    }

    // ══════════════════════════════════════════════════════════
    // TEST D: FAILURE HANDLING (NON-200 ON INVALID / FAILED OPERATIONS)
    // ══════════════════════════════════════════════════════════
    console.log('\n--- TEST D: Error Handling on Invalid Requests ---');
    const invalidAltRes = await makeRequest('/api/v1/apply-alternative-window', 'POST', {
      // missing request_id and alternative_window
    });
    console.log('Invalid Apply Alternative Status (Expected 400):', invalidAltRes.status, invalidAltRes.data);

    const invalidForceRes = await makeRequest('/api/v1/force-sanction-window', 'POST', {
      // missing request_id
    });
    console.log('Invalid Force Sanction Status (Expected 400):', invalidForceRes.status, invalidForceRes.data);

  } catch (err) {
    console.error('Test run error:', err);
  } finally {
    // ══════════════════════════════════════════════════════════
    // CLEANUP: Clean only the test records
    // ══════════════════════════════════════════════════════════
    console.log('\n--- CLEANUP: Removing Test Records ---');
    if (supabaseAuditService.isConfigured) {
      await fetch(`${supabaseAuditService.url}/rest/v1/requested_maintenance_windows?request_id=eq.${encodeURIComponent(testRequestId)}`, {
        method: 'DELETE',
        headers: {
          apikey: supabaseAuditService.key,
          Authorization: `Bearer ${supabaseAuditService.key}`
        }
      });
      await fetch(`${supabaseAuditService.url}/rest/v1/maintenance_defects?external_ref_id=eq.${encodeURIComponent(testDefectId)}`, {
        method: 'DELETE',
        headers: {
          apikey: supabaseAuditService.key,
          Authorization: `Bearer ${supabaseAuditService.key}`
        }
      });
      console.log('Cleaned up test record from Supabase Cloud: ✓');
    }
  }
}

runEndToEndVerification();
