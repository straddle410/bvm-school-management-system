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

    // Load SchoolProfile + NotificationSettings for template
    const [profiles, settingsList] = await Promise.all([
      base44.asServiceRole.entities.SchoolProfile.list(),
      base44.asServiceRole.entities.NotificationSettings.list(),
    ]);
    const profile = profiles[0] || {};
    const schoolName = profile.school_name || 'School';
    const settings = settingsList[0] || {};

    const templateStr = settings.absent_template ||
      `Dear student/parent, {{student_name}} was marked absent today (Class {{class}}-{{section}}). If this is incorrect, please contact the school.`;

    const results = [];

    for (const record of attendanceRecords) {
      const { student_id, attendance_id, student_name, class_name, section, academic_year } = record;

      // Duplicate check
      const existing = await base44.asServiceRole.entities.Message.filter({
        context_type: 'absent_notification',
        context_id: attendance_id,
      });

      if (existing.length > 0) {
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

      results.push({ student_id, status: 'success', message_id: createdMessage.id });
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const skippedCount = results.filter(r => r.status === 'skipped').length;

    console.log(`[AbsentNotif] Done. success: ${successCount}, skipped: ${skippedCount}`);
    return Response.json({ success: true, results, successCount, skippedCount });

  } catch (error) {
    console.error('[AbsentNotif] Fatal error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});