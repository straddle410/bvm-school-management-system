import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const CLASS_ORDER = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

function getNextClass(className) {
  const idx = CLASS_ORDER.indexOf(className);
  if (idx === -1 || idx === CLASS_ORDER.length - 1) return null;
  return CLASS_ORDER[idx + 1];
}

function calcNextYear(academicYear) {
  const match = academicYear.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const startYear = parseInt(match[1]) + 1;
  const endYear = (startYear + 1).toString().slice(2);
  return `${startYear}-${endYear}`;
}

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

    const nextYear = calcNextYear(academicYear);
    if (!nextYear) {
      return Response.json({ error: 'Invalid academicYear format. Expected e.g. 2025-26' }, { status: 400 });
    }

    // ── STEP 1: Validate next academic year exists ──
    const allYears = await base44.asServiceRole.entities.AcademicYear.list();
    const nextYearRecord = allYears.find(y => y.year === nextYear);

    if (!nextYearRecord) {
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

    // ── STEP 2: Eligible students (Published only) ──
    const allStudents = await base44.asServiceRole.entities.Student.filter({ academic_year: academicYear });
    const eligible = allStudents.filter(s => s.status === 'Published');

    // Pre-fetch existing students in next year to detect duplicates
    const nextYearStudents = await base44.asServiceRole.entities.Student.filter({ academic_year: nextYear });
    const existingStudentIds = new Set(nextYearStudents.map(s => s.student_id).filter(Boolean));

    // Pre-fetch roll numbers per class to assign sequentially
    const rollCounters = {};
    const getNextRoll = async (className, section) => {
      const key = `${className}|${section}`;
      if (rollCounters[key] === undefined) {
        const classStudents = await base44.asServiceRole.entities.Student.filter(
          { class_name: className, section, academic_year: nextYear },
          'roll_no', 10000
        );
        const maxRoll = classStudents.reduce((max, s) => {
          const r = parseInt(s.roll_no);
          return !isNaN(r) && r > max ? r : max;
        }, 0);
        rollCounters[key] = maxRoll;
      }
      rollCounters[key] += 1;
      return rollCounters[key];
    };

    let promoted = 0, graduated = 0, skipped = 0;
    const warnings = [];

    for (const student of eligible) {
      const nextClass = getNextClass(student.class_name);

      if (nextClass) {
        // ── STEP 4: Duplicate check ──
        if (existingStudentIds.has(student.student_id)) {
          warnings.push(`Skipped duplicate: ${student.name} (${student.student_id}) already in ${nextYear}`);
          skipped++;
          continue;
        }

        const newRoll = await getNextRoll(nextClass, student.section || 'A');

        // ── STEP 3a: Create NEW record — do NOT touch old record ──
        await base44.asServiceRole.entities.Student.create({
          student_id: student.student_id,
          name: student.name,
          username: student.username,
          password: student.password,
          photo_url: student.photo_url,
          class_name: nextClass,
          section: student.section || 'A',
          roll_no: newRoll,
          parent_name: student.parent_name,
          parent_phone: student.parent_phone,
          parent_email: student.parent_email,
          dob: student.dob,
          gender: student.gender,
          address: student.address,
          blood_group: student.blood_group,
          admission_date: student.admission_date,
          academic_year: nextYear,
          status: 'Published',
        });

        existingStudentIds.add(student.student_id); // prevent re-entry in same batch

        await base44.asServiceRole.entities.AuditLog.create({
          action: 'STUDENT_PROMOTED',
          module: 'Student',
          performed_by: user.email,
          details: `${student.name} (${student.student_id}) promoted from ${academicYear} (Class ${student.class_name}) to ${nextYear} (Class ${nextClass})`,
          academic_year: academicYear,
        });

        promoted++;
      } else {
        // ── STEP 3b: Class 10 → mark Passed Out on existing record ──
        await base44.asServiceRole.entities.Student.update(student.id, {
          status: 'Passed Out',
        });

        await base44.asServiceRole.entities.AuditLog.create({
          action: 'STUDENT_GRADUATED',
          module: 'Student',
          performed_by: user.email,
          details: `${student.name} (${student.student_id}) graduated from Class 10 in ${academicYear}`,
          academic_year: academicYear,
        });

        graduated++;
      }
    }

    return Response.json({
      success: true,
      promoted,
      graduated,
      skipped,
      nextYear,
      warnings,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});