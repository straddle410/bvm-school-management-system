import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Admin resets staff password
 * Sets temporary password and force_password_change flag
 */
Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const admin = await base44.auth.me();

    // Verify admin/principal
    if (!admin || (admin.role?.toLowerCase() !== 'admin' && admin.role?.toLowerCase() !== 'principal')) {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { staff_id, temp_password } = await req.json();

    if (!staff_id || !temp_password) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Hash temporary password
    const hash = hashPassword(temp_password);

    // Update staff account
    await base44.asServiceRole.entities.StaffAccount.update(staff_id, {
      password_hash: hash,
      password_updated_at: new Date().toISOString(),
      force_password_change: true,
      failed_login_attempts: 0,
      account_locked_until: null,
    });

    // Log audit entry
    try {
      await base44.asServiceRole.entities.AuditLog.create({
        action: 'password_reset',
        module: 'Staff',
        performed_by: admin.email,
        details: `Password reset for staff ID: ${staff_id}`,
        timestamp: new Date().toISOString(),
      });
    } catch {}

    return Response.json({
      success: true,
      message: 'Password reset successfully',
      temp_password: temp_password,
    });
  } catch (error) {
    console.error('Reset error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});

function hashPassword(password) {
  // Placeholder - replace with bcrypt.hash in production
  return '$2b$10$' + btoa(password).substring(0, 53);
}