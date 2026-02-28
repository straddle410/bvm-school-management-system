import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Shared: validate a date falls within an academic year's range
function validateAcademicYearBoundary(date, academicYearStart, academicYearEnd) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const start = new Date(academicYearStart);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(academicYearEnd);
  end.setUTCHours(23, 59, 59, 999);
  return d >= start && d <= end;
}

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

    // ── ACADEMIC YEAR BOUNDARY CHECK ──
    const yearConfigs = await base44.asServiceRole.entities.AcademicYear.filter({ year: academicYear });
    if (yearConfigs.length === 0) {
      return Response.json({ error: `Academic year "${academicYear}" is not configured in the system.` }, { status: 400 });
    }
    const yearConfig = yearConfigs[0];
    if (!validateAcademicYearBoundary(date, yearConfig.start_date, yearConfig.end_date)) {
      return Response.json({
        error: `Action not allowed outside selected Academic Year. Date "${date}" is outside the ${academicYear} range (${yearConfig.start_date} to ${yearConfig.end_date}).`
      }, { status: 400 });
    }

    // ── SOFT-DELETE GUARD ──
    const studentRecords = await base44.asServiceRole.entities.Attendance.filter({ student_id: studentId });
    // Fetch the Student entity to check is_deleted
    const allStudentsForId = await base44.asServiceRole.entities.Student.filter({ student_id: studentId, academic_year: academicYear });
    const studentRecord = allStudentsForId[0];
    if (studentRecord && studentRecord.is_deleted === true) {
      return Response.json({ error: 'Operation not allowed for deleted student.' }, { status: 422 });
    }

    // Check for existing record with same student + date + class + section + year
    const existingRecords = await base44.asServiceRole.entities.Attendance.filter({
      date,
      student_id: studentId,
      class_name: classname,
      section,
      academic_year: academicYear
    });

    if (existingRecords.length > 0) {
      return Response.json({
        isDuplicate: true,
        existingRecordId: existingRecords[0].id,
        message: 'Duplicate prevented: record exists for this student+date+class+section'
      });
    }

    return Response.json({
      isDuplicate: false,
      canCreate: true,
      message: 'No duplicate found - safe to create'
    });
  } catch (error) {
    console.error('Create deduplication check error:', error);
    return Response.json(
      { error: error.message || 'Deduplication check failed' },
      { status: 500 }
    );
  }
});