import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { markData, markId } = await req.json();

    if (!markData) {
      return Response.json({ error: 'markData required' }, { status: 400 });
    }

    const {
      student_id,
      subject,
      exam_type,
      academic_year,
      class_name
    } = markData;

    if (!student_id || !subject || !exam_type || !academic_year || !class_name) {
      return Response.json({ 
        error: 'Missing required fields: student_id, subject, exam_type, academic_year, class_name' 
      }, { status: 400 });
    }

    // Query for existing marks with same unique key
    const existingMarks = await base44.asServiceRole.entities.Marks.filter({
      student_id,
      subject,
      exam_type,
      academic_year,
      class_name
    });

    // If updating: only fail if a DIFFERENT record has the same key
    if (markId) {
      const duplicates = existingMarks.filter(m => m.id !== markId);
      if (duplicates.length > 0) {
        return Response.json({
          error: `Duplicate mark record exists for this student-subject-exam combination. Cannot have multiple marks for the same student, subject, exam type, and academic year.`,
          status: 'CONFLICT',
          existing_record_id: duplicates[0].id,
          existing_record_status: duplicates[0].status
        }, { status: 409 });
      }
    } else {
      // Creating new: fail if ANY record exists
      if (existingMarks.length > 0) {
        return Response.json({
          error: `Duplicate mark record already exists. Student ${student_id} already has marks for ${subject} in ${exam_type} (${academic_year}, ${class_name}).`,
          status: 'CONFLICT',
          existing_record_id: existingMarks[0].id,
          existing_record_status: existingMarks[0].status
        }, { status: 409 });
      }
    }

    // No duplicates found
    return Response.json({
      valid: true,
      message: 'Mark record is unique (no conflicts)',
      status: 'OK'
    }, { status: 200 });
  } catch (error) {
    console.error('Marks uniqueness validation error:', error);
    return Response.json(
      { error: error.message || 'Validation failed' },
      { status: 500 }
    );
  }
});