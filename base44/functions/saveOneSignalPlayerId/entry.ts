import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// Saves a OneSignal player_id for a student or staff member.
// Does NOT touch browser_push_token — purely parallel/additive.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { player_id, user_type, identifier } = await req.json();

    // user_type: 'student' | 'staff'
    // identifier: student_id (e.g. 'S25007') for students, staff_id/username for staff

    if (!player_id || !user_type || !identifier) {
      return Response.json({ error: 'player_id, user_type, and identifier are required' }, { status: 400 });
    }

    if (user_type === 'student') {
      const prefs = await base44.asServiceRole.entities.StudentNotificationPreference.filter({ student_id: identifier });
      if (prefs.length > 0) {
        await base44.asServiceRole.entities.StudentNotificationPreference.update(prefs[0].id, { onesignal_player_id: player_id });
      } else {
        await base44.asServiceRole.entities.StudentNotificationPreference.create({
          student_id: identifier,
          onesignal_player_id: player_id,
          notifications_enabled: true,
          browser_push_enabled: true,
        });
      }
      console.log('[saveOneSignalPlayerId] Saved for student:', identifier);
    } else if (user_type === 'staff') {
      const prefs = await base44.asServiceRole.entities.StaffNotificationPreference.filter({ staff_id: identifier });
      if (prefs.length > 0) {
        await base44.asServiceRole.entities.StaffNotificationPreference.update(prefs[0].id, { onesignal_player_id: player_id });
      } else {
        await base44.asServiceRole.entities.StaffNotificationPreference.create({
          staff_id: identifier,
          onesignal_player_id: player_id,
          browser_push_enabled: true,
        });
      }
      console.log('[saveOneSignalPlayerId] Saved for staff:', identifier);
    } else {
      return Response.json({ error: 'Invalid user_type. Must be student or staff.' }, { status: 400 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('[saveOneSignalPlayerId] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});