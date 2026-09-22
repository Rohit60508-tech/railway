const fs = require('fs');

async function testRender() {
  const res = await fetch('http://localhost:5000/api/v1/requested-windows');
  const data = await res.json();
  console.log(`API returned ${data.length} items from /api/v1/requested-windows:`);
  data.forEach((item, i) => {
    console.log(`  ${i+1}. [${item.request_id}] Status: "${item.status}" Dept: "${item.department}" Alt: "${item.applied_alternative}"`);
  });

  // Test mapping logic
  function normalizeDeptCode(deptStr) {
    if (!deptStr) return 'CIVIL';
    const d = deptStr.toUpperCase();
    if (d.includes('CIVIL') || d.includes('P-WAY') || d.includes('TMS')) return 'CIVIL';
    if (d.includes('TRD') || d.includes('ELEC') || d.includes('ELECTRICAL') || d.includes('OHE')) return 'TRD';
    if (d.includes('SIG') || d.includes('TELECOM') || d.includes('SMMS') || d.includes('SIGNAL')) return 'SIG';
    if (d.includes('MECH') || d.includes('ROLLING')) return 'MECH';
    return 'CIVIL';
  }

  const approvedFromApi = data.map(item => {
    const deptCode = normalizeDeptCode(item.department);
    const st = (item.status || 'PENDING_REVIEW').toUpperCase();
    const isSanctioned = st === 'APPROVED' || st === 'SANCTIONED' || st.includes('SANCTION') || st.includes('APPROV') || st === 'ALTERNATIVE_APPLIED' || st === 'FORCE_SANCTIONED' || st === 'ACCEPTED' || st === 'COMPLETED';
    const isAccepted = st === 'ACCEPTED' || !!item.accepted_at;
    const isCompleted = st === 'COMPLETED' || st === 'RECTIFIED' || !!item.completed_at;
    return {
      id: item.request_id || item.id,
      status: item.status,
      dept: deptCode,
      isSanctioned,
      isAccepted,
      isCompleted,
      slot: item.applied_alternative || item.requested_window
    };
  });

  const pendingList = approvedFromApi.filter(w => w.isSanctioned && !w.isAccepted && !w.isCompleted);
  const acceptedList = approvedFromApi.filter(w => w.isAccepted && !w.isCompleted);
  const completedList = approvedFromApi.filter(w => w.isCompleted);

  console.log(`\nWork Orders breakdown:`);
  console.log(`  Pending Sanctioned (Section 1): ${pendingList.length} items`);
  pendingList.forEach(p => console.log(`    - ID: ${p.id}, Slot: ${p.slot}, Dept: ${p.dept}`));
  console.log(`  Accepted & Locked (Section 2): ${acceptedList.length} items`);
  console.log(`  Completed & Closed (Section 3): ${completedList.length} items`);
}

testRender().catch(console.error);
