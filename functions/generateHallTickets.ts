import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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
    const payload = await req.json();
    const { examTypeId, classname, section, academicYear, assignmentType, staffSession } = payload;

    if (!examTypeId || !classname || !academicYear) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    let staffUser = null;
    if (staffSession) {
      try {
        staffUser = typeof staffSession === 'string' ? JSON.parse(staffSession) : staffSession;
      } catch {}
    }

    if (!staffUser) {
      try {
        const platformUser = await base44.auth.me();
        if (platformUser?.role !== 'admin') {
          return Response.json({ error: 'Only admins can generate hall tickets' }, { status: 403 });
        }
        staffUser = platformUser;
      } catch (e) {
        return Response.json({ error: 'Unauthorized - please log in' }, { status: 401 });
      }
    }

    const user = staffUser;

    // Validate academic year is configured
    const yearConfig = await base44.asServiceRole.entities.AcademicYear.filter({ year: academicYear });
    if (yearConfig.length === 0) {
      return Response.json({ error: 'Academic year not configured in system' }, { status: 400 });
    }
    const yearRecord = yearConfig[0];

    // Check if hall tickets already exist for this class/exam/year
    const existingTickets = await base44.asServiceRole.entities.HallTicket.filter({
      class_name: classname,
      exam_type: examTypeId,
      academic_year: academicYear,
      section: section || 'A'
    });

    if (existingTickets.length > 0) {
      return Response.json({
        error: `Hall tickets already exist for Class ${classname}-${section || 'A'} in this exam. Delete existing tickets first.`,
        existingCount: existingTickets.length
      }, { status: 409 });
    }

    // Validate exam type exists and is active
    const examTypes = await base44.asServiceRole.entities.ExamType.filter({ id: examTypeId });
    if (examTypes.length === 0) {
      return Response.json({ error: 'Exam type not found' }, { status: 400 });
    }
    const examType = examTypes[0];

    if (!examType.is_active) {
      return Response.json({ error: 'Cannot generate tickets for inactive exam type' }, { status: 400 });
    }

    // ── ACADEMIC YEAR BOUNDARY CHECK ──
    // Ensure exam type belongs to the same academic year
    if (examType.academic_year && examType.academic_year !== academicYear) {
      return Response.json({
        error: `Action not allowed outside selected Academic Year. Exam type "${examType.name}" belongs to academic year "${examType.academic_year}", not "${academicYear}".`
      }, { status: 400 });
    }

    // If exam timetable entries exist, validate exam dates are within academic year
    const timetableEntries = await base44.asServiceRole.entities.ExamTimetable.filter({
      exam_type: examTypeId,
      academic_year: academicYear
    });

    for (const entry of timetableEntries) {
      if (entry.exam_date && !validateAcademicYearBoundary(entry.exam_date, yearRecord.start_date, yearRecord.end_date)) {
        return Response.json({
          error: `Action not allowed outside selected Academic Year. Exam date "${entry.exam_date}" for subject "${entry.subject_name}" is outside the ${academicYear} range (${yearRecord.start_date} to ${yearRecord.end_date}).`
        }, { status: 400 });
      }
    }

    // Fetch students — global filter: status=Published, is_deleted=false, current AY only
    const query = {
      class_name: classname,
      academic_year: academicYear,
      status: 'Published',
      is_deleted: false
    };
    if (section) query.section = section;

    const students = await base44.asServiceRole.entities.Student.filter(query, '-roll_no');

    if (students.length === 0) {
      return Response.json({ error: 'No students found', count: 0 }, { status: 200 });
    }

    // Check for duplicate roll numbers
    const rollNumbers = students.map(s => s.roll_no).filter(Boolean);
    const uniqueRollNumbers = new Set(rollNumbers);
    const hasDuplicates = rollNumbers.length !== uniqueRollNumbers.size;

    if (hasDuplicates) {
      const duplicates = rollNumbers.filter((rn, idx) => rollNumbers.indexOf(rn) !== idx);
      return Response.json({
        error: `Duplicate roll numbers found in Class ${classname}-${section || 'A'}: ${[...new Set(duplicates)].join(', ')}. Please fix roll numbers before generating hall tickets.`,
        hasDuplicateRollNumbers: true,
        duplicateRollNumbers: [...new Set(duplicates)]
      }, { status: 400 });
    }

    // Generate hall ticket numbers
    const currentYear = new Date().getFullYear();
    const yy = String(currentYear).slice(-2);
    const cc = String(classname).padStart(2, '0');
    
    const hallTickets = [];

    let randomSequence = [];
    if (assignmentType === 'random') {
      randomSequence = Array.from({ length: students.length }, (_, i) => i + 1);
      for (let i = randomSequence.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [randomSequence[i], randomSequence[j]] = [randomSequence[j], randomSequence[i]];
      }
    }

    // Already filtered: status=Published, is_deleted=false in query above
    const activeStudents = students; // all are already Published & not deleted
    if (activeStudents.length === 0) {
      return Response.json({ error: 'No active (non-deleted) students found', count: 0 }, { status: 200 });
    }

    // Re-check for duplicate roll numbers after filtering
    const activeRollNumbers = activeStudents.map(s => s.roll_no).filter(Boolean);
    const activeUniqueRolls = new Set(activeRollNumbers);
    if (activeRollNumbers.length !== activeUniqueRolls.size) {
      const duplicates = activeRollNumbers.filter((rn, idx) => activeRollNumbers.indexOf(rn) !== idx);
      return Response.json({
        error: `Duplicate roll numbers found in active students: ${[...new Set(duplicates)].join(', ')}.`,
        hasDuplicateRollNumbers: true
      }, { status: 400 });
    }

    activeStudents.forEach((student, idx) => {
      let xx;
      if (assignmentType === 'sequential') {
        xx = String(student.roll_no || idx + 1).padStart(2, '0');
      } else {
        xx = String(randomSequence[idx]).padStart(2, '0');
      }

      const hallTicketNumber = `${yy}${cc}${xx}`;

      hallTickets.push({
        hall_ticket_number: hallTicketNumber,
        exam_type: examTypeId,
        student_id: student.id,
        student_name: student.name,
        roll_number: student.roll_no,
        class_name: classname,
        section: section || 'A',
        student_photo_url: student.photo_url || '',
        academic_year: academicYear,
        status: 'Generated',
        generated_by: user.email || user.full_name
      });
    });

    await base44.asServiceRole.entities.HallTicket.bulkCreate(hallTickets);


    await base44.asServiceRole.entities.HallTicketLog.create({
      action: 'generated',
      hall_ticket_id: 'bulk',
      student_id: 'multiple',
      performed_by: user.email || user.full_name,
      details: `Generated ${hallTickets.length} hall tickets for Class ${classname}`
    });

    return Response.json({
      success: true,
      count: hallTickets.length,
      message: `Generated ${hallTickets.length} hall tickets successfully`
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message || 'Server error' }, { status: 500 });
  }
});