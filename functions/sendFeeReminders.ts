import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || (!['admin', 'principal', 'accountant'].includes(user.role))) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { student_ids, title, message } = await req.json();

    if (!student_ids || !Array.isArray(student_ids) || student_ids.length === 0) {
      return Response.json({ error: 'student_ids array is required' }, { status: 400 });
    }

    if (!title || !message) {
      return Response.json({ error: 'title and message are required' }, { status: 400 });
    }

    let success_count = 0;
    let already_reminded_count = 0;
    let failed_count = 0;

    const today = new Date().toISOString().split('T')[0];

    for (const student_id of student_ids) {
      try {
        // STEP 1 - GET STUDENT DETAILS
        const students = await base44.asServiceRole.entities.Student.filter({ student_id: student_id });
        
        if (!students || students.length === 0) {
          failed_count++;
          continue;
        }

        const student = students[0];
        const student_name = student.name || student.student_name || 'Student';
        const class_name = student.class_name || '';
        const section = student.section || '';

        // Get outstanding balance from FeeInvoice
        let outstanding_balance = 0;
        try {
          const invoices = await base44.asServiceRole.entities.FeeInvoice.filter({ 
            student_id: student_id,
            status: ['Pending', 'Partial', 'Overdue']
          });
          outstanding_balance = invoices.reduce((sum, inv) => sum + (inv.balance || 0), 0);
        } catch {}

        // STEP 2 - DUPLICATE CHECK
        const dup_key = 'fee_reminder_' + student_id + '_' + today;
        const existingNotifs = await base44.asServiceRole.entities.Notification.filter({
          duplicate_key: dup_key
        });

        if (existingNotifs && existingNotifs.length > 0) {
          already_reminded_count++;
          continue;
        }

        // STEP 3 - PERSONALIZE
        let personalTitle = title
          .replace('{name}', student_name)
          .replace('{amount}', outstanding_balance.toString())
          .replace('{class}', class_name + ' ' + section);

        let personalMessage = message
          .replace('{name}', student_name)
          .replace('{amount}', outstanding_balance.toString())
          .replace('{class}', class_name + ' ' + section);

        // STEP 4 - SEND PUSH NOTIFICATION
        try {
          const prefs = await base44.asServiceRole.entities.StudentNotificationPreference.filter({
            student_id: student_id,
          });
          const pref = prefs[0];

          if (pref && pref.browser_push_enabled && pref.browser_push_token) {
            await base44.asServiceRole.functions.invoke('sendStudentPushNotification', {
              student_ids: [student_id],
              title: personalTitle,
              message: personalMessage,
              url: '/fees',
              data: { type: 'fee_reminder' }
            });
          }
        } catch (pushErr) {
          console.error(`Failed to send push notification for student ${student_id}:`, pushErr.message);
        }

        // STEP 5 - CREATE IN-APP NOTIFICATION
        await base44.asServiceRole.entities.Notification.create({
          recipient_student_id: student_id,
          type: 'fee_reminder',
          title: personalTitle,
          message: personalMessage,
          is_read: false,
          duplicate_key: dup_key,
          action_url: '/fees',
          created_date: new Date().toISOString()
        });

        // STEP 6
        success_count++;
      } catch (err) {
        console.error(`Failed to send reminder to student ${student_id}:`, err.message);
        failed_count++;
      }
    }

    return Response.json({
      success: true,
      success_count: success_count,
      already_reminded_count: already_reminded_count,
      failed_count: failed_count,
      total_processed: student_ids.length
    });
  } catch (error) {
    console.error('Error in sendFeeReminders:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});