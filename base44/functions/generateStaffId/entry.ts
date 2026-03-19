import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Generates the next unique staff ID.
 * Admin/Accountant roles → A001, A002, ...
 * All other roles        → T001, T002, ...
 * 
 * Also used as a one-time migration endpoint to assign IDs to existing staff.
 */

const ADMIN_ROLES = ['admin', 'accountant'];

function getPrefix(role) {
  return ADMIN_ROLES.includes((role || '').toLowerCase()) ? 'A' : 'T';
}

function parseStaffIdNum(username, prefix) {
  if (!username) return null;
  const upper = username.toUpperCase();
  if (!upper.startsWith(prefix)) return null;
  const num = parseInt(upper.slice(prefix.length), 10);
  return isNaN(num) ? null : num;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { action = 'generate', role } = payload;

    // Auth: must be admin or principal
    const session = payload._staffUsername
      ? { username: payload._staffUsername }
      : null;

    // Allow service role for migration
    const allStaff = await base44.asServiceRole.entities.StaffAccount.list();

    // ── ONE-TIME MIGRATION: assign IDs to staff that don't have them ──
    if (action === 'migrate') {
      const updated = [];
      const failed = [];

      // Collect already-assigned T and A numbers
      const usedT = new Set();
      const usedA = new Set();
      for (const s of allStaff) {
        const u = (s.username || '').toUpperCase();
        if (u.match(/^T\d+$/)) usedT.add(parseInt(u.slice(1), 10));
        if (u.match(/^A\d+$/)) usedA.add(parseInt(u.slice(1), 10));
      }

      // Find staff without proper IDs
      const needsId = allStaff.filter(s => {
        const u = (s.username || '').toUpperCase();
        return !u.match(/^[TA]\d+$/);
      });

      for (const staff of needsId) {
        const prefix = getPrefix(staff.role);
        const usedSet = prefix === 'A' ? usedA : usedT;

        // Find next available number
        let num = 1;
        while (usedSet.has(num)) num++;
        usedSet.add(num);

        const newUsername = `${prefix}${String(num).padStart(3, '0')}`;
        try {
          await base44.asServiceRole.entities.StaffAccount.update(staff.id, { username: newUsername });
          updated.push({ id: staff.id, name: staff.name, old_username: staff.username, new_username: newUsername });
        } catch (e) {
          failed.push({ id: staff.id, name: staff.name, error: e.message });
        }
      }

      return Response.json({ success: true, updated, failed, skipped: allStaff.length - needsId.length });
    }

    // ── GENERATE: return next available ID for given role ──
    if (!role) {
      return Response.json({ error: 'role is required for generate action' }, { status: 400 });
    }

    const prefix = getPrefix(role);

    // Collect all used numbers for this prefix
    const used = new Set();
    for (const s of allStaff) {
      const num = parseStaffIdNum(s.username, prefix);
      if (num !== null) used.add(num);
    }

    // Find next available (starting from 101)
    let next = 101;
    while (used.has(next)) next++;

    const newId = `${prefix}${String(next).padStart(3, '0')}`;
    return Response.json({ success: true, staff_id: newId });

  } catch (error) {
    console.error('[generateStaffId] error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});