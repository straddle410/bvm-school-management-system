import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin' && user?.role !== 'principal') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { attendanceRecords } = await req.json();

    if (!attendanceRecords || !attendanceRecords.length) {
      return Response.json({ error: 'No attendance records provided' }, { status: 400 });
    }

    const results = [];

    for (const record of attendanceRecords) {
      const { student_id, attendance_id, student_name, class_name, section, academic_year } = record;

      // Duplicate check: skip if already notified for this exact attendance record
      const existing = await base44.asServiceRole.entities.Message.filter({
        context_type: 'absent_notification',
        context_id: attendance_id,
      });

      if (existing.length > 0) {
        console.log(`[AbsentNotif] Skipping duplicate for student ${student_id}, attendance_id ${attendance_id}`);
        results.push({ student_id, status: 'skipped', reason: 'Already notified for this absence' });
        continue;
      }

      const messageBody = `Dear student/parent, ${student_name} was marked absent today (Class ${class_name}-${section}). If this is incorrect, please contact the school.`;

      // Create Message entity
      const createdMessage = await base44.asServiceRole.entities.Message.create({
        sender_id: user.email || 'admin',
        sender_name: user.full_name || 'School Admin',
        sender_role: 'admin',
        recipient_type: 'individual',
        recipient_id: student_id,
        recipient_name: student_name,
        recipient_class: class_name,
        recipient_section: section,
        subject: 'Absent Notification',
        body: messageBody,
        is_read: false,
        academic_year: academic_year,
        context_type: 'absent_notification',
        context_id: attendance_id,
      });

      console.log(`[AbsentNotif] Created message ${createdMessage.id} for student ${student_id}`);

      // Send push notification using existing function
      let pushSuccess = false;
      try {
        await base44.asServiceRole.functions.invoke('sendStudentPushNotification', {
          student_ids: [student_id],
          title: 'Absent Notification',
          message: messageBody,
          url: `/StudentMessaging?messageId=${createdMessage.id}`,
        });
        pushSuccess = true;
        console.log(`[AbsentNotif] Push sent for student ${student_id}`);
        results.push({ student_id, status: 'success', message_id: createdMessage.id });
      } catch (pushErr) {
        console.error(`[AbsentNotif] Push failed for student ${student_id}:`, pushErr.message);
        // Message was still created, so mark as partial success
        results.push({ student_id, status: 'message_created_push_failed', message_id: createdMessage.id, error: pushErr.message });
      }
      // Update is_push_sent flag
      if (pushSuccess) {
        try {
          await base44.asServiceRole.entities.Message.update(createdMessage.id, { is_push_sent: true });
        } catch {}
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const skippedCount = results.filter(r => r.status === 'skipped').length;
    const failedCount = results.filter(r => r.status === 'message_created_push_failed').length;

    console.log(`[AbsentNotif] Done. success: ${successCount}, skipped: ${skippedCount}, failed: ${failedCount}`);
    return Response.json({ success: true, results, successCount, skippedCount, failedCount });

  } catch (error) {
    console.error('[AbsentNotif] Fatal error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});