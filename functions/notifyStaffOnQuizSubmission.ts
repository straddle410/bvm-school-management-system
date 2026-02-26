import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Fires when a QuizAttempt is created
// Notifies teachers assigned to the quiz's class
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    if (!data) {
      return Response.json({ success: true, notified: 0 });
    }

    const attempt = data;
    const attemptId = event?.entity_id || attempt.id;

    // Get the quiz to find the class
    const quizzes = await base44.asServiceRole.entities.Quiz.filter({ id: attempt.quiz_id });
    const quiz = quizzes[0];
    if (!quiz) {
      return Response.json({ success: true, notified: 0 });
    }

    // Find staff assigned to this class
    const staffList = await base44.asServiceRole.entities.StaffAccount.filter({ is_active: true });
    const staffEmails = staffList
      .filter(t =>
        t.classes_assigned && t.classes_assigned.includes(quiz.class_name) &&
        (t.role === 'Teacher' || t.role === 'Principal' || t.role === 'Admin')
      )
      .map(t => t.email)
      .filter(Boolean);

    if (staffEmails.length === 0) {
      return Response.json({ success: true, notified: 0 });
    }

    // DB-level dedup per quiz attempt
    const existing = await base44.asServiceRole.entities.Notification.filter({
      type: 'quiz_submitted',
      related_entity_id: attemptId,
    });
    const alreadyNotified = new Set(existing.map(n => n.recipient_staff_id));

    let notified = 0;

    for (const email of staffEmails) {
      if (alreadyNotified.has(email)) continue;
      try {
        await base44.asServiceRole.entities.Notification.create({
          recipient_staff_id: email,
          type: 'quiz_submitted',
          title: `Quiz Submitted`,
          message: `${attempt.student_name || 'A student'} submitted "${quiz.title}"`,
          related_entity_id: attemptId,
          action_url: '/Quiz',
          is_read: false,
        });
        notified++;
      } catch (err) {
        console.error(`Failed to notify staff ${email}:`, err.message);
      }
    }

    // Push notifications
    if (notified > 0) {
      try {
        const prefs = await base44.asServiceRole.entities.StaffNotificationPreference.filter({});
        for (const pref of prefs) {
          if (
            staffEmails.includes(pref.staff_email) &&
            pref.browser_push_enabled &&
            pref.browser_push_token &&
            pref.notify_on_quiz_submission !== false
          ) {
            await base44.asServiceRole.functions.invoke('sendStaffPushNotification', {
              staff_emails: [pref.staff_email],
              title: 'Quiz Submitted',
              message: `${attempt.student_name || 'A student'} submitted "${quiz.title}"`,
              url: '/Quiz',
            });
          }
        }
      } catch (pushErr) {
        console.error('Push send error (non-fatal):', pushErr.message);
      }
    }

    return Response.json({ success: true, notified });
  } catch (error) {
    console.error('Error in notifyStaffOnQuizSubmission:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});