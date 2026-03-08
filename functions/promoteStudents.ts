import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const CLASS_ORDER = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

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
    const body = await req.json();
    const { academicYear, staff_session_token } = body;

    // Auth: staff session token OR base44.auth.me()
    let user = null;
    let performedBy = 'unknown';

    if (staff_session_token) {
      const payload = await verifyStaffToken(staff_session_token);
      if (payload) {
        user = { email: payload.email, role: payload.role };
        performedBy = payload.email || payload.username || 'staff';
      }
    }

    if (!user) {
      const baseUser = await base44.auth.me().catch(() => null);
      if (baseUser) {
        user = baseUser;
        performedBy = baseUser.email || 'unknown';
      }
    }

    if (!user || (user.role !== 'admin' && user.role !== 'principal')) {
      return Response.json({ error: 'Unauthorized: Admin or Principal access required' }, { status: 401 });
    }
    if (!academicYear || !academicYear.trim()) {
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
        performed_by: performedBy,
        details: `Promotion blocked: Academic year ${nextYear} not found. Must be created in Settings first.`,
        academic_year: academicYear,
      });
      return Response.json({
        blocked: true,
        nextYear,
        error: `Academic year ${nextYear} is not created. Please create it in Settings before promoting students.`
      }, { status: 422 });
    }

    // ── STEP 2: Eligible students (Published only, not soft-deleted) ──
    const allStudents = await base44.asServiceRole.entities.Student.filter({ academic_year: academicYear });
    const eligible = allStudents.filter(s => s.status === 'Published' && !s.is_deleted);

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
          performed_by: performedBy,
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
          performed_by: performedBy,
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