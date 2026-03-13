import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import bcrypt from 'npm:bcryptjs@2.4.3';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { staff_id, new_password } = await req.json();

    if (!staff_id || !new_password) {
      return Response.json(
        { success: false, error: 'Staff ID and new password are required' },
        { status: 400 }
      );
    }

    if (new_password.length < 6) {
      return Response.json(
        { success: false, error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Hash the new password
    const password_hash = await bcrypt.hash(new_password, 10);

    // Update staff record with new password and clear OTP fields
    await base44.asServiceRole.entities.StaffAccount.update(staff_id, {
      password_hash,
      reset_otp: null,
      reset_otp_expiry: null,
      force_password_change: false,
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