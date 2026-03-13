import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Get all staff accounts with empty or missing email
    const allStaff = await base44.asServiceRole.entities.StaffAccount.list();
    const staffToFix = allStaff.filter(s => !s.email || s.email.trim() === '');

    console.log(`Found ${staffToFix.length} staff accounts with empty email`);

    const results = [];

    for (const staff of staffToFix) {
      const generatedEmail = `${staff.staff_code}@bvmschool.com`;
      
      console.log(`Fixing ${staff.staff_code} (${staff.name}): ${generatedEmail}`);

      try {
        // Update StaffAccount entity with email
        await base44.asServiceRole.entities.StaffAccount.update(staff.id, {
          email: generatedEmail
        });

        // Try to invite user to Base44 (will fail if already exists, which is fine)
        try {
          await base44.asServiceRole.users.inviteUser(generatedEmail, 'user');
          console.log(`  ✓ Invited user: ${generatedEmail}`);
        } catch (inviteError) {
          console.log(`  → User may already exist: ${generatedEmail}`);
        }

        results.push({
          staff_code: staff.staff_code,
          name: staff.name,
          email: generatedEmail,
          status: 'updated'
        });

        console.log(`  ✓ Updated StaffAccount`);
      } catch (error) {
        results.push({
          staff_code: staff.staff_code,
          name: staff.name,
          email: generatedEmail,
          status: 'error',
          error: error.message
        });
        console.error(`  ✗ Error: ${error.message}`);
      }
    }

    return Response.json({
      success: true,
      fixed_count: results.filter(r => r.status === 'updated').length,
      total_processed: results.length,
      results
    });

  } catch (error) {
    console.error('Error fixing staff emails:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});