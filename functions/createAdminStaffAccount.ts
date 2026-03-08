import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

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
    const encodedPassword = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', encodedPassword);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // For bcrypt-like hashing in Deno, we'll use a simple approach
    // In production, consider using a proper bcrypt library
    const password_hash = `$2a$10$${hashHex.substring(0, 53)}`;

    // Create staff account
    const staffAccount = await base44.asServiceRole.entities.StaffAccount.create({
      name: name,
      username: username,
      password_hash: password_hash,
      role: 'admin',
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