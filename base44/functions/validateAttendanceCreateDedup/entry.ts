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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { date, studentId, classname, section, academicYear, staff_session_token } = body;

    // Auth: staff session token OR base44.auth.me()
    let user = null;

    if (staff_session_token) {
      const payload = await verifyStaffToken(staff_session_token);
      if (payload) {
        user = { email: payload.email, role: payload.role };
      }
    }

    if (!user) {
      const baseUser = await base44.auth.me().catch(() => null);
      if (baseUser) {
        user = baseUser;
      }
    }

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!date || !studentId || !classname || !section || !academicYear) {
      return Response.json(
        { error: 'date, studentId, classname, section, and academicYear are required' },
        { status: 400 }
      );
    }

    // ── TODAY-ONLY ATTENDANCE (CHECK FIRST) ──
    // Non-admin/principal users can ONLY create attendance for TODAY
    const userRole = (user.role || '').toLowerCase();
    const isAdmin = userRole === 'admin' || userRole === 'principal';
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const attDate = new Date(date);
    attDate.setUTCHours(0, 0, 0, 0);

    if (!isAdmin && attDate.getTime() !== today.getTime()) {
      return Response.json(
        { error: `Teachers can only create attendance for today. Attempted date: ${date}` },
        { status: 400 }
      );
    }

    // Check for existing attendance (dedup)
    const existing = await base44.asServiceRole.entities.Attendance.filter({
      date, student_id: studentId, class_name: classname, section, academic_year: academicYear
    });

    if (existing.length > 0) {
      return Response.json({
        isDuplicate: true,
        existingRecordId: existing[0].id,
        message: 'Attendance record already exists for this student on this date'
      });
    }

    return Response.json({ isDuplicate: false });
  } catch (error) {
    console.error('Dedup check error:', error);
    return Response.json(
      { error: error.message || 'Failed to validate' },
      { status: 500 }
    );
  }
});