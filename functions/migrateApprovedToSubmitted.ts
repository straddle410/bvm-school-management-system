import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !['admin', 'principal'].includes((user.role || '').toLowerCase())) {
      return Response.json({ error: 'Forbidden: Admin only' }, { status: 403 });
    }

    const { examType, className, section, academicYear } = await req.json();

    if (!examType || !className || !academicYear) {
      return Response.json({ error: 'Required: examType, className, academicYear' }, { status: 400 });
    }

    // Fetch all marks with "Approved" status for this exam
    const approvedMarks = await base44.asServiceRole.entities.Marks.filter({
      exam_type: examType,
      class_name: className,
      section: section || undefined,
      academic_year: academicYear,
      status: 'Approved'
    });

    console.log('[migrateApprovedToSubmitted] Found', approvedMarks.length, 'Approved marks');

    if (approvedMarks.length === 0) {
      return Response.json({ 
        success: true, 
        message: 'No Approved marks found to migrate',
        count: 0
      });
    }

    // Revert all "Approved" marks to "Submitted"
    const updateResults = await Promise.all(
      approvedMarks.map(mark =>
        base44.asServiceRole.entities.Marks.update(mark.id, {
          status: 'Submitted',
          verified_by: null,
          approved_by: null
        })
      )
    );

    return Response.json({
      success: true,
      message: `Migrated ${approvedMarks.length} marks from Approved to Submitted`,
      count: updateResults.length,
      examType,
      className,
      section,
      academicYear
    });
  } catch (error) {
    console.error('[migrateApprovedToSubmitted] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});