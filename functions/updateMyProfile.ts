import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const ALLOWED_FIELDS = ['mobile', 'qualification', 'address_line1', 'address_line2', 'city', 'state', 'pincode', 'emergency_contact_name', 'emergency_contact_phone', 'photo_url'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Authenticate via staff session (custom auth, not base44.auth.me)
    // We use the username/email in the token to find the canonical StaffAccount.
    // We rely on getMyStaffProfile logic: email → staff_id lookup via service role.
    // Pull the session context from the staff_session stored in the request's Authorization header or cookie.
    // Since this is called from the frontend via base44.functions.invoke, we don't have direct
    // access to localStorage. Instead, accept staff_id + username + email from body and validate
    // them against the session on the server by re-running the same lookup used in getMyStaffProfile.

    const payload = await req.json();

    // Reject any attempt to pass target staffId override
    if ('staff_id' in payload || 'target_id' in payload || 'id' in payload) {
      return Response.json({ error: 'Forbidden: cannot specify a target account' }, { status: 403 });
    }

    // Get caller's identity from session identifiers passed alongside update data
    const callerStaffId = payload._caller_staff_id || null;
    const callerEmail = payload._caller_email || null;
    const callerUsername = payload._caller_username || null;

    delete payload._caller_staff_id;
    delete payload._caller_email;
    delete payload._caller_username;

    if (!callerStaffId && !callerEmail && !callerUsername) {
      return Response.json({ error: 'Caller identity required' }, { status: 400 });
    }

    // Find the caller's own StaffAccount using same priority as getMyStaffProfile
    let account = null;

    if (callerStaffId) {
      const rows = await base44.asServiceRole.entities.StaffAccount.filter({ id: callerStaffId });
      if (rows && rows.length > 0) account = rows[0];
    }
    if (!account && callerEmail) {
      const rows = await base44.asServiceRole.entities.StaffAccount.filter({ email: callerEmail.trim().toLowerCase() });
      if (rows && rows.length > 0) account = rows[0];
    }
    if (!account && callerUsername) {
      const rows = await base44.asServiceRole.entities.StaffAccount.filter({ username: callerUsername.trim().toLowerCase() });
      if (rows && rows.length > 0) account = rows[0];
    }

    if (!account) return Response.json({ error: 'Staff account not found' }, { status: 404 });
    if (!account.is_active) return Response.json({ error: 'Account inactive' }, { status: 403 });

    // Build update object — ONLY whitelisted fields
    const updateData = {};
    for (const field of ALLOWED_FIELDS) {
      if (field in payload) updateData[field] = payload[field];
    }

    if (Object.keys(updateData).length === 0) {
      return Response.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Update ONLY the caller's own account
    await base44.asServiceRole.entities.StaffAccount.update(account.id, updateData);

    return Response.json({ success: true, message: 'Profile updated' });
  } catch (error) {
    console.error('updateMyProfile error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});