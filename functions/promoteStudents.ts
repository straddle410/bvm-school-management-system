import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || (user.role !== 'admin' && user.role !== 'principal')) {
      return Response.json({ error: 'Forbidden: Admin or Principal access required' }, { status: 403 });
    }

    const { academicYear } = await req.json();
    if (!academicYear) {
      return Response.json({ error: 'academicYear is required' }, { status: 400 });
    }

    // Calculate next academic year
    const match = academicYear.match(/^(\d{4})-(\d{2})$/);
    if (!match) {
      return Response.json({ error: 'Invalid academicYear format. Expected e.g. 2025-26' }, { status: 400 });
    }
    const startYear = parseInt(match[1]) + 1;
    const endYear = (startYear + 1).toString().slice(2);
    const nextYear = `${startYear}-${endYear}`;

    // STRICT VALIDATION: next academic year MUST exist
    const allYears = await base44.asServiceRole.entities.AcademicYear.list();
    const nextYearRecord = allYears.find(y => y.year === nextYear);

    if (!nextYearRecord) {
      // Log the block
      await base44.asServiceRole.entities.AuditLog.create({
        action: 'PROMOTION_BLOCKED',
        module: 'Student',
        performed_by: user.email,
        details: `Promotion blocked: Academic year ${nextYear} not found. Must be created in Settings first.`,
        academic_year: academicYear,
      });
      return Response.json({
        blocked: true,
        nextYear,
        error: `Academic year ${nextYear} is not created. Please create it in Settings before promoting students.`
      }, { status: 422 });
    }

    // Fetch active students
    const students = await base44.asServiceRole.entities.Student.filter({ academic_year: academicYear });
    const activeStudents = students.filter(s => !['Passed Out', 'Transferred'].includes(s.status));

    // Mark next year as current
    await Promise.all(allYears.map(y =>
      base44.asServiceRole.entities.AcademicYear.update(y.id, { is_current: false })
    ));
    await base44.asServiceRole.entities.AcademicYear.update(nextYearRecord.id, { is_current: true });

    const CLASS_ORDER = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
    let promoted = 0, passedOut = 0;

    await Promise.all(activeStudents.map(async (student) => {
      const idx = CLASS_ORDER.indexOf(student.class_name);
      const nextClass = (idx === -1 || idx === CLASS_ORDER.length - 1) ? null : CLASS_ORDER[idx + 1];
      if (nextClass) {
        await base44.asServiceRole.entities.Student.update(student.id, {
          class_name: nextClass,
          academic_year: nextYear,
          status: 'Approved'
        });
        promoted++;
      } else {
        await base44.asServiceRole.entities.Student.update(student.id, {
          academic_year: nextYear,
          status: 'Passed Out'
        });
        passedOut++;
      }
    }));

    return Response.json({ success: true, promoted, passedOut, nextYear });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});