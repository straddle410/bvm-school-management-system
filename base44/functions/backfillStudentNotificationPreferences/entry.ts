import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [prefs, students] = await Promise.all([
    base44.asServiceRole.entities.StudentNotificationPreference.list(),
    base44.asServiceRole.entities.Student.list(),
  ]);

  // student_id in prefs is the human-readable ID (S0001), match by student_id field
  const studentMap = new Map(students.map(s => [s.student_id, s]));

  let updated = 0;
  let skipped = 0;

  for (const pref of prefs) {
    const student = studentMap.get(pref.student_id);
    if (!student) { skipped++; continue; }

    const newName = student.name || '';
    if (pref.student_name === newName) { skipped++; continue; }

    await base44.asServiceRole.entities.StudentNotificationPreference.update(pref.id, {
      student_name: newName,
    });
    updated++;
  }

  return Response.json({ success: true, updated, skipped, total: prefs.length });
});