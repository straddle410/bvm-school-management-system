import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * End-to-end test for staff creation workflow.
 * Tests: ID generation → staff account creation → verification
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Step 1: Generate next Teacher ID (should be T103 if T102 is highest)
    console.log('[E2E] Step 1: Generating Teacher ID...');
    const genRes = await base44.asServiceRole.functions.invoke('generateStaffId', { 
      action: 'generate', 
      role: 'teacher' 
    });
    if (!genRes.data?.success) throw new Error('ID generation failed');
    const teacherId = genRes.data.staff_id;
    console.log(`[E2E] Generated Teacher ID: ${teacherId}`);
    
    // Step 2: Generate next Admin ID (should be A104 if A103 is highest)
    console.log('[E2E] Step 2: Generating Admin ID...');
    const adminRes = await base44.asServiceRole.functions.invoke('generateStaffId', { 
      action: 'generate', 
      role: 'admin' 
    });
    if (!adminRes.data?.success) throw new Error('Admin ID generation failed');
    const adminId = adminRes.data.staff_id;
    console.log(`[E2E] Generated Admin ID: ${adminId}`);

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

    // Step 5: Generate same role again - should give next number (T104)
    console.log('[E2E] Step 5: Generating another Teacher ID...');
    const nextRes = await base44.asServiceRole.functions.invoke('generateStaffId', { 
      action: 'generate', 
      role: 'teacher' 
    });
    const nextId = nextRes.data.staff_id;
    console.log(`[E2E] Next Teacher ID would be: ${nextId}`);
    
    const expectedNext = teacherId.replace(/\d+$/, (match) => String(parseInt(match) + 1).padStart(3, '0'));
    if (nextId !== expectedNext) {
      throw new Error(`Expected ${expectedNext}, got ${nextId}`);
    }

    return Response.json({
      success: true,
      test_results: {
        generated_teacher_id: teacherId,
        generated_admin_id: adminId,
        created_staff_id: staff.id,
        created_staff_name: createdStaff.name,
        created_staff_username: createdStaff.username,
        next_teacher_id: nextId,
        verification: `✓ Confirmed: Staff created with ID ${teacherId}, next would be ${nextId}`,
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