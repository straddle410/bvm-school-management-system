import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      markData,
      markId,
      operation // 'create' or 'update'
    } = await req.json();

    if (!markData || !operation) {
      return Response.json({
        error: 'markData and operation (create/update) required'
      }, { status: 400 });
    }

    const {
      student_id,
      subject,
      exam_type,
      academic_year,
      class_name,
      status
    } = markData;

    // Validate required fields
    if (!student_id || !subject || !exam_type || !academic_year || !class_name) {
      return Response.json({
        error: 'Required fields: student_id, subject, exam_type, academic_year, class_name'
      }, { status: 400 });
    }

    // ========================================
    // UNIQUENESS VALIDATION (inside backend)
    // ========================================
    const existingMarks = await base44.asServiceRole.entities.Marks.filter({
      student_id,
      subject,
      exam_type,
      academic_year,
      class_name
    });

    // CREATE operation: fail if ANY record exists
    if (operation === 'create') {
      if (existingMarks.length > 0) {
        return Response.json({
          error: `Duplicate mark record already exists. Student ${student_id} has marks for ${subject} in ${exam_type} (${academic_year}, ${class_name}).`,
          status: 'CONFLICT',
          existing_record_id: existingMarks[0].id,
          existing_record_status: existingMarks[0].status
        }, { status: 409 });
      }
    }

    // UPDATE operation: fail if a DIFFERENT record has the same key
    if (operation === 'update') {
      if (!markId) {
        return Response.json({
          error: 'markId required for update operation'
        }, { status: 400 });
      }

      const duplicates = existingMarks.filter(m => m.id !== markId);
      if (duplicates.length > 0) {
        return Response.json({
          error: `Cannot update. Another mark record exists for this student-subject-exam combination.`,
          status: 'CONFLICT',
          existing_record_id: duplicates[0].id,
          existing_record_status: duplicates[0].status
        }, { status: 409 });
      }
    }

    // ========================================
    // STATUS TRANSITION VALIDATION
    // ========================================
    if (operation === 'update' && markId) {
      const existingMark = existingMarks.find(m => m.id === markId);
      if (existingMark) {
        // Status workflow: Draft → Submitted → Verified → Approved → Published
        // Published cannot transition backward
        if (existingMark.status === 'Published' && status !== 'Published') {
          return Response.json({
            error: `Published marks cannot be reverted to ${status}. Only admin can revoke publication via dedicated function.`,
            status: 'WORKFLOW_ERROR'
          }, { status: 403 });
        }

        // Non-admins cannot change status of submitted marks
        const isAdmin = user.role?.toLowerCase() === 'admin' || user.role?.toLowerCase() === 'principal';
        if (!isAdmin && existingMark.status === 'Submitted' && status !== 'Submitted') {
          return Response.json({
            error: `Only admins can change status of submitted marks.`,
            status: 'FORBIDDEN'
          }, { status: 403 });
        }
      }
    }

    // ========================================
    // EXECUTE CREATE/UPDATE (validated)
    // ========================================
    let result;
    if (operation === 'create') {
      result = await base44.asServiceRole.entities.Marks.create(markData);
    } else if (operation === 'update') {
      if (!markId) {
        return Response.json({
          error: 'markId required for update'
        }, { status: 400 });
      }
      result = await base44.asServiceRole.entities.Marks.update(markId, markData);
    }

    return Response.json({
      success: true,
      message: `Mark ${operation}d successfully`,
      record_id: result?.id || markId,
      operation,
      uniqueness_checked: true,
      status_validated: true
    }, { status: operation === 'create' ? 201 : 200 });
  } catch (error) {
    console.error('Marks operation error:', error);
    return Response.json(
      { error: error.message || 'Failed to process mark' },
      { status: 500 }
    );
  }
});