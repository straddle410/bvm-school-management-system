import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import bcrypt from 'npm:bcryptjs@2.4.3';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);

    // Check if authenticated user is admin
    if (!user || (user.role !== 'admin' && user.role !== 'principal')) {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { username, password, name } = await req.json();

    if (!username || !password || !name) {
      return Response.json({ error: 'Missing username, password, or name' }, { status: 400 });
    }

    // Hash password using bcrypt
    const password_hash = await bcrypt.hash(password, 10);

    // Generate staff_code (A001, A002, etc. for admins)
    const counterKey = 'staff_code_A';
    let counter = await base44.asServiceRole.entities.Counter.filter({ key: counterKey }).then(r => r[0]);
    
    if (!counter) {
      counter = await base44.asServiceRole.entities.Counter.create({
        key: counterKey,
        current_value: 0
      });
    }

    const nextValue = counter.current_value + 1;
    const staffCode = `A${String(nextValue).padStart(3, '0')}`;

    // Update counter
    await base44.asServiceRole.entities.Counter.update(counter.id, {
      current_value: nextValue
    });

    // Create staff account
    const staffAccount = await base44.asServiceRole.entities.StaffAccount.create({
      name: name,
      username: username,
      password_hash: password_hash,
      role: 'admin',
      staff_code: staffCode,
      is_active: true,
      force_password_change: true,
      designation: 'Administrator',
    });

    return Response.json({
      success: true,
      message: 'Admin staff account created successfully',
      staff_id: staffAccount.id,
      username: username,
      name: name,
    });
  } catch (error) {
    console.error('Error creating staff account:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});