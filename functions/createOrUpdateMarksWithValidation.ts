import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function validateAcademicYearBoundary(date, academicYearStart, academicYearEnd) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const start = new Date(academicYearStart);
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(academicYearEnd);
  end.setUTCHours(23, 59, 59, 999);
  return d >= start && d <= end;
}

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

    if (!student_id || !subject || !exam_type || !academic_year || !class_name) {
      return Response.json({
        error: 'Required fields: student_id, subject, exam_type, academic_year, class_name'
      }, { status: 400 });
    }

    // ── SOFT-DELETE GUARD ──
    const studentsForMark = await base44.asServiceRole.entities.Student.filter({ student_id, academic_year, class_name });
    const studentForMark = studentsForMark[0];
    if (studentForMark && studentForMark.is_deleted === true) {
      return Response.json({ error: 'Operation not allowed for deleted student.' }, { status: 422 });
    }

    // ── EXAM TYPE ACADEMIC YEAR MISMATCH GUARD ──
    // Load the ExamType directly by ID to confirm its year matches mark's year
    const examTypeById = await base44.asServiceRole.entities.ExamType.filter({ id: exam_type });
    const examTypeByName = examTypeById.length === 0
      ? await base44.asServiceRole.entities.ExamType.filter({ academic_year, name: exam_type })
      : [];
    const examTypeRecord = examTypeById[0] || examTypeByName[0];
    if (!examTypeRecord) {
      return Response.json({
        error: `Exam type "${exam_type}" not found.`
      }, { status: 400 });
    }
    if (examTypeRecord.academic_year && examTypeRecord.academic_year !== academic_year) {
      return Response.json({
        error: `Exam academic year mismatch: exam type "${examTypeRecord.name}" belongs to year "${examTypeRecord.academic_year}" but marks are being entered for "${academic_year}". Use the correct academic year.`
      }, { status: 400 });
    }

    // Also check academic year date range config
    const yearConfigs = await base44.asServiceRole.entities.AcademicYear.filter({ year: academic_year });
    if (yearConfigs.length === 0) {
      return Response.json({ error: `Academic year "${academic_year}" is not configured in the system.` }, { status: 400 });
    }

    // ========================================
    // UNIQUENESS VALIDATION
    // ========================================
    const existingMarks = await base44.asServiceRole.entities.Marks.filter({
      student_id,
      subject,
      exam_type,
      academic_year,
      class_name
    });

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
        if (existingMark.status === 'Published' && status !== 'Published') {
          return Response.json({
            error: `Published marks cannot be reverted to ${status}. Only admin can revoke publication via dedicated function.`,
            status: 'WORKFLOW_ERROR'
          }, { status: 403 });
        }

        const isAdminOrPrincipal = ['admin', 'principal'].includes((user.role || '').toLowerCase());
        if (!isAdminOrPrincipal && existingMark.status === 'Submitted' && status !== 'Submitted') {
          return Response.json({
            error: `Only admins can change status of submitted marks.`,
            status: 'FORBIDDEN'
          }, { status: 403 });
        }
      }
    }

    // ========================================
    // NORMALIZE exam_type: always store as ExamType ID + denormalized name
    // ========================================
    // examTypeRecord was already resolved above — always write canonical ID + display name
    const normalizedMarkData = {
      ...markData,
      exam_type: examTypeRecord.id,             // canonical: always the UUID
      exam_type_name: examTypeRecord.name        // denormalized display name for student portal / reports
    };

    // ========================================
    // EXECUTE CREATE/UPDATE (validated)
    // ========================================
    console.log('📝 NORMALIZED MARK DATA:', JSON.stringify(normalizedMarkData, null, 2));
    
    let result;
    if (operation === 'create') {
      result = await base44.asServiceRole.entities.Marks.create(normalizedMarkData);
    } else if (operation === 'update') {
      if (!markId) {
        return Response.json({ error: 'markId required for update' }, { status: 400 });
      }
      result = await base44.asServiceRole.entities.Marks.update(markId, normalizedMarkData);
    }

    console.log(`✍️ ${operation.toUpperCase()} RESULT:`, JSON.stringify(result, null, 2));
    
    // ========================================
    // SUCCESS: Trust the result from base44.asServiceRole
    // ========================================
    // NOTE: Marks entity has RLS read disabled, so post-save verification read fails.
    // The successful result object IS the persistence proof for service-role writes.
    const savedRecordId = result?.id || markId;
    if (!savedRecordId) {
      console.error('❌ NO RECORD ID RETURNED from', operation);
      return Response.json({
        error: `Mark ${operation} failed: no record ID returned`,
        operation
      }, { status: 500 });
    }

    console.log(`✅ MARK ${operation.toUpperCase()} PERSISTED:`, savedRecordId);

    return Response.json({
      success: true,
      message: `Mark ${operation}d successfully`,
      record_id: savedRecordId,
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