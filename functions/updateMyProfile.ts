import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const ALLOWED_FIELDS = [
  'mobile', 'qualification', 'address_line1', 'address_line2',
  'city', 'state', 'pincode', 'emergency_contact_name',
  'emergency_contact_phone', 'photo_url'
];

/**
 * Updates the profile of the currently logged-in staff member.
 * Identity is derived SOLELY from StaffAuthLink (base44_user_id -> staff_id).
 * All client-supplied identity fields are ignored.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Step 1: Platform auth — signed JWT, cannot be spoofed
    const authUser = await base44.auth.me().catch(() => null);
    if (!authUser?.id) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Step 2: Resolve staff_id via StaffAuthLink
    const links = await base44.asServiceRole.entities.StaffAuthLink.filter({
      base44_user_id: authUser.id,
    });

    if (!links || links.length === 0) {
      return Response.json(
        { error: 'Staff session not linked. Please log in again.', code: 'LINK_MISSING' },
        { status: 403 }
      );
    }

    const staffId = links[0].staff_id;

    // Step 3: Verify account exists and is active
    const accounts = await base44.asServiceRole.entities.StaffAccount.filter({ id: staffId });
    if (!accounts || accounts.length === 0) {
      return Response.json({ error: 'Staff account not found' }, { status: 404 });
    }

    const account = accounts[0];
    if (!account.is_active) {
      return Response.json({ error: 'Account inactive' }, { status: 403 });
    }

    // Step 4: Parse payload — only whitelist, ignore everything else (incl. any id/role fields)
    const rawPayload = await req.json();
    const updateData = {};
    for (const field of ALLOWED_FIELDS) {
      if (field in rawPayload) updateData[field] = rawPayload[field];
    }

    if (Object.keys(updateData).length === 0) {
      return Response.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Step 5: Update ONLY the server-resolved account
    await base44.asServiceRole.entities.StaffAccount.update(account.id, updateData);

    return Response.json({
      success: true,
      message: 'Profile updated',
      identity_source: 'StaffAuthLink',
    });
  } catch (error) {
    console.error('updateMyProfile error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});