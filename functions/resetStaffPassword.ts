import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import bcrypt from 'npm:bcryptjs@2.4.3';

/**
 * Admin resets staff password
 * Sets temporary password (as bcrypt) and force_password_change flag
 */
Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const { staff_id, temp_password, staff_session_token } = await req.json();

    if (!staff_id || !temp_password) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify admin via staff token
    let adminRole = null;
    if (staff_session_token) {
      try {
        const tokenParts = staff_session_token.split('.');
        if (tokenParts.length === 3) {
          const payloadB64 = tokenParts[0] + '.' + tokenParts[1];
          const pad = payloadB64.length % 4 === 0 ? '' : '='.repeat(4 - payloadB64.length % 4);
          const decoded = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/') + pad));
          const staffAccount = await base44.asServiceRole.entities.StaffAccount.filter({ id: decoded.staff_id });
          if (staffAccount && staffAccount.length > 0) {
            adminRole = (staffAccount[0].role || '').toLowerCase();
          }
        }
      } catch {}
    }

    if (!adminRole || (adminRole !== 'admin' && adminRole !== 'principal')) {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    if (!staff_id || !temp_password) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify staff exists
    const staff = await base44.asServiceRole.entities.StaffAccount.filter({ id: staff_id });
    if (!staff || staff.length === 0) {
      return Response.json({ error: 'Staff not found' }, { status: 404 });
    }

    console.log(`[RESET_PASSWORD] Resetting password for staff: ${staff[0].username}`);

    // Hash temporary password using bcrypt
    const hash = await bcrypt.hash(temp_password, 10);

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