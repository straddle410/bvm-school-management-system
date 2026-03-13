import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import bcrypt from 'npm:bcryptjs@2.4.3';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { staff_id, temp_password } = await req.json();

    if (!staff_id || !temp_password) {
      return Response.json(
        { success: false, error: 'Staff ID and password are required' },
        { status: 400 }
      );
    }

    if (temp_password.length < 6) {
      return Response.json(
        { success: false, error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Find staff by ID
    const staffRecords = await base44.asServiceRole.entities.StaffAccount.filter({
      id: staff_id
    });

    if (!staffRecords || staffRecords.length === 0) {
      return Response.json(
        { success: false, error: 'Staff not found' },
        { status: 404 }
      );
    }

    const staff = staffRecords[0];
    const password_hash = await bcrypt.hash(temp_password, 10);

    // Reset password and force change on next login
    await base44.asServiceRole.entities.StaffAccount.update(staff.id, {
      password_hash,
      force_password_change: true,
      password_updated_at: new Date().toISOString()
    });

    return Response.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
});