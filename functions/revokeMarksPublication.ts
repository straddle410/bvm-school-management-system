import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const ALLOWED_ROLES = ['admin', 'principal'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { marksIds, className, section, examType, academicYear, staffInfo } = await req.json();
    if (!staffInfo || !staffInfo.staff_id) {
      return Response.json({ error: 'Unauthorized: Missing staff info' }, { status: 401 });
    }
    const user = staffInfo;
    const role = String(staffInfo.role || '').trim().toLowerCase();
    if (!ALLOWED_ROLES.includes(role)) {
      return Response.json({ error: 'Forbidden: admin or principal only' }, { status: 403 });
    }

    if (!marksIds || !Array.isArray(marksIds) || marksIds.length === 0) {
      return Response.json({ error: 'marksIds array required' }, { status: 400 });
    }

    // Scoped query — never full table scan
    const filter = {};
    if (academicYear) filter.academic_year = academicYear;
    if (className) filter.class_name = className;
    if (section) filter.section = section;
    if (examType) filter.exam_type = examType;

    const scopedMarks = Object.keys(filter).length > 0
      ? await base44.asServiceRole.entities.Marks.filter(filter)
      : [];

    const marksToRevoke = scopedMarks.filter(m =>
      marksIds.includes(m.id) && m.status === 'Published'
    );

    if (marksToRevoke.length === 0) {
      return Response.json({ error: 'No published marks found to revoke' }, { status: 404 });
    }

    await Promise.all(marksToRevoke.map(m =>
     base44.asServiceRole.entities.Marks.update(m.id, { status: 'Submitted' })
    ));

    await base44.asServiceRole.entities.AuditLog.create({
     action: 'marks_publication_revoked',
     module: 'Marks',
     date: new Date().toISOString().split('T')[0],
     performed_by: user.email,
     details: JSON.stringify({
       records_revoked: marksToRevoke.length,
       marks_ids: marksIds,
       class_name: className || '',
       section: section || '',
       exam_type: examType || '',
       academic_year: academicYear || '',
       status_transition: 'Published → Submitted',
       timestamp: new Date().toISOString(),
       revoked_by_email: user.email
     }),
     academic_year: academicYear || ''
    });

    return Response.json({
     success: true,
     message: `Revoked publication of ${marksToRevoke.length} marks`,
     records_revoked: marksToRevoke.length,
     new_status: 'Submitted'
    });
  } catch (error) {
    console.error('Marks revocation error:', error);
    return Response.json({ error: error.message || 'Failed to revoke marks publication' }, { status: 500 });
  }
});