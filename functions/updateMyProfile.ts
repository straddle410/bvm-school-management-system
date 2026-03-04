import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const ALLOWED_FIELDS = ['mobile', 'qualification', 'address_line1', 'address_line2', 'city', 'state', 'pincode', 'emergency_contact_name', 'emergency_contact_phone', 'photo_url'];
const BLOCKED_FIELDS = ['role', 'email', 'username', 'password_hash', 'joining_date', 'staff_code', 'permissions', 'permissions_override', 'salary', 'classes', 'subjects', 'sections', 'staff_id'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['admin', 'principal', 'teacher'].includes((user.role || '').toLowerCase())) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const payload = await req.json();

    // Verify no blocked fields
    for (const field of BLOCKED_FIELDS) {
      if (field in payload) {
        return Response.json(
          { error: `Field '${field}' cannot be updated` },
          { status: 403 }
        );
      }
    }

    // Filter payload to only allowed fields
    const updateData = {};
    for (const field of ALLOWED_FIELDS) {
      if (field in payload) {
        updateData[field] = payload[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return Response.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Find staff account by email
    const accounts = await base44.asServiceRole.entities.StaffAccount.filter({ email: user.email });
    if (accounts.length === 0) {
      return Response.json({ error: 'Staff account not found' }, { status: 404 });
    }

    const staffId = accounts[0].id;

    // Update only allowed fields
    await base44.asServiceRole.entities.StaffAccount.update(staffId, updateData);

    return Response.json({ success: true, message: 'Profile updated' });
  } catch (error) {
    console.error('Error in updateMyProfile:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});