import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { className, section, academicYear } = await req.json();

    console.log('[DIAGNOSTIC] Query params:', { className, section, academicYear });

    // Get ALL marks for this class/section/year to see the schema
    const allMarks = await base44.asServiceRole.entities.Marks.filter({
      class_name: className,
      section: section,
      academic_year: academicYear
    });

    console.log('[DIAGNOSTIC] Total marks found:', allMarks.length);

    if (allMarks.length === 0) {
      return Response.json({
        error: 'No marks found for this class/section/year',
        query: { className, section, academicYear },
        count: 0
      }, { status: 404 });
    }

    // Group by exam_type and show structure
    const byExam = {};
    allMarks.forEach(m => {
      if (!byExam[m.exam_type]) {
        byExam[m.exam_type] = [];
      }
      byExam[m.exam_type].push({
        id: m.id,
        student_id: m.student_id,
        exam_type: m.exam_type,
        status: m.status,
        class_name: m.class_name,
        section: m.section,
        academic_year: m.academic_year
      });
    });

    // Show first mark from each exam group
    const sample = Object.entries(byExam).map(([examType, marks]) => ({
      exam_type: examType,
      count: marks.length,
      firstMark: marks[0],
      statuses: marks.map(m => m.status)
    }));

    return Response.json({
      success: true,
      totalMarks: allMarks.length,
      examGroups: sample,
      query: { className, section, academicYear }
    });
  } catch (error) {
    console.error('[DIAGNOSTIC] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});