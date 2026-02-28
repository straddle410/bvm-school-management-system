import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const TRACKED_FIELDS = ['roll_no', 'class_name', 'section', 'name', 'parent_phone', 'parent_email', 'address', 'status'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Only Admin / Principal can update student data
    const role = (user.role || '').toLowerCase();
    if (!['admin', 'principal'].includes(role)) {
      return Response.json({ error: 'Only Admin or Principal can modify student data.' }, { status: 403 });
    }

    const body = await req.json();
    const { student_db_id, updates } = body;

    if (!student_db_id || !updates) {
      return Response.json({ error: 'student_db_id and updates are required' }, { status: 400 });
    }

    // Fetch existing student record
    const existing = await base44.asServiceRole.entities.Student.filter({ id: student_db_id });
    const current = existing[0];
    if (!current) return Response.json({ error: 'Student not found.' }, { status: 404 });
    if (current.is_deleted === true) return Response.json({ error: 'Operation not allowed for deleted student.' }, { status: 422 });

    // Compute changed fields
    const changedFields = [];
    for (const field of TRACKED_FIELDS) {
      if (field in updates) {
        const oldVal = current[field];
        const newVal = updates[field];
        // Normalize for comparison (handle null/undefined vs empty)
        const oldNorm = oldVal === undefined ? null : oldVal;
        const newNorm = newVal === undefined ? null : newVal;
        if (String(oldNorm) !== String(newNorm)) {
          changedFields.push({ field, old_value: oldNorm, new_value: newNorm });
        }
      }
    }

    // Apply the update
    const updated = await base44.asServiceRole.entities.Student.update(student_db_id, updates);

    // Create ONE consolidated audit log entry if any field changed
    if (changedFields.length > 0) {
      await base44.asServiceRole.entities.AuditLog.create({
        action: 'STUDENT_UPDATED',
        module: 'Student',
        student_id: current.student_id,
        academic_year: current.academic_year,
        changed_fields: changedFields,
        performed_by: user.email,
        timestamp: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0],
        details: `Updated fields: ${changedFields.map(f => f.field).join(', ')}`
      });
    }

    return Response.json({ success: true, student: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});