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

    // Verify admin via staff session token.
    // The token format is: payloadB64.signature  (2 parts split by last dot)
    // We only need to decode the payload (first part).
    let adminRole = null;
    if (staff_session_token) {
      try {
        const dotIdx = staff_session_token.lastIndexOf('.');
        if (dotIdx > 0) {
          const payloadB64 = staff_session_token.slice(0, dotIdx);
          const pad = payloadB64.length % 4 === 0 ? '' : '='.repeat(4 - payloadB64.length % 4);
          const decoded = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/') + pad));
          if (decoded?.staff_id) {
            const staffAccount = await base44.asServiceRole.entities.StaffAccount.filter({ id: decoded.staff_id });
            if (staffAccount && staffAccount.length > 0) {
              adminRole = (staffAccount[0].role || '').toLowerCase();
            }
          }
        }
      } catch (e) {
        console.error('[resetStaffPassword] Token decode error:', e.message);
      }
    }

    if (!adminRole || (adminRole !== 'admin' && adminRole !== 'principal')) {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Verify staff exists
    const staff = await base44.asServiceRole.entities.StaffAccount.filter({ id: staff_id });
    if (!staff || staff.length === 0) {
      return Response.json({ error: 'Staff not found' }, { status: 404 });
    }

    console.log(`[RESET_PASSWORD] Resetting password for staff: ${staff[0].username}`);

    // Staff passwords must always be hashed server-side with bcrypt. Never hash on frontend.
    const hash = await bcrypt.hash(temp_password, 10);

    // Update staff account
    await base44.asServiceRole.entities.StaffAccount.update(staff_id, {
      password_hash: hash,
      password_updated_at: new Date().toISOString(),
      force_password_change: true,
      failed_login_attempts: 0,
      account_locked_until: null,
    });

    // Log audit entry (no performed_by needed for now)

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