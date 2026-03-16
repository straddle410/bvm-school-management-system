import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { selectedStudents, academic_year, sender_id, sender_name } = await req.json();

    if (!selectedStudents || !Array.isArray(selectedStudents) || selectedStudents.length === 0) {
      return Response.json({ error: 'selectedStudents array is required' }, { status: 400 });
    }

    if (!academic_year || !sender_id || !sender_name) {
      return Response.json({ error: 'academic_year, sender_id, and sender_name are required' }, { status: 400 });
    }

    const results = {
      success_count: 0,
      failed_count: 0,
      notified_students: [],
      errors: []
    };

    // Collect student_ids for push notification batch
    const studentIdsForPush = [];

    for (const student of selectedStudents) {
      try {
        const reminderMessage = `Dear ${student.parent_name}, fee of ₹${student.due_amount} is pending for ${student.student_name} (${student.class_name}). Please pay at earliest.`;

        // STEP A: Create Message record (existing behavior — unchanged)
        await base44.asServiceRole.entities.Message.create({
          sender_id: sender_id,
          sender_name: sender_name,
          sender_role: "admin",
          recipient_type: "individual",
          recipient_id: student.student_id,
          recipient_name: student.student_name,
          subject: "Fee Payment Reminder",
          body: reminderMessage,
          is_read: false,
          academic_year: academic_year
        });

        studentIdsForPush.push(student.student_id);
        results.success_count++;
        results.notified_students.push(student.student_name);
      } catch (error) {
        results.failed_count++;
        results.errors.push(`${student.student_name}: ${error.message}`);
      }
    }

    // STEP B: Send push notifications via the existing working function
    if (studentIdsForPush.length > 0) {
      try {
        await base44.functions.invoke('sendStudentPushNotification', {
          student_ids: studentIdsForPush,
          title: 'Fee Payment Reminder',
          message: `You have a pending fee reminder. Please check the Fees section.`,
          url: '/StudentFees',
        });
        console.log(`[sendFeeReminder] Push sent to ${studentIdsForPush.length} students`);
      } catch (pushError) {
        // Push failure should not fail the overall reminder send
        console.warn('[sendFeeReminder] Push notification failed (non-fatal):', pushError.message);
      }
    }

    return Response.json(results);
  } catch (error) {
    console.error('sendFeeReminder error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});