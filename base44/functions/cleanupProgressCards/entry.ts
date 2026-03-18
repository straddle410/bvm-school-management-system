import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = String(user?.role || '').trim().toLowerCase();
    if (!['admin', 'principal'].includes(role)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { academicYear, classNameFilter, sectionFilter, examTypeIdOrName } = await req.json();

    if (!academicYear || !classNameFilter || !sectionFilter || !examTypeIdOrName) {
      return Response.json({ error: 'Academic year, class, section, and exam type are required' }, { status: 400 });
    }

    // Normalize class name
    const normalizeClassName = (name) => {
      if (!name) return name;
      const str = name.toString().trim();
      return /^[0-9]$/.test(str) || ['Nursery', 'LKG', 'UKG'].includes(str) ? str : str.replace(/^Class\s*/i, '');
    };

    const normalizedClass = normalizeClassName(classNameFilter);

    // Fetch ALL exam types to find the ID
    const examTypes = await base44.asServiceRole.entities.ExamType.list();
    const selectedExam = examTypes.find(et => et.id === examTypeIdOrName || et.name === examTypeIdOrName);
    const examTypeId = selectedExam?.id;

    // Fetch all progress cards matching class/section
    const allCards = await base44.asServiceRole.entities.ProgressCard.filter({
      academic_year: academicYear,
      class_name: normalizedClass,
      section: sectionFilter
    });

    let deletedCount = 0;
    let processedCount = 0;

    // Delete ALL cards for this exam type (no condition, just delete)
    for (const card of allCards) {
      processedCount++;
      const cardExamType = card.exam_performance?.[0]?.exam_type;
      
      // Match by ID or name
      if (cardExamType === examTypeId || cardExamType === examTypeIdOrName || cardExamType === selectedExam?.name) {
        try {
          await base44.asServiceRole.entities.ProgressCard.delete(card.id);
          deletedCount++;
        } catch (error) {
          console.error(`Failed to delete card ${card.id}: ${error.message}`);
        }
      }
    }

    console.log(`[CLEANUP] Academic Year: ${academicYear}, Class: ${normalizedClass}, Section: ${sectionFilter}, Exam: ${selectedExam?.name || examTypeIdOrName}, Processed: ${processedCount}, Deleted: ${deletedCount}`);

    return Response.json({
      message: `Cleanup complete: Deleted ${deletedCount} progress cards for Class ${classNameFilter}, Section ${sectionFilter}, Exam Type ${selectedExam?.name || examTypeIdOrName}`,
      deletedCount: deletedCount,
      processedCount: processedCount
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return Response.json({ error: error.message || 'Cleanup failed' }, { status: 500 });
  }
});