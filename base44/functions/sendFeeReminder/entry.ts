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

    const today = new Date().toISOString().split('T')[0];

    // Load NotificationSettings + SchoolProfile
    const [settingsList, profiles] = await Promise.all([
      base44.asServiceRole.entities.NotificationSettings.list(),
      base44.asServiceRole.entities.SchoolProfile.list(),
    ]);
    const settings = settingsList[0];
    const profile = profiles[0] || {};
    const schoolName = profile.school_name || 'School';

    if (!settings || settings.enable_push !== true) {
      console.log('[sendFeeReminder] Push disabled or settings missing, skipping notification.');
      return Response.json({ success_count: 0, skipped_count: selectedStudents.length, failed_count: 0, notified_students: [], errors: [] });
    }

    const templateStr = settings.fee_template ||
      `Dear {{parent_name}}, fee of ₹{{amount}} is pending for {{student_name}} ({{class}}). Please pay at the earliest.`;

    // Fetch StudentNotificationPreference for push filtering
    const studentPrefs = await base44.asServiceRole.entities.StudentNotificationPreference.filter({});
    const prefsByStudentId = Object.fromEntries(
      studentPrefs.map(p => [p.student_id, p])
    );

    const externalUserIds = [];
    const messagesToCreate = [];

    for (const student of selectedStudents) {
      try {
        const pref = prefsByStudentId[student.student_id];
        // Skip if push not enabled
        if (!pref || !pref.browser_push_enabled) {
          console.log(`[sendFeeReminder] Skipping ${student.student_id} - push not enabled`);
          continue;
        }

        const contextId = `${student.student_id}_${academic_year}_${today}`;

        // Deduplication check
        const existing = await base44.asServiceRole.entities.Message.filter({
          context_type: 'fee_reminder',
          context_id: contextId,
        });
        if (!allowDuplicate && existing.length > 0) {
          console.log(`[sendFeeReminder] Skipping duplicate reminder for ${student.student_id}`);
          continue;
        }

        const reminderMessage = templateStr
          .replace(/{{parent_name}}/g, student.parent_name || 'Parent')
          .replace(/{{amount}}/g, student.due_amount)
          .replace(/{{student_name}}/g, student.student_name)
          .replace(/{{class}}/g, student.class_name)
          .replace(/{{school_name}}/g, schoolName);

        // Create Message record
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

        externalUserIds.push(`student_${student.student_id}`);
        messagesToCreate.push({ tempMsg, student });
      } catch (error) {
        console.error(`[sendFeeReminder] Error for ${student.student_name}:`, error.message);
      }
    }

    const results = {
      success_count: 0,
      failed_count: 0,
      skipped_count: selectedStudents.length - messagesToCreate.length,
      notified_students: [],
      errors: []
    };

    // Send consolidated push via OneSignal if there are recipients
    if (externalUserIds.length > 0) {
      try {
        const ONESIGNAL_REST_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY');
        const ONESIGNAL_APP_ID = Deno.env.get('ONESIGNAL_APP_ID');
        const res = await fetch('https://onesignal.com/api/v1/notifications', {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            app_id: ONESIGNAL_APP_ID,
            include_external_user_ids: externalUserIds,
            contents: { en: 'Fee payment reminder' },
            headings: { en: 'Fee Payment Reminder' },
          }),
        });
        const osData = await res.json();
        console.log(`[sendFeeReminder] OneSignal sent to ${externalUserIds.length} students`);
        // Log push
        if (res.ok) {
          await base44.asServiceRole.entities.PushNotificationLog.create({
            one_signal_notification_id: osData.id || 'unknown',
            target_type: 'student',
            target_user_ids: externalUserIds,
            title: 'Fee Payment Reminder',
            message: 'Fee payment reminder',
            recipients_count: osData.recipients || externalUserIds.length,
            status: 'sent',
            context_type: 'fee_reminder',
            context_id: academic_year,
            sent_date: new Date().toISOString(),
          });
        }

    return Response.json(results);
  } catch (error) {
    console.error('[sendFeeReminder] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});