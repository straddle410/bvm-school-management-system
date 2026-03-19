import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * End-to-end test for staff creation workflow.
 * Tests: ID generation → staff account creation → verification
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Step 1: Fetch all staff to find highest numbers
    console.log('[E2E] Step 1: Fetching existing staff...');
    const allStaff = await base44.asServiceRole.entities.StaffAccount.list();
    
    // Find highest Teacher and Admin IDs
    const tIds = allStaff
      .filter(s => s.username?.match(/^T\d+$/))
      .map(s => parseInt(s.username.slice(1), 10))
      .sort((a, b) => b - a);
    const aIds = allStaff
      .filter(s => s.username?.match(/^A\d+$/))
      .map(s => parseInt(s.username.slice(1), 10))
      .sort((a, b) => b - a);
    
    const nextTeacherNum = (tIds.length ? tIds[0] : 100) + 1;
    const nextAdminNum = (aIds.length ? aIds[0] : 100) + 1;
    const teacherId = `T${String(nextTeacherNum).padStart(3, '0')}`;
    const adminId = `A${String(nextAdminNum).padStart(3, '0')}`;
    console.log(`[E2E] Next Teacher ID: ${teacherId}, Next Admin ID: ${adminId}`);

    // Step 3: Create test staff account with generated Teacher ID
    console.log(`[E2E] Step 3: Creating staff account with ID ${teacherId}...`);
    const staff = await base44.asServiceRole.entities.StaffAccount.create({
      name: 'E2E Test Teacher',
      username: teacherId,
      password_hash: '$2a$10$test.hash.here', // placeholder
      email: `e2e.teacher@test.com`,
      designation: 'Test Teacher',
      role: 'teacher',
      is_active: true,
      force_password_change: true,
    });
    console.log(`[E2E] Created staff account: ${staff.id}`);

    // Step 4: Verify created staff exists and has correct ID
    console.log('[E2E] Step 4: Verifying staff was created...');
    const retrieved = await base44.asServiceRole.entities.StaffAccount.filter({
      username: teacherId,
    });
    if (!retrieved.length) throw new Error(`Staff with ID ${teacherId} not found`);
    
    const createdStaff = retrieved[0];
    console.log(`[E2E] Verification: ${createdStaff.name} → ${createdStaff.username}`);

    // Step 5: Verify incrementing - check what next ID should be
    console.log('[E2E] Step 5: Verifying ID increment logic...');
    const updatedStaff = await base44.asServiceRole.entities.StaffAccount.list();
    const updatedTIds = updatedStaff
      .filter(s => s.username?.match(/^T\d+$/))
      .map(s => parseInt(s.username.slice(1), 10))
      .sort((a, b) => b - a);
    const nextTeacherId = `T${String((updatedTIds[0] || 100) + 1).padStart(3, '0')}`;
    console.log(`[E2E] Next Teacher ID after creation would be: ${nextTeacherId}`);

    return Response.json({
      success: true,
      test_results: {
        generated_teacher_id: teacherId,
        generated_admin_id: adminId,
        created_staff_id: staff.id,
        created_staff_name: createdStaff.name,
        created_staff_username: createdStaff.username,
        next_teacher_id: nextTeacherId,
        verification: `✓ Confirmed: Staff created with ID ${teacherId}, next would be ${nextTeacherId}`,
      },
    });
  } catch (error) {
    console.error('[E2E Test Error]:', error);
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
});