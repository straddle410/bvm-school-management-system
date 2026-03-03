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
    const admin = await base44.auth.me();

    // Verify admin/principal
    if (!admin || (admin.role?.toLowerCase() !== 'admin' && admin.role?.toLowerCase() !== 'principal')) {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { staff_id } = await req.json();

    if (!staff_id) {
      return Response.json({ error: 'Staff ID required' }, { status: 400 });
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