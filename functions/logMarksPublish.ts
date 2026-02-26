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
      academicYear,
      previousStatus,
      recordCount
    } = await req.json();

    if (!marksIds || !Array.isArray(marksIds) || marksIds.length === 0) {
      return Response.json({ error: 'marksIds array required' }, { status: 400 });
    }

    if (!examType || !className || !academicYear || !recordCount) {
      return Response.json({
        error: 'Required fields: examType, className, academicYear, recordCount'
      }, { status: 400 });
    }

    // Create immutable audit log entry
    const auditLog = await base44.asServiceRole.entities.AuditLog.create({
      action: 'marks_published',
      module: 'Marks',
      date: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
      performed_by: user.email,
      details: JSON.stringify({
        exam_type: examType,
        class_name: className,
        section: section || 'A',
        academic_year: academicYear,
        records_published: recordCount,
        status_transition: `${previousStatus || 'Verified'} → Published`,
        marks_ids: marksIds,
        timestamp: new Date().toISOString(),
        published_by_email: user.email
      }),
      academic_year: academicYear
    });

    return Response.json({
      success: true,
      audit_log_id: auditLog.id,
      message: `Published ${recordCount} marks for ${className} (${examType}, ${academicYear})`,
      audit_entry: {
        id: auditLog.id,
        action: 'marks_published',
        performed_by: user.email,
        timestamp: new Date().toISOString(),
        records_count: recordCount
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Marks publish audit log error:', error);
    return Response.json(
      { error: error.message || 'Failed to create audit log' },
      { status: 500 }
    );
  }
});