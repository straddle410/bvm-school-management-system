import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import bcrypt from 'npm:bcryptjs@2.4.3';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Verify admin access
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Only admins can create staff accounts' }, { status: 403 });
    }

    const { username, password, name } = await req.json();

    if (!username || !password) {
      return Response.json({ error: 'Username and password required' }, { status: 400 });
    }

    // Hash password with bcrypt
    const passwordHash = await bcrypt.hash(password, 10);

    // Create staff account
    const staff = await base44.asServiceRole.entities.StaffAccount.create({
      username: username.trim(),
      name: name || 'Admin Staff',
      password_hash: passwordHash,
      role: 'admin',
      designation: 'Administrator',
      is_active: true,
      force_password_change: false,
      failed_login_attempts: 0
    });

    return Response.json({
      success: true,
      staff_id: staff.id,
      username: staff.username,
      message: `Admin account "${username}" created successfully`
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message || 'Failed to create account' }, { status: 500 });
  }
});