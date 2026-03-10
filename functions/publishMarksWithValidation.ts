import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const ALLOWED_ROLES = ['admin', 'principal'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = String(user.role || '').trim().toLowerCase();
    if (!ALLOWED_ROLES.includes(role)) {
      return Response.json({ error: 'Forbidden: admin or principal only' }, { status: 403 });
    }

    const { marksIds, examType, className, section, academicYear } = await req.json();
    
    console.log('[PUB_BACKEND_PAYLOAD] Received:', { marksIds: marksIds?.length, examType: typeof examType === 'string' ? examType.substring(0, 20) : examType, className, section, academicYear });

    if (!marksIds || !Array.isArray(marksIds) || marksIds.length === 0) {
      return Response.json({ error: 'marksIds array required' }, { status: 400 });
    }
    if (!examType || !className || !academicYear) {
      return Response.json({ error: 'Required: examType, className, academicYear' }, { status: 400 });
    }

    // Fetch only the specific marks being published (by section + class + exam)
    console.log('[PUB_BACKEND_FILTER] About to filter Marks with:', { class_name: className, section: section || 'undefined', exam_type: examType, academic_year: academicYear });
    const allMarks = await base44.asServiceRole.entities.Marks.filter({
      class_name: className,
      section: section || undefined,
      exam_type: examType,
      academic_year: academicYear
    });
    
    console.log('[PUB_BACKEND_FOUND] Found', allMarks.length, 'total marks matching filter');
    if (allMarks.length > 0) {
      console.log('[PUB_BACKEND_SAMPLE_MARK] First mark:', { id: allMarks[0].id, exam_type: allMarks[0].exam_type, class_name: allMarks[0].class_name, section: allMarks[0].section, status: allMarks[0].status });
    }

    const marksToPublish = allMarks.filter(m => marksIds.includes(m.id));
    console.log('[PUB_BACKEND_MATCHING] Matched', marksToPublish.length, 'marks from provided IDs');

    if (marksToPublish.length === 0) {
      return Response.json({ error: 'No marks found matching the provided IDs' }, { status: 404 });
    }

    // VALIDATION: Only Submitted, Verified or Approved marks can be published
    const notPublishable = marksToPublish.filter(m =>
      !['Submitted', 'Verified', 'Approved'].includes(m.status)
    );

    if (notPublishable.length > 0) {
      return Response.json({
        error: `Cannot publish. ${notPublishable.length} mark(s) are in status "${notPublishable[0].status}" — only Submitted, Verified or Approved marks can be published.`,
        invalid_marks: notPublishable.map(m => ({
          id: m.id,
          student: m.student_name,
          subject: m.subject,
          status: m.status
        }))
      }, { status: 400 });
    }

    // Already-published marks
    const alreadyPublished = allMarks.filter(m => marksIds.includes(m.id) && m.status === 'Published');
    if (alreadyPublished.length === marksIds.length) {
      return Response.json({ error: 'All selected marks are already published' }, { status: 400 });
    }

    const previousStatus = marksToPublish[0]?.status || 'Verified';

    // Audit log
    await base44.asServiceRole.entities.AuditLog.create({
      action: 'marks_published',
      module: 'Marks',
      date: new Date().toISOString().split('T')[0],
      performed_by: user.email,
      details: JSON.stringify({
        exam_type: examType,
        class_name: className,
        section: section || '',
        academic_year: academicYear,
        records_published: marksIds.length,
        status_transition: `${previousStatus} → Published`,
        marks_ids: marksIds,
        timestamp: new Date().toISOString(),
        published_by_email: user.email
      }),
      academic_year: academicYear
    });

    // Publish
    await Promise.all(marksIds.map(id =>
      base44.asServiceRole.entities.Marks.update(id, {
        status: 'Published',
        verified_by: user.email,
        approved_by: user.email
      })
    ));

    return Response.json({
      success: true,
      message: `Published ${marksIds.length} marks for ${className}${section ? ' ' + section : ''} (${examType}, ${academicYear})`,
      records_published: marksIds.length,
      status_transition: `${previousStatus} → Published`,
      published_by: user.email,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Marks publish error:', error);
    return Response.json({ error: error.message || 'Failed to publish marks' }, { status: 500 });
  }
});

// Marks publish endpoint deployed - v2 clean redeploy 2026-03-10