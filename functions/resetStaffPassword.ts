import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import bcrypt from 'npm:bcryptjs@2.4.3';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    const { staff_id, temp_password, otp } = await req.json();

    // Admin-initiated reset: requires staff_id and temp_password, no OTP
    if (user?.role && (user.role === 'admin' || user.role === 'principal')) {
      if (!staff_id || !temp_password) {
        return Response.json(
          { success: false, error: 'Staff ID and new password are required' },
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

      // Admin reset: set force_password_change to true
      await base44.asServiceRole.entities.StaffAccount.update(staff.id, {
        password_hash,
        reset_otp: null,
        reset_otp_expiry: null,
        force_password_change: true,
        password_updated_at: new Date().toISOString()
      });

      return Response.json({ success: true, message: 'Password reset successfully' });
    }

    // Self-service reset: requires staff_code, otp, and new_password
    const { staff_code, new_password } = await req.json();
    if (!staff_code || !otp || !new_password) {
      return Response.json(
        { success: false, error: 'Staff code, OTP and new password are required' },
        { status: 400 }
      );
    }

    if (new_password.length < 6) {
      return Response.json(
        { success: false, error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Find staff by staff_code
    const staffRecords = await base44.asServiceRole.entities.StaffAccount.filter({
      staff_code: staff_code.trim()
    });

    if (!staffRecords || staffRecords.length === 0) {
      return Response.json(
        { success: false, error: 'Staff not found' },
        { status: 404 }
      );
    }

    const staff = staffRecords[0];

    // Check if OTP exists
    if (!staff.reset_otp || !staff.reset_otp_expiry) {
      return Response.json(
        { success: false, error: 'No OTP found. Please request a new one.' },
        { status: 400 }
      );
    }

    // Check if OTP is expired
    const expiryTime = new Date(staff.reset_otp_expiry);
    if (new Date() > expiryTime) {
      return Response.json(
        { success: false, error: 'OTP has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    // Validate OTP
    if (staff.reset_otp !== otp.trim()) {
      return Response.json(
        { success: false, error: 'Invalid OTP' },
        { status: 400 }
      );
    }

    // Hash the new password
    const password_hash = await bcrypt.hash(new_password, 10);

    // Self-service reset: set force_password_change to false
    await base44.asServiceRole.entities.StaffAccount.update(staff.id, {
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