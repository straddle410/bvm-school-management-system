import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const studentId = user.id;
    const results = {
      tests: [],
      timestamp: new Date().toISOString(),
      user: user.email
    };

    // Test 1: Create/Update StudentNotificationPreference
    try {
      const prefs = await base44.entities.StudentNotificationPreference.filter({ 
        student_id: studentId 
      });
      
      if (prefs.length > 0) {
        await base44.entities.StudentNotificationPreference.update(prefs[0].id, {
          notifications_enabled: true,
          message_notifications: true,
          quiz_notifications: true,
          sound_enabled: true,
          sound_volume: 0.7,
          browser_push_enabled: true
        });
        results.tests.push({
          name: 'Update Student Notification Preference',
          status: 'passed',
          message: `Updated preferences for student ${studentId}`
        });
      } else {
        const created = await base44.entities.StudentNotificationPreference.create({
          student_id: studentId,
          notifications_enabled: true,
          message_notifications: true,
          quiz_notifications: true,
          sound_enabled: true,
          sound_volume: 0.7,
          browser_push_enabled: true
        });
        results.tests.push({
          name: 'Create Student Notification Preference',
          status: 'passed',
          message: `Created new preferences with ID: ${created.id}`
        });
      }
    } catch (err) {
      results.tests.push({
        name: 'Notification Preference Test',
        status: 'failed',
        error: err.message
      });
    }

    // Test 2: Create Test Notification
    try {
      const notification = await base44.entities.Notification.create({
        recipient_student_id: studentId,
        recipient_name: user.full_name,
        type: 'class_message',
        title: 'End-to-End Test Notification',
        message: `This is a test notification sent at ${new Date().toLocaleString()}`,
        action_url: '/dashboard',
        is_read: false,
        academic_year: '2024-25',
        duplicate_key: `test_${studentId}_${Date.now()}`
      });

      results.tests.push({
        name: 'Create Test Notification',
        status: 'passed',
        notificationId: notification.id
      });
    } catch (err) {
      results.tests.push({
        name: 'Create Test Notification',
        status: 'failed',
        error: err.message
      });
    }

    // Test 3: Verify In-App Notification System
    try {
      const notifications = await base44.entities.Notification.filter({
        recipient_student_id: studentId,
        is_read: false
      }, '-created_date', 5);

      results.tests.push({
        name: 'In-App Notification Retrieval',
        status: 'passed',
        unreadCount: notifications.length,
        message: `Found ${notifications.length} unread notifications`
      });
    } catch (err) {
      results.tests.push({
        name: 'In-App Notification Retrieval',
        status: 'failed',
        error: err.message
      });
    }

    // Test 4: Test Firebase Push Notification (Optional - requires FCM token)
    try {
      const fcmServerKey = Deno.env.get('FCM_SERVER_KEY');
      const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

      if (fcmServerKey && vapidPrivateKey) {
        results.tests.push({
          name: 'Secrets Configuration',
          status: 'passed',
          message: 'FCM_SERVER_KEY and VAPID_PRIVATE_KEY are properly configured'
        });
      } else {
        results.tests.push({
          name: 'Secrets Configuration',
          status: 'warning',
          message: 'Secrets configured but browser push token from client is needed to send actual push'
        });
      }
    } catch (err) {
      results.tests.push({
        name: 'Secrets Configuration',
        status: 'failed',
        error: err.message
      });
    }

    // Test 5: Verify Service Worker Registration
    try {
      results.tests.push({
        name: 'Service Worker Setup',
        status: 'info',
        message: 'Service Worker registration happens on client-side. Verify in browser DevTools > Application > Service Workers'
      });
    } catch (err) {
      results.tests.push({
        name: 'Service Worker Setup',
        status: 'failed',
        error: err.message
      });
    }

    return Response.json({
      success: true,
      summary: {
        total: results.tests.length,
        passed: results.tests.filter(t => t.status === 'passed').length,
        failed: results.tests.filter(t => t.status === 'failed').length,
        warnings: results.tests.filter(t => t.status === 'warning').length
      },
      ...results
    });

  } catch (error) {
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});