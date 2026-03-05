import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const ALLOWED_FIELDS = [
  'mobile', 'qualification', 'address_line1', 'address_line2',
  'city', 'state', 'pincode', 'emergency_contact_name',
  'emergency_contact_phone', 'photo_url'
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // ── Server-side identity resolution ─────────────────────────────────────
    // Step 1: Authenticate via base44 platform auth (JWT in Authorization header).
    //         This is signed server-side and cannot be spoofed by the client.
    const authUser = await base44.auth.me().catch(() => null);

    let account = null;
    let identitySource = '';

    if (authUser?.email) {
      // Step 2a: Look up StaffAccount by platform email (most reliable path).
      const rows = await base44.asServiceRole.entities.StaffAccount.filter({
        email: authUser.email.trim().toLowerCase()
      });
      if (rows && rows.length > 0) {
        account = rows[0];
        identitySource = 'base44_auth_email';
      }
    }

    // Step 2b: Fallback — if platform auth returned no email (custom staff login flow),
    //          check the x-staff-id request header that the frontend SDK sets when
    //          base44.functions.invoke is called while a staff_session is active.
    //          NOTE: This is a last resort; the email path is preferred.
    if (!account) {
      const staffIdHeader = req.headers.get('x-staff-id');
      if (staffIdHeader) {
        const rows = await base44.asServiceRole.entities.StaffAccount.filter({ id: staffIdHeader });
        if (rows && rows.length > 0) {
          account = rows[0];
          identitySource = 'x-staff-id-header';
        }
      }
    }

    // All _caller_* fields from the request body are IGNORED for identity.
    // They may exist in the payload but will be stripped below.

    if (!account) {
      return Response.json({ error: 'Could not resolve staff identity server-side' }, { status: 401 });
    }

    if (!account.is_active) {
      return Response.json({ error: 'Account inactive' }, { status: 403 });
    }

    // ── Parse and sanitise payload ────────────────────────────────────────────
    const rawPayload = await req.json();

    // Strip any caller identity or privilege-escalation fields — never trust them
    const STRIP_FIELDS = [
      '_caller_staff_id', '_caller_email', '_caller_username',
      'staff_id', 'target_id', 'id', 'role', 'email', 'username',
      'password_hash', 'permissions', 'permissions_override',
      'joining_date', 'staff_code', 'classes', 'subjects', 'sections',
      'is_active', 'role_template_id', 'account_locked_until',
      'failed_login_attempts', 'force_password_change'
    ];

    const updateData = {};
    for (const field of ALLOWED_FIELDS) {
      if (field in rawPayload) updateData[field] = rawPayload[field];
    }

    if (Object.keys(updateData).length === 0) {
      return Response.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // ── Update ONLY the resolved account ────────────────────────────────────
    await base44.asServiceRole.entities.StaffAccount.update(account.id, updateData);

    return Response.json({
      success: true,
      message: 'Profile updated',
      identity_source: identitySource,   // for debugging; harmless to expose
    });
  } catch (error) {
    console.error('updateMyProfile error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});