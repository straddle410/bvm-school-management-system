import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);

    if (!user || (user.role !== 'admin' && user.role !== 'principal')) {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Fetch all staff accounts
    const allStaff = await base44.asServiceRole.entities.StaffAccount.list();
    console.log(`Total staff found: ${allStaff.length}`);

    const updates = [];
    const toDelete = [];
    const keepIds = [];

    // 1. Find and update admin staff
    const adminStaff = allStaff.find(s => s.role === 'admin');
    if (adminStaff) {
      await base44.asServiceRole.entities.StaffAccount.update(adminStaff.id, {
        staff_code: 'A101',
        username: 'A101'
      });
      keepIds.push(adminStaff.id);
      updates.push({
        name: adminStaff.name,
        role: 'admin',
        old_username: adminStaff.username,
        new_username: 'A101',
        old_staff_code: adminStaff.staff_code,
        new_staff_code: 'A101'
      });
      console.log(`✓ Updated admin: ${adminStaff.name}`);
    } else {
      console.log('✗ Admin staff not found');
    }

    // 2. Find and update Revathi (accountant)
    const revathi = allStaff.find(s => 
      s.name?.toLowerCase().includes('revathi') && s.role === 'accountant'
    );
    if (revathi) {
      await base44.asServiceRole.entities.StaffAccount.update(revathi.id, {
        staff_code: 'A102',
        username: 'A102'
      });
      keepIds.push(revathi.id);
      updates.push({
        name: revathi.name,
        role: 'accountant',
        old_username: revathi.username,
        new_username: 'A102',
        old_staff_code: revathi.staff_code,
        new_staff_code: 'A102'
      });
      console.log(`✓ Updated Revathi: ${revathi.name}`);
    } else {
      console.log('✗ Revathi (accountant) not found');
    }

    // 3. Find and update Lahari (teacher)
    const lahari = allStaff.find(s => 
      s.name?.toLowerCase().includes('lahari') && s.role === 'teacher'
    );
    if (lahari) {
      await base44.asServiceRole.entities.StaffAccount.update(lahari.id, {
        staff_code: 'T101',
        username: 'T101'
      });
      keepIds.push(lahari.id);
      updates.push({
        name: lahari.name,
        role: 'teacher',
        old_username: lahari.username,
        new_username: 'T101',
        old_staff_code: lahari.staff_code,
        new_staff_code: 'T101'
      });
      console.log(`✓ Updated Lahari: ${lahari.name}`);
    } else {
      console.log('✗ Lahari (teacher) not found');
    }

    // 4. Find and update Mounica (exam_staff)
    const mounica = allStaff.find(s => 
      s.name?.toLowerCase().includes('mounica') && s.role === 'exam_staff'
    );
    if (mounica) {
      await base44.asServiceRole.entities.StaffAccount.update(mounica.id, {
        staff_code: 'T102',
        username: 'T102'
      });
      keepIds.push(mounica.id);
      updates.push({
        name: mounica.name,
        role: 'exam_staff',
        old_username: mounica.username,
        new_username: 'T102',
        old_staff_code: mounica.staff_code,
        new_staff_code: 'T102'
      });
      console.log(`✓ Updated Mounica: ${mounica.name}`);
    } else {
      console.log('✗ Mounica (exam_staff) not found');
    }

    // 5. Delete all other staff records
    for (const staff of allStaff) {
      if (!keepIds.includes(staff.id)) {
        await base44.asServiceRole.entities.StaffAccount.delete(staff.id);
        toDelete.push({
          id: staff.id,
          name: staff.name,
          username: staff.username,
          role: staff.role,
          staff_code: staff.staff_code
        });
        console.log(`✗ Deleted: ${staff.name} (${staff.username})`);
      }
    }

    return Response.json({
      success: true,
      message: `Updated ${updates.length} staff records, deleted ${toDelete.length} staff records`,
      updates,
      deleted: toDelete,
      kept_staff_count: keepIds.length,
      total_staff_before: allStaff.length
    });

  } catch (error) {
    console.error('Error updating staff records:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});