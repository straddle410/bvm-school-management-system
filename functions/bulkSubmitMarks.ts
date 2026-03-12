import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const {
      marksData,    // array of mark objects with student_id, subject, exam_type, marks_obtained, etc.
      status,       // 'Draft' or 'Submitted'
      staffInfo,
      className,
      section,
      academicYear
    } = await req.json();

    if (!staffInfo || !staffInfo.staff_id) {
      return Response.json({ error: 'Unauthorized: Missing staff info' }, { status: 401 });
    }

    if (!marksData || !Array.isArray(marksData) || marksData.length === 0) {
      return Response.json({ error: 'marksData array required' }, { status: 400 });
    }

    if (!status || !['Draft', 'Submitted'].includes(status)) {
      return Response.json({ error: 'Valid status required (Draft or Submitted)' }, { status: 400 });
    }

    if (!className || !section || !academicYear) {
      return Response.json({ error: 'className, section, and academicYear required' }, { status: 400 });
    }

    // Validate all marks have required fields
    const invalidMarks = marksData.filter(m => !m.student_id || !m.subject || !m.exam_type);
    if (invalidMarks.length > 0) {
      return Response.json({
        error: `Invalid marks data. All marks must have student_id, subject, and exam_type`,
        invalid_count: invalidMarks.length
      }, { status: 400 });
    }

    // Verify exam types exist and belong to correct academic year
    const uniqueExamTypes = [...new Set(marksData.map(m => m.exam_type))];
    const examTypes = await base44.asServiceRole.entities.ExamType.filter({
      academic_year: academicYear
    });
    const examTypeMap = {};
    examTypes.forEach(et => {
      examTypeMap[et.id] = et;
      examTypeMap[et.name] = et;
    });

    for (const examTypeId of uniqueExamTypes) {
      const examType = examTypeMap[examTypeId];
      if (!examType) {
        return Response.json({
          error: `Exam type "${examTypeId}" not found for academic year "${academicYear}"`,
          status: 400
        });
      }
    }

    // SINGLE filter query to get ALL existing marks for this class/section/exam (memory comparison instead of loop filters)
    const existingMarksInClass = await base44.asServiceRole.entities.Marks.filter({
      class_name: className,
      section: section,
      academic_year: academicYear
    });

    // Build map for fast O(1) lookup
    const existingMarksMap = {};
    existingMarksInClass.forEach(mark => {
      const key = `${mark.student_id}|${mark.subject}|${mark.exam_type}`;
      existingMarksMap[key] = mark.id;
    });

    // Prepare bulk data - separate creates and updates (all comparisons done in memory)
    const creates = [];
    const updates = [];

    marksData.forEach(markData => {
      const examTypeRecord = examTypeMap[markData.exam_type];
      const normalizedMark = {
        ...markData,
        exam_type: examTypeRecord.id,
        exam_type_name: examTypeRecord.name,
        status,
        class_name: className,
        section,
        academic_year: academicYear
      };

      const key = `${markData.student_id}|${markData.subject}|${examTypeRecord.id}`;
      const existingId = existingMarksMap[key];

      if (existingId) {
        updates.push({ id: existingId, data: normalizedMark });
      } else {
        creates.push(normalizedMark);
      }
    });

    // Execute bulk operations
    let createdCount = 0;
    let updatedCount = 0;

    if (creates.length > 0) {
      const createdMarks = await base44.asServiceRole.entities.Marks.bulkCreate(creates);
      createdCount = createdMarks.length;
    }

    if (updates.length > 0) {
      // Bulk update all at once instead of individual updates
      await Promise.all(updates.map(({ id, data }) =>
        base44.asServiceRole.entities.Marks.update(id, data)
      ));
      updatedCount = updates.length;
    }

    // Create audit log
    await base44.asServiceRole.entities.AuditLog.create({
      action: 'marks_submitted_bulk',
      module: 'Marks',
      date: new Date().toISOString().split('T')[0],
      performed_by: staffInfo.email || 'system',
      details: JSON.stringify({
        total_records: marksData.length,
        created: createdCount,
        updated: updatedCount,
        class_name: className,
        section,
        status,
        timestamp: new Date().toISOString()
      }),
      academic_year: academicYear
    });

    return Response.json({
      success: true,
      message: `Bulk marks ${status === 'Submitted' ? 'submitted' : 'saved'} successfully`,
      created: createdCount,
      updated: updatedCount,
      total: createdCount + updatedCount
    });
  } catch (error) {
    console.error('Bulk marks submission error:', error);
    return Response.json(
      { error: error.message || 'Failed to submit marks in bulk' },
      { status: 500 }
    );
  }
});