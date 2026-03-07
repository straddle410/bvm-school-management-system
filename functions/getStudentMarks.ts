import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * PRIORITY 3 — MARKS ACCESS SECURITY
 * Serves ONLY Published marks for a specific student.
 * Marks entity has RLS read:false, so direct frontend access is blocked.
 * This function is the ONLY authorized path for students to read their marks.
 * 
 * Security guarantees:
 * - Only status: 'Published' records are returned
 * - Filtered strictly by student_id + academic_year
 * - No Draft, Submitted, Verified, or Approved marks ever returned
 */
Deno.serve(async (req) => {
  try {
    const { student_id, academic_year } = await req.json();

    if (!student_id) {
      return Response.json({ error: 'student_id required' }, { status: 400 });
    }
    if (!academic_year) {
      return Response.json({ error: 'academic_year required' }, { status: 400 });
    }

    const base44 = createClientFromRequest(req);

    // Service role required — Marks RLS is read:false
    // CRITICAL: always filter status:'Published' + student_id — never return draft/submitted marks
    const marks = await base44.asServiceRole.entities.Marks.filter(
      {
        student_id,
        academic_year,
        status: 'Published'
      },
      '-created_date',
      200
    );

    // Sanitize response — strip any internal workflow fields before returning to student
    const safeMarks = (marks || []).map(m => ({
      id: m.id,
      student_id: m.student_id,
      student_name: m.student_name,
      class_name: m.class_name,
      section: m.section,
      subject: m.subject,
      exam_type: m.exam_type,
      // PRIORITY 2: use exam_type_name (denormalized display name), never expose raw UUID alone
      exam_type_name: m.exam_type_name || m.exam_type,
      marks_obtained: m.marks_obtained,
      max_marks: m.max_marks,
      grade: m.grade,
      remarks: m.remarks,
      academic_year: m.academic_year,
      status: m.status
      // Intentionally omit: entered_by, verified_by, approved_by (internal workflow fields)
    }));

    return Response.json({ marks: safeMarks });
  } catch (error) {
    console.error('getStudentMarks error:', error);
    return Response.json({ error: error.message || 'Failed to fetch marks' }, { status: 500 });
  }
});