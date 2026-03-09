import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Helper: Get current time in IST using Intl API
function getISTTime() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  const parts = formatter.formatToParts(now);
  const dateObj = {};
  parts.forEach(p => { dateObj[p.type] = p.value; });
  
  return {
    hours: parseInt(dateObj.hour),
    minutes: parseInt(dateObj.minute),
    year: parseInt(dateObj.year),
    month: parseInt(dateObj.month),
    day: parseInt(dateObj.day),
    dateString: `${dateObj.year}-${dateObj.month}-${dateObj.day}`
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Only admin can trigger this
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    // Get current time in IST
    const istTime = getISTTime();
    const istTimeInMinutes = istTime.hours * 60 + istTime.minutes;
    const lockTimeInMinutes = 15 * 60; // 3:00 PM = 15:00

    // Only auto-submit/lock if current time >= 3:00 PM IST
    if (istTimeInMinutes < lockTimeInMinutes) {
      return Response.json({
        message: `Current IST time: ${istTime.hours.toString().padStart(2, '0')}:${istTime.minutes.toString().padStart(2, '0')}. Auto-submit not triggered (before 3:00 PM IST).`,
        autoSubmitted: 0,
        locked: 0
      });
    }

    // Get today's date in IST
    const todayIST = istTime.dateString;

    // ── Step 1: Fetch all Attendance records for today
    const allAttendance = await base44.asServiceRole.entities.Attendance.list();
    const todayAttendance = allAttendance.filter(a => a.date === todayIST);

    // ── Step 2: Fetch all active academic years to get current one
    const allYears = await base44.asServiceRole.entities.AcademicYear.list();
    const currentYear = allYears.find(y => y.is_current === true);
    const academicYear = currentYear?.year || '';

    if (!academicYear) {
      return Response.json({ error: 'No active academic year configured' }, { status: 400 });
    }

    // ── Step 3: Fetch all published students for current year
    const allStudents = await base44.asServiceRole.entities.Student.filter({
      status: 'Published',
      academic_year: academicYear,
      is_deleted: false
    });

    // ── Step 4: Build attendance map by class-section-student
    const attendanceMap = {};
    todayAttendance.forEach(a => {
      const key = `${a.class_name}-${a.section}-${a.student_id}`;
      attendanceMap[key] = a;
    });

    // ── Step 5: Group students by class-section and identify missing ones
    const classStudentMap = {};
    allStudents.forEach(student => {
      const classSectionKey = `${student.class_name}-${student.section}`;
      if (!classStudentMap[classSectionKey]) {
        classStudentMap[classSectionKey] = [];
      }
      classStudentMap[classSectionKey].push(student);
    });

    // ── Step 6: Auto-submit missing students + lock all
    const recordsToCreate = [];
    const recordsToLock = [];
    let autoSubmittedCount = 0;

    // Identify missing students and records to lock
    for (const [classSectionKey, students] of Object.entries(classStudentMap)) {
      const [className, section] = classSectionKey.split('-');
      
      for (const student of students) {
        const attendanceKey = `${className}-${section}-${student.student_id}`;
        const existingRecord = attendanceMap[attendanceKey];

        if (!existingRecord) {
          // Missing record: auto-create with Present (full_day)
          recordsToCreate.push({
            date: todayIST,
            class_name: className,
            section: section,
            student_id: student.student_id || student.id,
            student_name: student.name,
            attendance_type: 'full_day',
            is_present: true,
            is_holiday: false,
            marked_by: 'SYSTEM',
            auto_submitted: true,
            status: 'Submitted',
            is_locked: true,
            locked_at: new Date().toISOString(),
            academic_year: academicYear
          });
          autoSubmittedCount++;
        } else {
          // Existing record: mark for lock
          recordsToLock.push(existingRecord);
        }
      }
    }

    // ── Step 7: Bulk create auto-submitted records
    let createdCount = 0;
    if (recordsToCreate.length > 0) {
      try {
        await base44.asServiceRole.entities.Attendance.bulkCreate(recordsToCreate);
        createdCount = recordsToCreate.length;
      } catch (createError) {
        console.warn('Bulk create had issues:', createError);
        // Continue to lock existing records even if bulk create has issues
      }
    }

    // ── Step 8: Lock all existing teacher-marked records
    const lockPromises = recordsToLock.map(record => {
      if (!record.is_locked) { // Only lock if not already locked
        return base44.asServiceRole.entities.Attendance.update(record.id, {
          is_locked: true,
          locked_at: new Date().toISOString(),
          status: 'Submitted'
        });
      }
      return Promise.resolve();
    });

    const lockedCount = lockPromises.length;
    await Promise.all(lockPromises);

    // ── Step 9: Audit log
    try {
      await base44.asServiceRole.entities.AuditLog.create({
        action: 'attendance_auto_submit',
        module: 'Attendance',
        date: todayIST,
        performed_by: user.email,
        details: `Auto-submitted ${createdCount} absent records and locked ${lockedCount} existing records at 3:00 PM IST`,
        academic_year: academicYear
      });
    } catch (auditError) {
      console.warn('Audit log failed but proceeding:', auditError);
    }

    return Response.json({
      message: `Auto-submitted ${createdCount} records and locked ${lockedCount} records at 3:00 PM IST on ${todayIST}`,
      autoSubmitted: createdCount,
      locked: lockedCount,
      lockedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Attendance auto-submit error:', error);
    return Response.json(
      { error: error.message || 'Failed to auto-submit attendance' },
      { status: 500 }
    );
  }
});