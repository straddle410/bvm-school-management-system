import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all students without student_id
    const studentsWithoutId = await base44.asServiceRole.entities.Student.filter({ student_id: null }, '', 1000);
    
    if (studentsWithoutId.length === 0) {
      return Response.json({ message: 'No students without IDs', processed: 0 });
    }

    const results = [];

    for (const student of studentsWithoutId) {
      try {
        if (!student.academic_year) {
          results.push({ studentId: student.id, name: student.name, status: 'SKIPPED', reason: 'No academic_year set' });
          continue;
        }

        // Generate student ID inline for this year
        const year = student.academic_year;
        const match = year.match(/^(\d{4})-(\d{2})$/);
        if (!match) {
          results.push({ studentId: student.id, name: student.name, status: 'SKIPPED', reason: 'Invalid academic_year format' });
          continue;
        }
        
        const startYear = match[1];
        const yy = startYear.slice(2);
        const counterKey = `student_id_${startYear}`;

        // Get or create counter
        let counter = await base44.asServiceRole.entities.Counter.filter({ key: counterKey });
        counter = counter[0];

        let nextValue;
        if (!counter) {
          // Find max existing ID for this year prefix
          const allStudents = await base44.asServiceRole.entities.Student.list('', 10000);
          const pattern = new RegExp(`^S${yy}(\\d{3})$`, 'i');
          const existing = allStudents
            .map(s => s.student_id)
            .filter(id => id && pattern.test(id))
            .map(id => {
              const m = id.match(/^S\d{2}(\d{3})$/i);
              return m ? parseInt(m[1], 10) : 0;
            });
          const maxExisting = existing.length > 0 ? Math.max(...existing) : 0;
          nextValue = maxExisting + 1;
          
          counter = await base44.asServiceRole.entities.Counter.create({
            key: counterKey,
            current_value: nextValue
          });
        } else {
          nextValue = (counter.current_value || 0) + 1;
          await base44.asServiceRole.entities.Counter.update(counter.id, { current_value: nextValue });
        }

        const student_id = `S${yy}${String(nextValue).padStart(3, '0')}`;
        const student_id_norm = student_id.toLowerCase();

        // Update student with generated ID and username
        await base44.asServiceRole.entities.Student.update(student.id, {
          student_id,
          student_id_norm,
          username: student.username || student_id,
          must_change_password: true
        });

        results.push({
          studentId: student.id,
          name: student.name,
          class: student.class_name,
          section: student.section,
          assignedId: student_id,
          status: 'SUCCESS'
        });
      } catch (e) {
        results.push({
          studentId: student.id,
          name: student.name,
          status: 'ERROR',
          reason: e.message
        });
      }
    }

    const successful = results.filter(r => r.status === 'SUCCESS').length;
    const failed = results.filter(r => r.status === 'ERROR').length;

    return Response.json({
      message: `Processed ${results.length} students`,
      successful,
      failed,
      results
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});