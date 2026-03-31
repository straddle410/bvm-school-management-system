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
    const { examTypeId, classes, classname, section, academicYear, assignmentType, staffSession } = payload;

    // Support both new (classes array) and old (classname) parameter for backward compatibility
    const classesToProcess = classes || (classname ? [classname] : []);

    if (!examTypeId || classesToProcess.length === 0 || !academicYear) {
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

    // section is required — frontend now enforces this
    if (!section) {
      return Response.json({ error: 'Section is required to generate hall tickets' }, { status: 400 });
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

    // Fetch students for all classes — global filter: status=Published, is_deleted=false, current AY only
    const allHallTickets = [];
    let totalGenerated = 0;

    for (const classname of classesToProcess) {
      const query = {
        class_name: classname,
        academic_year: academicYear,
        status: 'Published',
        is_deleted: false
      };
      if (section) query.section = section;

      const students = await base44.asServiceRole.entities.Student.filter(query, '-roll_no');

      if (students.length === 0) {
        continue; // Skip if no students in this class
      }

      // Check for duplicate roll numbers
      const rollNumbers = students.map(s => s.roll_no).filter(Boolean);
      const uniqueRollNumbers = new Set(rollNumbers);
      const hasDuplicates = rollNumbers.length !== uniqueRollNumbers.size;

      if (hasDuplicates) {
        const duplicates = rollNumbers.filter((rn, idx) => rollNumbers.indexOf(rn) !== idx);
        return Response.json({
          error: `Duplicate roll numbers found in Class ${classname}-${section}: ${[...new Set(duplicates)].join(', ')}. Please fix roll numbers before generating hall tickets.`,
          hasDuplicateRollNumbers: true,
          duplicateRollNumbers: [...new Set(duplicates)]
        }, { status: 400 });
      }

      // Generate hall ticket numbers
      const currentYear = new Date().getFullYear();
      const yy = String(currentYear).slice(-2);
      const cc = String(classname).padStart(2, '0');

      const hallTickets = [];

      // Fetch existing hall tickets for this class/section/exam to skip students who already have one
      const existingTicketsForClass = await base44.asServiceRole.entities.HallTicket.filter({
        class_name: classname,
        exam_type: examTypeId,
        academic_year: academicYear,
        section: section
      });
      const studentsWithTicket = new Set(existingTicketsForClass.map(t => t.student_id));
      console.log(`[DEDUP] Class ${classname}-${section}: ${studentsWithTicket.size} existing tickets, ${students.length} students`);

      // Only process students who do NOT already have a hall ticket for this exam
      const activeStudents = students.filter(s => !studentsWithTicket.has(s.id));
      if (activeStudents.length === 0) {
        console.log(`[SKIP] All students in Class ${classname}-${section} already have hall tickets`);
        continue;
      }

      // Re-check for duplicate roll numbers after filtering
      const activeRollNumbers = activeStudents.map(s => s.roll_no).filter(Boolean);
      const activeUniqueRolls = new Set(activeRollNumbers);
      if (activeRollNumbers.length !== activeUniqueRolls.size) {
        const duplicates = activeRollNumbers.filter((rn, idx) => activeRollNumbers.indexOf(rn) !== idx);
        return Response.json({
          error: `Duplicate roll numbers found in active students of Class ${classname}: ${[...new Set(duplicates)].join(', ')}.`,
          hasDuplicateRollNumbers: true
        }, { status: 400 });
      }

      // ── GAP-FILL LOGIC ──
      // Total class strength = all students (with + without tickets)
      const classStrength = students.length;

      // Extract which sequential numbers (xx part) are already used by existing tickets
      // Hall ticket format: YY + CC + XX (last classStrength digits = XX)
      const prefix = `${yy}${cc}`;
      const usedNumbers = new Set(
        existingTicketsForClass
          .map(t => {
            const num = t.hall_ticket_number?.startsWith(prefix)
              ? parseInt(t.hall_ticket_number.slice(prefix.length), 10)
              : null;
            return num;
          })
          .filter(n => n !== null && !isNaN(n))
      );

      // Build list of missing slot numbers in range 1..classStrength
      const missingSlots = [];
      for (let i = 1; i <= classStrength; i++) {
        if (!usedNumbers.has(i)) missingSlots.push(i);
      }

      // If random mode, shuffle the missing slots
      if (assignmentType === 'random') {
        for (let i = missingSlots.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [missingSlots[i], missingSlots[j]] = [missingSlots[j], missingSlots[i]];
        }
      }

      // Sort activeStudents by roll_no for sequential, natural order for random
      const sortedActiveStudents = assignmentType === 'sequential'
        ? [...activeStudents].sort((a, b) => (a.roll_no || 0) - (b.roll_no || 0))
        : activeStudents;

      sortedActiveStudents.forEach((student, idx) => {
        let slotNumber;
        if (assignmentType === 'sequential') {
          // For sequential: prefer student's own roll_no if the slot is free, else take next free gap
          const preferredSlot = student.roll_no && !usedNumbers.has(student.roll_no) ? student.roll_no : null;
          if (preferredSlot) {
            slotNumber = preferredSlot;
            // Mark as used so next student doesn't collide
            usedNumbers.add(preferredSlot);
            const mIdx = missingSlots.indexOf(preferredSlot);
            if (mIdx !== -1) missingSlots.splice(mIdx, 1);
          } else {
            slotNumber = missingSlots.shift();
          }
        } else {
          slotNumber = missingSlots[idx];
        }

        if (!slotNumber) {
          console.warn(`[WARN] No available slot for student ${student.id} in Class ${classname}-${section}`);
          return;
        }

        const xx = String(slotNumber).padStart(2, '0');
        const hallTicketNumber = `${yy}${cc}${xx}`;

        hallTickets.push({
          hall_ticket_number: hallTicketNumber,
          exam_type: examTypeId,
          student_id: student.id,
          student_name: student.name,
          roll_number: student.roll_no,
          class_name: classname,
          section: section,
          student_photo_url: student.photo_url || '',
          academic_year: academicYear,
          status: 'Generated',
          generated_by: user.email || user.full_name
        });
      });

      allHallTickets.push(...hallTickets);
      totalGenerated += hallTickets.length;
    }

    if (totalGenerated === 0) {
      return Response.json({ message: 'All students already have hall tickets for this exam. No new tickets generated.', count: 0 });
    }

    // ── GLOBAL DUPLICATE CHECK across entire exam type ──
    // Fetch ALL existing hall tickets for this exam type + academic year (all classes)
    const allExistingTickets = await base44.asServiceRole.entities.HallTicket.filter({
      exam_type: examTypeId,
      academic_year: academicYear
    });
    const allExistingNumbers = new Set(allExistingTickets.map(t => t.hall_ticket_number).filter(Boolean));

    // Check if any of our new tickets collide with existing ones
    const duplicateNumbers = allHallTickets.filter(t => allExistingNumbers.has(t.hall_ticket_number));
    if (duplicateNumbers.length > 0) {
      const dupeList = [...new Set(duplicateNumbers.map(t => t.hall_ticket_number))].join(', ');
      return Response.json({
        error: `Duplicate hall ticket numbers detected: ${dupeList}. Please delete conflicting tickets first and regenerate.`,
        duplicateHallTicketNumbers: dupeList
      }, { status: 400 });
    }

    // Also check within the batch itself for duplicates
    const batchNumbers = allHallTickets.map(t => t.hall_ticket_number);
    const batchSet = new Set(batchNumbers);
    if (batchNumbers.length !== batchSet.size) {
      const seen = new Set();
      const dupes = batchNumbers.filter(n => seen.size === seen.add(n).size);
      return Response.json({
        error: `Internal duplicate hall ticket numbers in generated batch: ${[...new Set(dupes)].join(', ')}. Please contact support.`,
      }, { status: 400 });
    }

    await base44.asServiceRole.entities.HallTicket.bulkCreate(allHallTickets);

    await base44.asServiceRole.entities.HallTicketLog.create({
      action: 'generated',
      hall_ticket_id: 'bulk',
      student_id: 'multiple',
      performed_by: user.email || user.full_name,
      details: `Generated ${totalGenerated} hall tickets for ${classesToProcess.length} class(es)`
    });

    return Response.json({
      success: true,
      count: totalGenerated,
      message: `Generated ${totalGenerated} hall tickets successfully. (Skipped students who already had tickets.)`
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message || 'Server error' }, { status: 500 });
  }
});