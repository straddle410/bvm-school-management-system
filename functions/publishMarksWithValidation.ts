import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.role || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const {
      marksIds,
      examType,
      className,
      section,
      academicYear
    } = await req.json();

    if (!marksIds || !Array.isArray(marksIds) || marksIds.length === 0) {
      return Response.json({ error: 'marksIds array required' }, { status: 400 });
    }

    if (!examType || !className || !academicYear) {
      return Response.json({
        error: 'Required: examType, className, academicYear'
      }, { status: 400 });
    }

    // ========================================
    // FETCH ALL MARKS BEING PUBLISHED
    // ========================================
    const allMarks = await base44.asServiceRole.entities.Marks.filter({
      class_name: className,
      exam_type: examType,
      academic_year: academicYear
    });

    const marksToPublish = allMarks.filter(m => marksIds.includes(m.id));

    if (marksToPublish.length === 0) {
      return Response.json({
        error: 'No marks found matching the provided IDs'
      }, { status: 404 });
    }

    // ========================================
    // VALIDATION: Check all can be published
    // ========================================
    const publishableStatuses = ['Verified', 'Approved'];
    const notPublishable = marksToPublish.filter(m =>
      m.status === 'Published' || !publishableStatuses.includes(m.status)
    );

    if (notPublishable.length > 0) {
      return Response.json({
        error: `Cannot publish. ${notPublishable.length} mark(s) not in publishable status (Verified/Approved).`,
        invalid_marks: notPublishable.map(m => ({
          id: m.id,
          student: m.student_name,
          subject: m.subject,
          status: m.status
        }))
      }, { status: 400 });
    }

    // ========================================
    // CREATE IMMUTABLE AUDIT LOG ENTRY
    // ========================================
    const previousStatus = marksToPublish[0]?.status || 'Verified';

    const auditLog = await base44.asServiceRole.entities.AuditLog.create({
      action: 'marks_published',
      module: 'Marks',
      date: new Date().toISOString().split('T')[0],
      performed_by: user.email,
      details: JSON.stringify({
        exam_type: examType,
        class_name: className,
        section: section || 'A',
        academic_year: academicYear,
        records_published: marksIds.length,
        status_transition: `${previousStatus} → Published`,
        marks_ids: marksIds,
        timestamp: new Date().toISOString(),
        published_by_email: user.email
      }),
      academic_year: academicYear
    });

    // ========================================
    // PUBLISH ALL MARKS (atomically)
    // ========================================
    const updatePromises = marksIds.map(id =>
      base44.asServiceRole.entities.Marks.update(id, {
        status: 'Published',
        verified_by: user?.email,
        approved_by: user?.email
      })
    );

    const publishResults = await Promise.all(updatePromises);

    return Response.json({
      success: true,
      message: `Published ${marksIds.length} marks for ${className} (${examType}, ${academicYear})`,
      records_published: marksIds.length,
      audit_log_id: auditLog.id,
      status_transition: `${previousStatus} → Published`,
      published_by: user.email,
      timestamp: new Date().toISOString()
    }, { status: 200 });
  } catch (error) {
    console.error('Marks publish error:', error);
    return Response.json(
      { error: error.message || 'Failed to publish marks' },
      { status: 500 }
    );
  }
});