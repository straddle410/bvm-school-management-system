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

    // Load NotificationSettings + SchoolProfile
    const [settingsList, profiles] = await Promise.all([
      base44.asServiceRole.entities.NotificationSettings.list(),
      base44.asServiceRole.entities.SchoolProfile.list(),
    ]);
    const settings = settingsList[0];
    const profile = profiles[0] || {};
    const schoolName = profile.school_name || 'School';

    if (!settings || settings.enable_push !== true) {
      console.log('[AbsentNotif] Push disabled or settings missing, skipping notification.');
      return Response.json({ success: true, message: 'Push notifications disabled', results: [] });
    }

    const templateStr = settings.absent_template ||
      `Dear student/parent, {{student_name}} was marked absent today (Class {{class}}-{{section}}). If this is incorrect, please contact the school.`;

    // Fetch StudentNotificationPreference for push filtering
    const studentPrefs = await base44.asServiceRole.entities.StudentNotificationPreference.filter({});
    const prefsByStudentId = Object.fromEntries(
      studentPrefs.map(p => [p.student_id, p])
    );

    const results = [];
    const externalUserIds = [];
    const messagesToCreate = [];

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

      const today = new Date().toLocaleDateString('en-IN');
      const messageBody = templateStr
        .replace(/{{student_name}}/g, student_name)
        .replace(/{{class}}/g, class_name)
        .replace(/{{section}}/g, section)
        .replace(/{{date}}/g, today)
        .replace(/{{school_name}}/g, schoolName);

      // Check if push enabled for this student
      const pref = prefsByStudentId[student_id];
      if (!pref || !pref.browser_push_enabled) {
        console.log(`[AbsentNotif] Skipping push for ${student_id} - push not enabled`);
        // Still create message
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
          is_push_sent: false,
        });
        results.push({ student_id, status: 'message_only', message_id: createdMessage.id });
        continue;
      }

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
        is_push_sent: false,
      });

      externalUserIds.push(`student_${student_id}`);
      messagesToCreate.push({ createdMessage, student_id });
      results.push({ student_id, status: 'pending', message_id: createdMessage.id });
    }

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
            contents: { en: 'Absent notification' },
            headings: { en: 'Absent Notification' },
          }),
        });
        const osData = await res.json();
        console.log(`[AbsentNotif] OneSignal sent to ${externalUserIds.length} students`);
        // Log push
        if (res.ok) {
          await base44.asServiceRole.entities.PushNotificationLog.create({
            one_signal_notification_id: osData.id || 'unknown',
            target_type: 'student',
            target_user_ids: externalUserIds,
            title: 'Absent Notification',
            message: 'Student marked absent',
            recipients_count: osData.recipients || externalUserIds.length,
            status: 'sent',
            context_type: 'absent_notification',
            context_id: 'batch',
            sent_date: new Date().toISOString(),
          });
        }

    const successCount = results.filter(r => r.status === 'success').length;
    const skippedCount = results.filter(r => r.status === 'skipped').length;
    const messageOnlyCount = results.filter(r => r.status === 'message_only').length;

    console.log(`[AbsentNotif] Done. success: ${successCount}, message_only: ${messageOnlyCount}, skipped: ${skippedCount}`);
    return Response.json({ success: true, results, successCount, messageOnlyCount, skippedCount });

  } catch (error) {
    console.error('[AbsentNotif] Fatal error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});