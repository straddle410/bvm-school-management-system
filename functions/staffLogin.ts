import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import bcrypt from 'npm:bcryptjs@2.4.3';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { staff_code, password } = await req.json();

    if (!staff_code || !password) {
      return Response.json(
        { error: 'Staff ID and password are required' },
        { status: 400 }
      );
    }

    // Search for staff by staff_code
    const staffRecords = await base44.asServiceRole.entities.StaffAccount.filter({
      staff_code: staff_code
    });

    if (!staffRecords || staffRecords.length === 0) {
      return Response.json(
        { error: 'Invalid Staff ID' },
        { status: 404 }
      );
    }

    const staff = staffRecords[0];

    // Check account status
    if (staff.status === 'rejected') {
      return Response.json(
        { error: 'Account has been rejected' },
        { status: 403 }
      );
    }

    if (staff.status === 'pending') {
      return Response.json(
        { error: 'Account pending approval' },
        { status: 403 }
      );
    }

    // If status is 'active', empty, or null - allow login

    // Verify password - support both bcrypt hash and plain text (legacy)
    let passwordMatch = false;
    
    if (staff.password_hash) {
      // New bcrypt hash
      passwordMatch = await bcrypt.compare(password, staff.password_hash);
    } else if (staff.password) {
      // Legacy plain text password
      passwordMatch = (password === staff.password);
    }

    if (!passwordMatch) {
      return Response.json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }

    // Return staff details
    return Response.json({
      success: true,
      staff: {
        id: staff.id,
        staff_code: staff.staff_code,
        full_name: staff.name,
        role: staff.role,
        department: staff.designation,
        status: staff.status,
        username: staff.username,
        email: staff.email,
        mobile: staff.mobile,
        force_password_change: staff.force_password_change || false
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Staff login error:', error);
    return Response.json(
      { error: 'Login failed. Please try again.' },
      { status: 500 }
    );
  }
});