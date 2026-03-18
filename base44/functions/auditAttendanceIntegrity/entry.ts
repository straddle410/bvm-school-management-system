import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || (user.role !== 'admin' && user.role !== 'principal')) {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { academicYear = '2025-26', sampleSize = null } = body;

    // Fetch all attendance records
    const allAttendance = await base44.asServiceRole.entities.Attendance.filter({
      academic_year: academicYear
    });

    // Fetch all students for reference
    const allStudents = await base44.asServiceRole.entities.Student.filter({
      academic_year: academicYear
    });

    const issues = [];
    const stats = {
      total_records: allAttendance.length,
      students_checked: new Set(),
      issues_found: 0,
      conflicting_records: [],
      orphan_records: [],
      invalid_attendance_types: [],
      duplicate_records: [],
      data_integrity_errors: []
    };

    const studentMap = Object.fromEntries(allStudents.map(s => [s.student_id, s]));
    const recordsByStudentDate = {};

    // Group records by student_id + date to detect duplicates
    allAttendance.forEach(record => {
      const key = `${record.student_id}_${record.date}`;
      if (!recordsByStudentDate[key]) {
        recordsByStudentDate[key] = [];
      }
      recordsByStudentDate[key].push(record);
    });

    // Check for issues
    allAttendance.forEach((record, idx) => {
      const key = `${record.student_id}_${record.date}`;

      // 1. Check for orphan records (student doesn't exist)
      if (!studentMap[record.student_id]) {
        stats.orphan_records.push({
          id: record.id,
          student_id: record.student_id,
          date: record.date,
          reason: 'Student not found in system'
        });
        return;
      }

      stats.students_checked.add(record.student_id);

      // 2. Check for duplicate records (same student + date)
      if (recordsByStudentDate[key].length > 1) {
        stats.duplicate_records.push({
          student_id: record.student_id,
          date: record.date,
          count: recordsByStudentDate[key].length,
          ids: recordsByStudentDate[key].map(r => r.id)
        });
      }

      // 3. Check for invalid attendance_type
      const validTypes = ['full_day', 'half_day', 'absent', 'holiday'];
      if (record.attendance_type && !validTypes.includes(record.attendance_type)) {
        stats.invalid_attendance_types.push({
          id: record.id,
          student_id: record.student_id,
          date: record.date,
          attendance_type: record.attendance_type,
          reason: `Invalid attendance_type: ${record.attendance_type}`
        });
      }

      // 4. Check for conflicting field values
      const conflicts = [];

      // Conflict: marked as holiday but attendance_type is absent
      if ((record.is_holiday || record.attendance_type === 'holiday') && record.attendance_type === 'absent') {
        conflicts.push('Holiday flag set but marked as absent');
      }

      // Conflict: is_present = false but attendance_type is full_day
      if (record.is_present === false && record.attendance_type === 'full_day') {
        conflicts.push('is_present=false but attendance_type=full_day');
      }

      // Conflict: is_present = true but attendance_type is absent
      if (record.is_present === true && record.attendance_type === 'absent') {
        conflicts.push('is_present=true but attendance_type=absent');
      }

      // Conflict: half_day_period set but attendance_type is not half_day
      if (record.half_day_period && record.attendance_type !== 'half_day') {
        conflicts.push(`half_day_period=${record.half_day_period} but attendance_type=${record.attendance_type}`);
      }

      if (conflicts.length > 0) {
        stats.conflicting_records.push({
          id: record.id,
          student_id: record.student_id,
          date: record.date,
          attendance_type: record.attendance_type,
          is_present: record.is_present,
          is_holiday: record.is_holiday,
          conflicts
        });
      }

      // 5. Check data integrity
      if (!record.date || !record.student_id || !record.class_name) {
        stats.data_integrity_errors.push({
          id: record.id,
          student_id: record.student_id,
          missing_fields: [
            !record.date && 'date',
            !record.student_id && 'student_id',
            !record.class_name && 'class_name'
          ].filter(Boolean)
        });
      }
    });

    stats.issues_found = 
      stats.conflicting_records.length +
      stats.orphan_records.length +
      stats.invalid_attendance_types.length +
      stats.duplicate_records.length +
      stats.data_integrity_errors.length;

    stats.students_checked = stats.students_checked.size;

    return Response.json({
      success: true,
      academicYear,
      timestamp: new Date().toISOString(),
      stats,
      issues: {
        conflicting_records: stats.conflicting_records,
        orphan_records: stats.orphan_records,
        invalid_attendance_types: stats.invalid_attendance_types,
        duplicate_records: stats.duplicate_records,
        data_integrity_errors: stats.data_integrity_errors
      }
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});