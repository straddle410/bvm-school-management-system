import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Admin-only: deletes a StaffAuthLink for a given base44_user_id,
 * allowing the affected staff member to re-bind on next login.
 *
 * Body: { base44_user_id: string }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Must be an authenticated admin
    const adminUser = await base44.auth.me().catch(() => null);
    if (!adminUser?.id) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }
    if (adminUser.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { base44_user_id } = await req.json();
    if (!base44_user_id) {
      return Response.json({ error: 'base44_user_id is required' }, { status: 400 });
    }

    // Find the link to delete
    const links = await base44.asServiceRole.entities.StaffAuthLink.filter({ base44_user_id });
    if (!links || links.length === 0) {
      return Response.json({ error: 'No StaffAuthLink found for this base44_user_id' }, { status: 404 });
    }

    const link = links[0];
    await base44.asServiceRole.entities.StaffAuthLink.delete(link.id);

    // Log the action
    console.log(
      `[adminResetStaffAuthLink] Admin=${adminUser.email || adminUser.id} ` +
      `reset link for base44_user_id=${base44_user_id} ` +
      `(was staff_id=${link.staff_id}) at ${new Date().toISOString()}`
    );

    return Response.json({
      success: true,
      message: 'StaffAuthLink deleted. The user may now re-bind on next login.',
      deleted_staff_id: link.staff_id,
      reset_by: adminUser.email || adminUser.id,
      reset_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('adminResetStaffAuthLink error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});