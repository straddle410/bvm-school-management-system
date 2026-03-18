import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Admin unlocks locked staff account
 */
Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const { staff_id, staff_session_token } = await req.json();

    if (!staff_id) {
      return Response.json({ error: 'Staff ID required' }, { status: 400 });
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

    // Unlock account
    await base44.asServiceRole.entities.StaffAccount.update(staff_id, {
      account_locked_until: null,
      failed_login_attempts: 0,
    });

    // Log audit
    try {
      await base44.asServiceRole.entities.AuditLog.create({
        action: 'account_unlocked',
        module: 'Staff',
        performed_by: admin.email,
        details: `Account unlocked for staff ID: ${staff_id}`,
        timestamp: new Date().toISOString(),
      });
    } catch {}

    return Response.json({ success: true, message: 'Account unlocked' });
  } catch (error) {
    console.error('Unlock error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});