import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);

    // Admin only
    if (!user || (user.role !== 'admin' && user.role !== 'principal')) {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Fetch all staff accounts without staff_code
    const allStaff = await base44.asServiceRole.entities.StaffAccount.list('-created_date');
    const staffWithoutCode = allStaff.filter(s => !s.staff_code);

    if (staffWithoutCode.length === 0) {
      return Response.json({
        success: true,
        message: 'All staff already have codes',
        processed: 0
      });
    }

    // Get current counters
    let counterA = await base44.asServiceRole.entities.Counter.filter({ key: 'staff_code_A' }).then(r => r[0]);
    let counterT = await base44.asServiceRole.entities.Counter.filter({ key: 'staff_code_T' }).then(r => r[0]);

    if (!counterA) {
      counterA = await base44.asServiceRole.entities.Counter.create({
        key: 'staff_code_A',
        current_value: 0
      });
    }
    if (!counterT) {
      counterT = await base44.asServiceRole.entities.Counter.create({
        key: 'staff_code_T',
        current_value: 0
      });
    }

    // Assign codes
    let updatedCount = 0;
    for (const staff of staffWithoutCode) {
      const isAdmin = staff.role === 'admin' || staff.role === 'principal';
      const counter = isAdmin ? counterA : counterT;
      const prefix = isAdmin ? 'A' : 'T';

      // Increment counter
      const nextValue = counter.current_value + 1;
      const staffCode = `${prefix}${String(nextValue).padStart(3, '0')}`;

      // Update staff record
      await base44.asServiceRole.entities.StaffAccount.update(staff.id, {
        staff_code: staffCode
      });

      // Update counter in memory for next iteration
      if (isAdmin) {
        counterA.current_value = nextValue;
      } else {
        counterT.current_value = nextValue;
      }

      updatedCount++;
    }

    // Persist final counter values
    await base44.asServiceRole.entities.Counter.update(counterA.id, {
      current_value: counterA.current_value
    });
    await base44.asServiceRole.entities.Counter.update(counterT.id, {
      current_value: counterT.current_value
    });

    return Response.json({
      success: true,
      message: `Migrated ${updatedCount} staff records with new codes`,
      processed: updatedCount
    });
  } catch (error) {
    console.error('Error migrating staff codes:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});