/**
 * Create Follow-Up Note
 * Creates a new follow-up record for a student.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { student_id, academic_year, status, priority, note, next_followup_date, staffInfo } = await req.json();
    const user = staffInfo || { email: 'system' };
    if (staffInfo) {
      const userRole = (staffInfo.role || '').toLowerCase();
      if (!['admin', 'principal', 'accountant'].includes(userRole)) {
        return Response.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    if (!student_id || !academic_year || !note?.trim()) {
      return Response.json({ error: 'Missing required fields: student_id, academic_year, note' }, { status: 400 });
    }

    // Create follow-up
    const followUp = await base44.asServiceRole.entities.StudentFollowUp.create({
      student_id,
      academic_year,
      status: status || 'NEW',
      priority: priority || null,
      note: note.trim(),
      next_followup_date: next_followup_date || null,
      created_by: user.email
    });

    return Response.json({ success: true, followUp });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});