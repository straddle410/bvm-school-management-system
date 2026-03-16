import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const staffRaw = req.headers.get('x-staff-session');
    let staffRole = '';
    if (staffRaw) {
      try { staffRole = JSON.parse(staffRaw).role || ''; } catch {}
    }

    // Also try base44 auth for web users
    if (!staffRole) {
      try {
        const user = await base44.auth.me();
        staffRole = user?.role || '';
      } catch {}
    }

    if (!['admin', 'principal'].includes(staffRole.toLowerCase())) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { startDate, endDate } = await req.json();

    if (!startDate || !endDate) {
      return Response.json({ error: 'startDate and endDate are required' }, { status: 400 });
    }

    // Fetch all push-sent messages in range
    const messages = await base44.asServiceRole.entities.Message.filter({
      is_push_sent: true,
    });

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const filtered = messages.filter(m => {
      const d = new Date(m.created_date);
      return d >= start && d <= end;
    });

    // Count by context_type
    const pushByType = {};
    const pushPerDay = {};

    for (const msg of filtered) {
      const type = msg.context_type || 'unknown';
      pushByType[type] = (pushByType[type] || 0) + 1;

      const day = new Date(msg.created_date).toISOString().split('T')[0];
      pushPerDay[day] = (pushPerDay[day] || 0) + 1;
    }

    // Sort pushPerDay by date
    const pushPerDaySorted = Object.entries(pushPerDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));

    return Response.json({
      success: true,
      totalPushSent: filtered.length,
      pushByType,
      pushPerDay: pushPerDaySorted,
    });
  } catch (error) {
    console.error('[getPushNotificationAnalytics] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});