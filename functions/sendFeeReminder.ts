import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { selectedStudents, academic_year, sender_id, sender_name, allowDuplicate = false } = await req.json();

    if (!selectedStudents || !Array.isArray(selectedStudents) || selectedStudents.length === 0) {
      return Response.json({ error: 'selectedStudents array is required' }, { status: 400 });
    }

    if (!academic_year || !sender_id || !sender_name) {
      return Response.json({ error: 'academic_year, sender_id, and sender_name are required' }, { status: 400 });
    }

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const results = {
      success_count: 0,
      failed_count: 0,
      skipped_count: 0,
      notified_students: [],
      errors: []
    };

    for (const student of selectedStudents) {
      try {
        const contextId = `${student.student_id}_${academic_year}_${today}`;

        // Deduplication check — skip if already sent today (unless allowDuplicate is true)
        const existing = await base44.asServiceRole.entities.Message.filter({
          context_type: 'fee_reminder',
          context_id: contextId,
        });
        if (!allowDuplicate && existing.length > 0) {
          console.log(`[sendFeeReminder] Skipping duplicate reminder for ${student.student_id}`);
          results.skipped_count++;
          continue;
        }

        const reminderMessage = `Dear ${student.parent_name || 'Parent'}, fee of ₹${student.due_amount} is pending for ${student.student_name} (${student.class_name}). Please pay at the earliest.`;

        // Send push via centralized function first, track success
        let isPushSent = false;
        const tempMsg = await base44.asServiceRole.entities.Message.create({
          sender_id: sender_id,
          sender_name: sender_name,
          sender_role: 'admin',
          recipient_type: 'individual',
          recipient_id: student.student_id,
          recipient_name: student.student_name,
          subject: 'Fee Payment Reminder',
          body: reminderMessage,
          is_read: false,
          academic_year: academic_year,
          context_type: 'fee_reminder',
          context_id: contextId,
          is_push_sent: false,
        });

        try {
          await base44.asServiceRole.functions.invoke('sendStudentPushNotification', {
            student_ids: [student.student_id],
            title: 'Fee Payment Reminder',
            message: `Fee of ₹${student.due_amount} is pending. Tap to view.`,
            url: `/StudentMessaging?messageId=${tempMsg.id}`,
          });
          isPushSent = true;
          await base44.asServiceRole.entities.Message.update(tempMsg.id, { is_push_sent: true });
        } catch (pushError) {
          console.warn(`[sendFeeReminder] Push failed for ${student.student_id} (non-fatal):`, pushError.message);
        }

        const createdMessage = tempMsg;
        results.success_count++;
        results.notified_students.push(student.student_name);
      } catch (error) {
        results.failed_count++;
        results.errors.push(`${student.student_name}: ${error.message}`);
      }
    }

    return Response.json(results);
  } catch (error) {
    console.error('[sendFeeReminder] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});