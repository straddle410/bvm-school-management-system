import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Generate staff username from name.
 * Format: firstname.lastname (lowercase)
 * If duplicate, append number: firstname.lastname1, firstname.lastname2
 */

Deno.serve(async (req) => {
  try {
    const { name } = await req.json();
    
    if (!name || typeof name !== 'string') {
      return Response.json({ error: 'Name required' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allStaff = await base44.asServiceRole.entities.StaffAccount.list() || [];
    
    // Generate base username from name
    const parts = name.trim().toLowerCase().split(/\s+/);
    const baseUsername = parts.join('.');

    // Check for duplicates (case-insensitive)
    const existingUsernames = allStaff.map(s => (s.username || '').trim().toLowerCase());
    
    if (!existingUsernames.includes(baseUsername)) {
      return Response.json({
        success: true,
        suggested_username: baseUsername,
        is_duplicate: false,
      });
    }

    // Find next available number
    let counter = 1;
    while (existingUsernames.includes(`${baseUsername}${counter}`)) {
      counter++;
    }

    const suggestedUsername = `${baseUsername}${counter}`;

    return Response.json({
      success: true,
      suggested_username: suggestedUsername,
      is_duplicate: true,
      incremented: counter,
    });
  } catch (error) {
    console.error('[generateStaffUsername] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});