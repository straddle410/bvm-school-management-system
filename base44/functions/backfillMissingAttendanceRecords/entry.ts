import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Admin only
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    // Get current academic year
    const allYears = await base44.asServiceRole.entities.AcademicYear.list();
    const currentYear = allYears.find(y => y.is_current === true);
    const academicYear = currentYear?.year;

    if (!academicYear) {
      return Response.json({ error: 'No active academic year configured' }, { status: 400 });
    }

    // Get year start and end dates
    const yearData = currentYear;
    if (!yearData.start_date) {
      return Response.json({ error: 'Academic year has no start date' }, { status: 400 });
    }

    const startDate = new Date(yearData.start_date);
    const endDate = new Date(); // Today
    endDate.setHours(23, 59, 59, 999);

    // ── Step 1: Fetch all Published students
    const allStudents = await base44.asServiceRole.entities.Student.filter({
      status: 'Published',
      academic_year: academicYear,
      is_deleted: false
    });

    if (allStudents.length === 0) {
      return Response.json({
        message: 'No active students found',
        recordsCreated: 0
      });
    }

    // ── Step 2: Fetch all holidays and overrides
    const holidays = await base44.asServiceRole.entities.Holiday.filter({
      academic_year: academicYear,
      status: 'Active'
    });
    const holidaySet = new Set(holidays.map(h => h.date));

    const overrides = await base44.asServiceRole.entities.HolidayOverride.list();
    const overrideSet = new Set(overrides.map(o => `${o.date}-${o.class_name}-${o.section}`));

    // ── Step 3: Fetch existing attendance
    const existingAttendance = await base44.asServiceRole.entities.Attendance.list();
    const attendanceMap = {};
    existingAttendance.forEach(a => {
      const key = `${a.date}-${a.student_id}`;
      attendanceMap[key] = true;
    });

    // ── Step 4: Generate all dates between start and today
    const datesToProcess = [];
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      datesToProcess.push(new Date(currentDate)); // Clone
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // ── Step 5: Build records to create
    const recordsToCreate = [];
    
    for (const processDate of datesToProcess) {
      const dateStr = processDate.toISOString().split('T')[0];
      const dayOfWeek = processDate.getDay();
      const isSunday = dayOfWeek === 0;
      const isHoliday = holidaySet.has(dateStr);

      // For each student
      for (const student of allStudents) {
        const attendanceKey = `${dateStr}-${student.student_id}`;
        
        // Skip if record exists
        if (attendanceMap[attendanceKey]) {
          continue;
        }

        // Check if holiday or Sunday (but override takes precedence)
        const overrideKey = `${dateStr}-${student.class_name}-${student.section}`;
        const hasOverride = overrideSet.has(overrideKey);
        const effectiveHoliday = (isSunday || isHoliday) && !hasOverride;

        // If it's a holiday/Sunday without override, skip (don't create record)
        if (effectiveHoliday) {
          continue;
        }

        // Create Present record
        recordsToCreate.push({
          date: dateStr,
          class_name: student.class_name,
          section: student.section,
          student_id: student.student_id || student.id,
          student_name: student.name,
          attendance_type: 'full_day',
          is_present: true,
          is_holiday: false,
          status: 'Submitted',
          marked_by: 'DATA_CORRECTION',
          academic_year: academicYear
        });
      }
    }

    // ── Step 6: Bulk create in batches
    const batchSize = 500;
    let createdCount = 0;

    for (let i = 0; i < recordsToCreate.length; i += batchSize) {
      const batch = recordsToCreate.slice(i, i + batchSize);
      try {
        await base44.asServiceRole.entities.Attendance.bulkCreate(batch);
        createdCount += batch.length;
      } catch (batchError) {
        console.warn(`Batch ${i / batchSize} failed:`, batchError.message);
        // Continue to next batch
      }
    }

    // ── Step 7: Audit log
    try {
      await base44.asServiceRole.entities.AuditLog.create({
        action: 'attendance_backfill',
        module: 'Attendance',
        performed_by: user.email,
        details: `Backfilled ${createdCount} missing attendance records for ${allStudents.length} active students in ${academicYear}`,
        academic_year: academicYear
      });
    } catch (auditError) {
      console.warn('Audit log failed:', auditError.message);
    }

    return Response.json({
      message: `Backfill complete for ${academicYear}`,
      activeStudents: allStudents.length,
      daysProcessed: datesToProcess.length,
      recordsCreated: createdCount,
      holidaysSkipped: holidaySet.size,
      completedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Backfill error:', error);
    return Response.json(
      { error: error.message || 'Backfill failed' },
      { status: 500 }
    );
  }
});