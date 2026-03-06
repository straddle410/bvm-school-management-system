import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

async function verifyStaffToken(token) {
  try {
    const secret = Deno.env.get('STAFF_SESSION_SECRET');
    if (!secret || !token) return null;
    const dotIdx = token.lastIndexOf('.');
    if (dotIdx < 0) return null;
    const payloadB64 = token.slice(0, dotIdx);
    const sigB64 = token.slice(dotIdx + 1);
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']
    );
    const sigBytes = Uint8Array.from(atob(sigB64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(payloadB64));
    if (!valid) return null;
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
    let exp = payload.exp;
    if (exp > 1e12) exp = Math.floor(exp / 1000);
    if (exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

// Returns next available roll_no for class+section+academic_year
// Also used to get all students for a class (for Manage Roll Numbers tool)
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { action = 'next', class_name, section, academic_year, staff_session_token, updates } = body;

    // Auth: staff session token OR base44.auth.me()
    let performedBy = 'unknown';
    let authed = false;

    if (staff_session_token) {
      const payload = await verifyStaffToken(staff_session_token);
      if (payload) {
        authed = true;
        performedBy = payload.email || payload.username || 'staff';
      }
    }

    if (!authed) {
      const user = await base44.auth.me().catch(() => null);
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      authed = true;
      performedBy = user.email || 'unknown';
    }

    if (!class_name || !section || !academic_year) {
      return Response.json({ error: 'class_name, section, academic_year are required' }, { status: 400 });
    }

    const students = await base44.asServiceRole.entities.Student.filter(
      { class_name, section, academic_year },
      'roll_no',
      10000
    );

    if (action === 'next') {
      // Exclude archived/passed-out/transferred/deleted students (match Students page logic)
      const EXCLUDED_STATUSES = ['Archived', 'Passed Out', 'Transferred'];
      const active = students.filter(s => !s.is_deleted && !EXCLUDED_STATUSES.includes(s.status));
      const maxRoll = active.reduce((max, s) => {
        const r = parseInt(s.roll_no);
        return !isNaN(r) && r > max ? r : max;
      }, 0);
      return Response.json({ success: true, next_roll_no: maxRoll + 1 });
    }

    if (action === 'list') {
      // Return sorted list of students for Manage Roll Numbers tool
      const sorted = [...students].sort((a, b) => {
        const ra = parseInt(a.roll_no) || 9999;
        const rb = parseInt(b.roll_no) || 9999;
        return ra - rb;
      });
      return Response.json({ students: sorted });
    }

    if (action === 'save_rolls') {
      if (!Array.isArray(updates)) return Response.json({ error: 'updates array required' }, { status: 400 });

      // SOFT-DELETE GUARD
      for (const u of updates) {
        const targetStudent = students.find(s => s.id === u.id);
        if (targetStudent && targetStudent.is_deleted === true) {
          return Response.json({ error: `Operation not allowed for deleted student (${targetStudent.name}).` }, { status: 422 });
        }
      }

      // Validate uniqueness
      const seen = new Map();
      for (const u of updates) {
        const roll = parseInt(u.roll_no);
        if (!roll || roll < 1) return Response.json({ error: `Invalid roll number for student ${u.id}` }, { status: 400 });
        if (seen.has(roll)) return Response.json({ error: `Duplicate roll number: ${roll}` }, { status: 400 });
        seen.set(roll, u.id);
      }

      // Check conflicts with students NOT in updates (skip deleted/archived/passed-out students)
      const EXCLUDED_STATUSES = ['Archived', 'Passed Out', 'Transferred'];
      const updatingIds = new Set(updates.map(u => u.id));
      for (const s of students) {
        if (!updatingIds.has(s.id) && s.roll_no && !s.is_deleted && !EXCLUDED_STATUSES.includes(s.status)) {
          const existingRoll = parseInt(s.roll_no);
          if (seen.has(existingRoll)) {
            const conflictingUpdate = updates.find(u => parseInt(u.roll_no) === existingRoll);
            const conflictName = conflictingUpdate ? students.find(st => st.id === conflictingUpdate.id)?.name || conflictingUpdate.id : '';
            return Response.json({
              error: `Duplicate roll number: ${existingRoll} is already assigned to "${s.name}". Cannot also assign it to "${conflictName}".`
            }, { status: 400 });
          }
        }
      }

      // Apply updates
      for (const u of updates) {
        await base44.asServiceRole.entities.Student.update(u.id, { roll_no: parseInt(u.roll_no) });
      }

      // Audit log
      await base44.asServiceRole.entities.AuditLog.create({
        action: 'BULK_ROLL_RESEQUENCE',
        module: 'Student',
        class_name,
        section,
        academic_year,
        performed_by: performedBy,
        timestamp: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0],
        details: `Bulk roll resequence for Class ${class_name}-${section} (${updates.length} students updated)`
      });

      return Response.json({ success: true, updated: updates.length });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});