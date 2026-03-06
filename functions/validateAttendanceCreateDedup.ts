import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { date, studentId, classname, section, academicYear } = await req.json();

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