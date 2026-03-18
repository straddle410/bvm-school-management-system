import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import bcrypt from 'npm:bcryptjs@2.4.3';

Deno.serve(async (req) => {
  try {
    const { username, name, email } = await req.json();

    if (!username || !name || !email) {
      return Response.json({ error: 'Missing required fields: username, name, email' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Only admin can create admin accounts
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Only admins can create admin accounts' }, { status: 403 });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);
    const otpExpiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 mins

    // Create temporary password (will be forced to change)
    const tempPassword = Math.random().toString(36).slice(-8);
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    // Check if username already exists
    const existing = await base44.asServiceRole.entities.StaffAccount.filter({ username });
    if (existing.length > 0) {
      return Response.json({ error: 'Username already exists' }, { status: 400 });
    }

    // Create StaffAccount
    const staffAccount = await base44.asServiceRole.entities.StaffAccount.create({
      username,
      name,
      email,
      password_hash: passwordHash,
      role: 'admin',
      is_active: true,
      force_password_change: true,
      permissions: {
        attendance: true,
        marks: true,
        student_admission_permission: true,
        fees_view_module: true,
        fees_record_payment: true,
        post_notices: true,
        gallery: true,
        quiz: true
      }
    });

    // Send OTP via Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      return Response.json({ error: 'Email service not configured' }, { status: 500 });
    }

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'noreply@school.local',
        to: email,
        subject: 'Admin Account Created - One-Time Password',
        html: `
          <h2>Welcome, ${name}!</h2>
          <p>Your admin account has been created.</p>
          <p><strong>Username:</strong> ${username}</p>
          <p><strong>Temporary Password:</strong> ${tempPassword}</p>
          <p><strong>One-Time Password (OTP):</strong> <h1>${otp}</h1></p>
          <p style="color: red;"><strong>⚠️ This OTP expires in 15 minutes.</strong></p>
          <p>You will be required to change your password on first login.</p>
        `
      })
    });

    return Response.json({
      success: true,
      message: 'Admin account created successfully',
      account: {
        id: staffAccount.id,
        username: staffAccount.username,
        name: staffAccount.name,
        email: staffAccount.email,
        role: staffAccount.role
      },
      credentials: {
        username: username,
        temporary_password: tempPassword,
        otp: otp,
        otp_expires_at: otpExpiresAt
      }
    });
  } catch (error) {
    console.error('Error creating admin account:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});