import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const defaultPassword = 'Bvm@1234';
    const adminEmail = 'straddle410@gmail.com';

    // Update A101's StaffAccount to ensure email is set correctly
    const staffAccounts = await base44.asServiceRole.entities.StaffAccount.filter({ staff_code: 'A101' });
    
    if (staffAccounts.length > 0) {
      const a101 = staffAccounts[0];
      await base44.asServiceRole.entities.StaffAccount.update(a101.id, {
        email: adminEmail
      });
      console.log(`✓ Updated A101 StaffAccount email to ${adminEmail}`);
    }

    // Get the Base44 user
    const allUsers = await base44.asServiceRole.entities.User.list();
    const adminUser = allUsers.find(u => u.email === adminEmail);
    
    if (!adminUser) {
      return Response.json({ error: 'Admin user not found' }, { status: 404 });
    }

    // Update password
    await base44.asServiceRole.entities.User.update(adminUser.id, {
      password: defaultPassword
    });

    console.log(`✓ Password set for ${adminEmail}`);

    return Response.json({
      success: true,
      email: adminEmail,
      staff_code: 'A101',
      password: defaultPassword,
      message: 'A101 (straddle410@gmail.com) password set to Bvm@1234'
    });

  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});