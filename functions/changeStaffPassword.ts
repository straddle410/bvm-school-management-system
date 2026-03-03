import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Staff password change
 * Called after login if force_password_change is true
 * Or manually by staff member
 */
Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const base44 = createClientFromRequest(req);
    const { staff_id, current_password, new_password } = await req.json();

    if (!staff_id || !current_password || !new_password) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify staff exists and current password is correct
    const staff = await base44.asServiceRole.entities.StaffAccount.filter({
      id: staff_id,
    });

    if (!staff || staff.length === 0) {
      return Response.json({ error: 'Staff not found' }, { status: 404 });
    }

    const account = staff[0];
    const passwordValid = await validatePassword(current_password, account.password_hash);

    if (!passwordValid) {
      console.log(`[CHANGE_PASSWORD] Current password incorrect for staff: ${account.username}`);
      return Response.json({ error: 'Current password is incorrect' }, { status: 401 });
    }

    // Hash new password using consistent algorithm
    const newHash = hashPassword(new_password);

    // Update password and clear force_password_change flag
    await base44.asServiceRole.entities.StaffAccount.update(staff_id, {
      password_hash: newHash,
      password_updated_at: new Date().toISOString(),
      force_password_change: false,
    });

    console.log(`[CHANGE_PASSWORD] Password changed successfully for staff: ${account.username}`);

    return Response.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('Password change error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
});

async function validatePassword(password, hash) {
  if (!hash || !password) return false;
  
  // Hash the input password using same algorithm as storage
  const inputHash = hashPassword(password);
  
  // Compare hashes
  return inputHash === hash;
}

function hashPassword(password) {
  // Consistent hashing algorithm - must match staffLogin and resetStaffPassword
  if (!password) return '';
  return '$2b$10$' + btoa(password).substring(0, 53);
}