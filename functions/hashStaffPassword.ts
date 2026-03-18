import bcrypt from 'npm:bcryptjs@2.4.3';
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Shared bcrypt hashing endpoint for staff password writes.
 * Used by staff creation flow in pages/Staff.js.
 * Admin-only.
 */
Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || (user.role !== 'admin' && user.role !== 'principal')) {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { password } = await req.json();
    if (!password) {
      return Response.json({ error: 'Password is required' }, { status: 400 });
    }

    // Enforce unified password policy
    const policyOk =
      password.length >= 8 &&
      /[A-Z]/.test(password) &&
      /[a-z]/.test(password) &&
      /[0-9]/.test(password) &&
      /[^A-Za-z0-9]/.test(password);

    if (!policyOk) {
      return Response.json({
        success: false,
        error: 'PASSWORD_POLICY_VIOLATION',
        message: 'Password must contain at least 8 characters, 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character.',
      }, { status: 400 });
    }

    // Staff passwords must always be hashed server-side with bcrypt. Never hash on frontend.
    const hash = await bcrypt.hash(password, 10);
    return Response.json({ hash });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});