import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (user?.role !== 'admin') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Fetch all submissions missing academic_year
  const allSubmissions = await base44.asServiceRole.entities.HomeworkSubmission.filter({}, '-created_date', 500);
  const missing = allSubmissions.filter(s => !s.academic_year);

  if (missing.length === 0) {
    return Response.json({ fixed: 0, message: 'No submissions missing academic_year' });
  }

  // Collect unique homework IDs
  const homeworkIds = [...new Set(missing.map(s => s.homework_id))];

  // Fetch each homework record
  const homeworkMap = {};
  await Promise.all(homeworkIds.map(async (hwId) => {
    const records = await base44.asServiceRole.entities.Homework.filter({ id: hwId }, undefined, 1);
    if (records.length > 0 && records[0].academic_year) {
      homeworkMap[hwId] = records[0].academic_year;
    }
  }));

  // Update each submission that has a resolvable academic_year
  let fixed = 0;
  let skipped = 0;
  await Promise.all(missing.map(async (sub) => {
    const ay = homeworkMap[sub.homework_id];
    if (!ay) { skipped++; return; }
    await base44.asServiceRole.entities.HomeworkSubmission.update(sub.id, { academic_year: ay });
    fixed++;
  }));

  return Response.json({ fixed, skipped, message: `Fixed ${fixed} submissions, skipped ${skipped} (homework also has no academic_year)` });
});