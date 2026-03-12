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

    // Only unlock marks in the provided IDs that are in unlockable statuses
    const marksToUnlock = scopedMarks.filter(m =>
      marksIds.includes(m.id) &&
      ['Submitted', 'Published'].includes(m.status)
    );

    if (marksToUnlock.length === 0) {
      return Response.json({ error: 'No marks found in unlockable state (Submitted/Published)' }, { status: 404 });
    }

    await Promise.all(marksToUnlock.map(m =>
      base44.asServiceRole.entities.Marks.update(m.id, { status: 'Draft' })
    ));

    // Get authenticated user email for audit log
    const authenticatedUser = await base44.auth.me().catch(() => null);
    const performedBy = authenticatedUser?.email || user.email || 'system';

    // Audit log for unlock action
    await base44.asServiceRole.entities.AuditLog.create({
      action: 'marks_unlocked',
      module: 'Marks',
      date: new Date().toISOString().split('T')[0],
      performed_by: performedBy,
      details: JSON.stringify({
        records_unlocked: marksToUnlock.length,
        marks_ids: marksIds,
        class_name: className || '',
        section: section || '',
        exam_type: examType || '',
        academic_year: academicYear || '',
        status_transition: 'Submitted/Published → Draft',
        timestamp: new Date().toISOString(),
        unlocked_by_email: performedBy
      }),
      academic_year: academicYear || ''
    });

    return Response.json({
      success: true,
      message: `Unlocked ${marksToUnlock.length} marks for editing`,
      records_unlocked: marksToUnlock.length,
      new_status: 'Draft'
    });
  } catch (error) {
    console.error('Marks unlock error:', error);
    return Response.json({ error: error.message || 'Failed to unlock marks' }, { status: 500 });
  }
});