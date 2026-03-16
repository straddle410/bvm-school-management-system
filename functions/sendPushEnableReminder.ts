import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const staffRaw = req.headers.get('x-staff-session');
    let staffRole = '';
    if (staffRaw) {
      try { staffRole = JSON.parse(staffRaw).role || ''; } catch {}
    }

    if (!['admin', 'principal'].includes(staffRole.toLowerCase())) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fetch all StudentNotificationPreference records
    const allPrefs = await base44.asServiceRole.entities.StudentNotificationPreference.filter({});
    
    // Fetch all students
    const allStudents = await base44.asServiceRole.entities.Student.filter({});
    const studentMap = new Map(allStudents.map(s => [s.student_id, s]));

    let messagesSent = 0;
    const errors = [];

    // For each student without push enabled, create an in-app message
    for (const pref of allPrefs) {
      // Check if push is not enabled (no token OR disabled)
      const isPushNotEnabled = !pref.browser_push_token || !pref.browser_push_enabled;
      
      if (!isPushNotEnabled) continue;

      const student = studentMap.get(pref.student_id);
      if (!student) continue;

      try {
        await base44.asServiceRole.entities.Message.create({
          sender_id: 'system',
          sender_name: 'School',
          sender_role: 'admin',
          recipient_type: 'individual',
          recipient_id: pref.student_id,
          recipient_name: student.name,
          subject: 'Enable Notifications',
          body: 'Please enable notifications in the school app to receive important updates like notices, fees reminders, exam results, and attendance alerts.',
          context_type: 'push_enable_reminder',
          academic_year: student.academic_year || '2025-26',
          is_push_sent: false,
          is_read: false,
        });
        messagesSent++;
      } catch (err) {
        errors.push({
          student_id: pref.student_id,
          error: err.message,
        });
        console.error(`[sendPushEnableReminder] Failed to create message for student ${pref.student_id}:`, err.message);
      }
    }

    console.log(`[sendPushEnableReminder] Sent ${messagesSent} reminder messages. Errors: ${errors.length}`);

    return Response.json({
      success: true,
      messages_sent: messagesSent,
      errors: errors,
    });
  } catch (error) {
    console.error('[sendPushEnableReminder] Fatal error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});