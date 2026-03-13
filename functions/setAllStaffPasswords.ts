import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import bcrypt from 'npm:bcryptjs@2.4.3';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const defaultPassword = 'Bvm@1234';
    const staffCodes = ['A101', 'A102', 'T101', 'T102'];

    const results = [];

    // Hash password once
    const password_hash = await bcrypt.hash(defaultPassword, 10);

    for (const staffCode of staffCodes) {
      console.log(`Setting password for: ${staffCode}`);
      
      try {
        const staffAccounts = await base44.asServiceRole.entities.StaffAccount.filter({
          staff_code: staffCode
        });

        if (!staffAccounts || staffAccounts.length === 0) {
          results.push({
            staff_code: staffCode,
            status: 'not_found',
            message: 'Staff not found'
          });
          console.log(`✗ Staff not found: ${staffCode}`);
          continue;
        }

        const staff = staffAccounts[0];

        // Update password hash
        await base44.asServiceRole.entities.StaffAccount.update(staff.id, {
          password_hash,
          force_password_change: false
        });

        results.push({
          staff_code: staffCode,
          name: staff.name,
          email: staff.email,
          status: 'success',
          message: 'Password set to Bvm@1234'
        });

        console.log(`✓ Password updated for ${staffCode} (${staff.name})`);
      } catch (error) {
        results.push({
          staff_code: staffCode,
          status: 'error',
          error: error.message
        });
        console.error(`✗ Error for ${staffCode}:`, error.message);
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;

    return Response.json({
      success: true,
      message: `Updated ${successCount} of ${staffCodes.length} accounts`,
      default_password: defaultPassword,
      results
    });

  } catch (error) {
    console.error('Error setting staff passwords:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});