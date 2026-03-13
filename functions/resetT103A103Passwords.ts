import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import bcrypt from 'npm:bcryptjs@2.4.3';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Only admin can reset passwords
    if (user?.role !== 'admin') {
      return Response.json(
        { success: false, error: 'Admin access required' },
        { status: 403 }
      );
    }

    const DEFAULT_PASSWORD = 'Bvm@1234';
    const staffCodes = ['T103', 'A103'];
    const results = [];

    for (const staffCode of staffCodes) {
      try {
        // Find staff by staff_code
        const staffRecords = await base44.asServiceRole.entities.StaffAccount.filter({
          staff_code: staffCode
        });

        if (!staffRecords || staffRecords.length === 0) {
          results.push({
            staff_code: staffCode,
            success: false,
            error: 'Staff not found'
          });
          continue;
        }

        const staff = staffRecords[0];
        
        // Hash password with bcrypt (salt rounds: 10)
        const password_hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

        // Update staff record
        await base44.asServiceRole.entities.StaffAccount.update(staff.id, {
          password_hash,
          force_password_change: true,
          password_updated_at: new Date().toISOString()
        });

        results.push({
          staff_code: staffCode,
          name: staff.name,
          success: true,
          message: `Password reset to '${DEFAULT_PASSWORD}' (bcrypt hash with salt rounds 10)`
        });
      } catch (err) {
        console.error(`Error resetting password for ${staffCode}:`, err);
        results.push({
          staff_code: staffCode,
          success: false,
          error: err.message
        });
      }
    }

    return Response.json({
      success: results.every(r => r.success),
      results,
      note: 'Both functions use bcrypt with salt rounds 10. staffLogin uses bcrypt.compare() to verify passwords.'
    });
  } catch (error) {
    console.error('Reset T103/A103 error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
});