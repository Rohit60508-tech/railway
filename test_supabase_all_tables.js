const { supabaseAuditService } = require('./backend/services/supabase-client');

async function main() {
  console.log('--- TESTING SUPABASE ALL TABLES PERSISTENCE & SEEDING ---');
  console.log('Supabase Status:', supabaseAuditService.getStatus());

  console.log('\nAttempting to seed initial tables into Supabase Cloud...');
  const seedResult = await supabaseAuditService.seedInitialTablesData();
  console.log('Seed Result:', JSON.stringify(seedResult, null, 2));

  console.log('\nQuerying track_sections table...');
  const trackSections = await supabaseAuditService.queryTable('track_sections');
  console.log('Track Sections Query Result:', trackSections);

  console.log('\nQuerying maintenance_defects table...');
  const defects = await supabaseAuditService.queryTable('maintenance_defects');
  console.log('Defects Query Result:', defects);

  console.log('\nSaving test action audit record...');
  const auditRes = await supabaseAuditService.saveActionAuditRecord({
    entryName: 'SUPABASE_FULL_INTEGRATION_TEST',
    eventType: 'DATABASE_MIGRATION',
    staffId: 'IR-SEC-101',
    userName: 'Supabase Integration Engineer',
    userRole: 'ADMIN_OFFICER',
    userDivision: 'Northern Railway — Headquarters',
    section: 'NDLS-CNB-UP',
    targetEntityId: 'TABLES_SEEDED_V1',
    reason: 'Verified active full Supabase PostgreSQL database storage for all railway system models.',
    disruptionScore: 0.0,
    delayMinutes: 0,
    actionPayload: { tables_configured: ['track_sections', 'maintenance_defects', 'block_schedules', 'corridor_windows', 'immutable_action_audit_log'] }
  });
  console.log('Audit Save Result:', auditRes);
}

main();
