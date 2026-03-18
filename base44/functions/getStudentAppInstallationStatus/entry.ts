import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Fetch all students and notification preferences
    const allStudents = await base44.entities.Student.list();
    const allPrefs = await base44.entities.StudentNotificationPreference.list();

    // Create a map of student_id -> preference for quick lookup
    const prefsMap = new Map();
    allPrefs.forEach(pref => {
      prefsMap.set(pref.student_id, pref);
    });

    // Classify students
    const installed_students = [];
    const not_installed_students = [];

    allStudents.forEach(student => {
      const pref = prefsMap.get(student.student_id);
      const hasToken = pref?.browser_push_token;

      const studentInfo = {
        student_id: student.student_id,
        name: student.name,
        class_name: student.class_name,
        section: student.section,
      };

      if (pref && hasToken) {
        installed_students.push(studentInfo);
      } else {
        not_installed_students.push(studentInfo);
      }
    });

    // Calculate stats
    const total_students = allStudents.length;
    const app_installed_count = installed_students.length;
    const app_not_installed_count = not_installed_students.length;
    const installation_rate = total_students > 0 ? Math.round((app_installed_count / total_students) * 100) : 0;

    return Response.json({
      summary: {
        total_students,
        app_installed_count,
        app_not_installed_count,
        installation_rate,
      },
      installed_students,
      not_installed_students,
    });
  } catch (error) {
    console.error('getStudentAppInstallationStatus error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});