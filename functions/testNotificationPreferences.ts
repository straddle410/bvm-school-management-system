import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    console.log('Testing NotificationPreference for user:', user.email);

    // Test 1: Fetch existing preferences
    const existing = await base44.entities.NotificationPreference.filter({
      user_email: user.email,
    });
    console.log('Existing preferences found:', existing.length, existing);

    // Test 2: Create new if not exists
    let pref;
    if (existing.length > 0) {
      pref = existing[0];
      console.log('Found existing preference with ID:', pref.id);
    } else {
      console.log('Creating new preference');
      pref = await base44.entities.NotificationPreference.create({
        user_email: user.email,
        notifications_enabled: false,
        message_notifications: false,
        sound_enabled: true,
        sound_volume: 0.7,
        browser_push_enabled: false,
      });
      console.log('Created preference:', pref);
    }

    // Test 3: Update the preference
    console.log('Updating preference ID:', pref.id);
    const updated = await base44.entities.NotificationPreference.update(pref.id, {
      notifications_enabled: false,
      message_notifications: false,
      browser_push_enabled: false,
    });
    console.log('Update response:', updated);

    // Test 4: Refetch to verify
    const refetched = await base44.entities.NotificationPreference.filter({
      user_email: user.email,
    });
    console.log('Refetched preferences:', refetched);

    return Response.json({
      success: true,
      user_email: user.email,
      preference_id: pref.id,
      original: existing[0] || null,
      after_update: refetched[0] || null,
      all_records: refetched,
    });
  } catch (error) {
    console.error('Test error:', error);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});