import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const staffRaw = req.headers.get('x-staff-session');
    let staffRole = '';
    if (staffRaw) {
      try { staffRole = JSON.parse(staffRaw).role || ''; } catch {}
    }

    if (!['admin', 'principal'].includes(staffRole.toLowerCase())) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { page = 1, limit = 50 } = await req.json();
    const offset = (page - 1) * limit;

    // Fetch all prefs and students
    const allPrefs = await base44.asServiceRole.entities.StudentNotificationPreference.filter({});
    const allStudents = await base44.asServiceRole.entities.Student.filter({});

    // Create student map
    const studentMap = new Map(allStudents.map(s => [s.student_id, s]));

    // Classify students
    const pushEnabledStudents = [];
    const pushNotEnabledStudents = [];

    for (const pref of allPrefs) {
      const student = studentMap.get(pref.student_id);
      if (!student) continue;

      const isPushEnabled = pref.browser_push_token && pref.browser_push_enabled;
      const studentData = {
        student_id: student.student_id,
        name: student.name,
        class_name: student.class_name,
        section: student.section,
        push_enabled_date: pref.updated_date,
      };

      if (isPushEnabled) {
        pushEnabledStudents.push(studentData);
      } else {
        pushNotEnabledStudents.push(studentData);
      }
    }

    // Sort by name
    pushEnabledStudents.sort((a, b) => a.name.localeCompare(b.name));
    pushNotEnabledStudents.sort((a, b) => a.name.localeCompare(b.name));

    const totalStudents = allStudents.length;
    const pushEnabledCount = pushEnabledStudents.length;
    const pushNotEnabledCount = pushNotEnabledStudents.length;
    const adoptionRate = totalStudents > 0 ? ((pushEnabledCount / totalStudents) * 100).toFixed(2) : 0;

    // Apply pagination
    const paginatedEnabled = pushEnabledStudents.slice(offset, offset + limit);
    const paginatedNotEnabled = pushNotEnabledStudents.slice(offset, offset + limit);

    return Response.json({
      success: true,
      summary: {
        push_enabled_count: pushEnabledCount,
        push_not_enabled_count: pushNotEnabledCount,
        total_students: totalStudents,
        adoption_rate: parseFloat(adoptionRate),
      },
      push_enabled_students: paginatedEnabled,
      push_not_enabled_students: paginatedNotEnabled,
      pagination: {
        page,
        limit,
        total_enabled: pushEnabledCount,
        total_not_enabled: pushNotEnabledCount,
      },
    });
  } catch (error) {
    console.error('[getStudentPushStatus] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});