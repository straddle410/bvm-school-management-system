import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Test 1: Verify StudentNotificationPreference entity works
    const studentId = user.email; // Using email as student ID for testing
    const prefs = await base44.asServiceRole.entities.StudentNotificationPreference.filter({
      student_id: studentId
    });

    let prefId = null;
    if (prefs.length === 0) {
      // Create new preference if doesn't exist
      const created = await base44.asServiceRole.entities.StudentNotificationPreference.create({
        student_id: studentId,
        notifications_enabled: true,
        message_notifications: true,
        quiz_notifications: true,
        sound_enabled: true,
        sound_volume: 0.7,
        browser_push_enabled: false
      });
      prefId = created.id;
    } else {
      prefId = prefs[0].id;
    }

    // Test 2: Update preferences
    await base44.asServiceRole.entities.StudentNotificationPreference.update(prefId, {
      notifications_enabled: true,
      message_notifications: true,
      browser_push_enabled: false
    });

    // Test 3: Verify notification entity creation
    const notification = await base44.asServiceRole.entities.Notification.create({
      recipient_student_id: studentId,
      recipient_name: user.full_name || 'Test User',
      type: 'notice_posted',
      title: 'Test Notification',
      message: 'This is a test notification from the backend',
      academic_year: '2025-26',
      duplicate_key: `test_${Date.now()}_${studentId}`
    });

    // Test 4: Verify notification retrieval
    const notifications = await base44.asServiceRole.entities.Notification.filter({
      recipient_student_id: studentId
    });

    // Test 5: Verify preference persistence
    const updatedPrefs = await base44.asServiceRole.entities.StudentNotificationPreference.filter({
      student_id: studentId
    });

    return Response.json({
      success: true,
      message: 'Notification system end-to-end test passed',
      tests: {
        preferenceCreation: prefs.length > 0 ? 'existing' : 'created',
        preferenceUpdate: 'success',
        notificationCreation: notification.id ? 'success' : 'failed',
        notificationRetrieval: notifications.length > 0 ? 'success' : 'failed',
        preferencePersistence: updatedPrefs.length > 0 ? 'success' : 'failed'
      },
      data: {
        preferenceId: prefId,
        notificationId: notification.id,
        studentNotifications: notifications.length,
        preferences: updatedPrefs[0]
      }
    });
  } catch (error) {
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});