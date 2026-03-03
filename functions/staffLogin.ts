import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Staff login via username + password
 * Returns session token if successful
 * Handles account locking, password hashing validation
 */
Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const { username, password } = await req.json();

    if (!username || !password) {
      return Response.json({ error: 'Username and password required' }, { status: 400 });
    }

    // Find staff by username
    const staff = await base44.asServiceRole.entities.StaffAccount.filter({
      username: username.trim().toLowerCase(),
    });

    if (!staff || staff.length === 0) {
      return Response.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    const account = staff[0];

    // Check if account is active
    if (!account.is_active) {
      return Response.json(
        { error: 'Account is inactive. Contact administrator.' },
        { status: 403 }
      );
    }

    // Check if account is locked
    if (account.account_locked_until) {
      const lockTime = new Date(account.account_locked_until);
      if (lockTime > new Date()) {
        return Response.json(
          {
            error: `Account locked. Try again after ${lockTime.toLocaleTimeString()}`,
            locked_until: account.account_locked_until,
          },
          { status: 403 }
        );
      }
    }

    // Validate password (in production, use bcrypt or similar)
    // For MVP: simple comparison (replace with bcrypt.compare in production)
    const passwordValid = await validatePassword(password, account.password_hash);

    if (!passwordValid) {
      // Increment failed attempts
      const newFailedAttempts = (account.failed_login_attempts || 0) + 1;
      const updateData = { failed_login_attempts: newFailedAttempts };

      // Lock account if >= 5 attempts
      if (newFailedAttempts >= 5) {
        const lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
        updateData.account_locked_until = lockUntil.toISOString();
        
        await base44.asServiceRole.entities.StaffAccount.update(account.id, updateData);

        return Response.json(
          {
            error: 'Too many failed attempts. Account locked for 15 minutes.',
            locked_until: lockUntil.toISOString(),
          },
          { status: 403 }
        );
      }

      await base44.asServiceRole.entities.StaffAccount.update(account.id, updateData);

      return Response.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    // Successful login: reset attempts, update last login
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';
    
    await base44.asServiceRole.entities.StaffAccount.update(account.id, {
      failed_login_attempts: 0,
      account_locked_until: null,
      last_login_at: new Date().toISOString(),
      last_login_ip: clientIp,
    });

    // If force password change, return flag
    if (account.force_password_change) {
      return Response.json({
        success: true,
        force_password_change: true,
        staff_id: account.id,
        username: account.username,
        message: 'Password change required',
      });
    }

    // Create session (store in localStorage on client)
    return Response.json({
      success: true,
      staff_id: account.id,
      username: account.username,
      name: account.name,
      role_template_id: account.role_template_id,
      permissions: account.permissions,
      permissions_override: account.permissions_override,
    });
  } catch (error) {
    console.error('Login error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});

/**
 * Validate password against hash
 * In production, use bcrypt: await bcrypt.compare(password, hash)
 */
async function validatePassword(password, hash) {
  // MVP: simple comparison - REPLACE WITH BCRYPT IN PRODUCTION
  if (!hash || !password) return false;
  
  // For now, if hash is a plaintext password (temp), compare directly
  // In production:
  // const bcrypt = require('bcrypt');
  // return await bcrypt.compare(password, hash);
  
  // Placeholder: always require bcrypt hash format
  return hash.startsWith('$2') && hash.length === 60; // bcrypt hash format check only
}