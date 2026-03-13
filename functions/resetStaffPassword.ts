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
    
    // Hash the temporary password with bcrypt
    let password_hash;
    try {
      password_hash = await bcrypt.hash(temp_password, 10);
    } catch (hashErr) {
      console.error('Password hashing error:', hashErr);
      return Response.json(
        { success: false, error: 'Failed to process password' },
        { status: 500 }
      );
    }

    // Update staff record: reset password to temp_password hash and set force_password_change = true
    try {
      await base44.asServiceRole.entities.StaffAccount.update(staff.id, {
        password_hash,
        force_password_change: true,
        password_updated_at: new Date().toISOString()
      });
    } catch (updateErr) {
      console.error('Staff update error:', updateErr);
      return Response.json(
        { success: false, error: 'Failed to reset password' },
        { status: 500 }
      );
    }

    return Response.json({ 
      success: true, 
      message: 'Password reset successfully. Staff must change on next login.' 
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
});