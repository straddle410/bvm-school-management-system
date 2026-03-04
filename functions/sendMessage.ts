import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Rate limit constants
const RATE_LIMITS = {
  student: {
    short_window_minutes: 5,
    short_window_limit: 10,
    day_limit: 50,
  },
  teacher: {
    short_window_minutes: 10,
    short_window_limit: 30,
    day_limit: 300,
  },
};

const MAX_BODY_LENGTH = 1000;

function getISTStartOfDay() {
  // IST is UTC+5:30
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in ms
  const istTime = new Date(now.getTime() + istOffset);
  
  const startOfDay = new Date(istTime);
  startOfDay.setUTCHours(0 - 5, -30, 0, 0); // Subtract IST offset to get UTC start
  
  return startOfDay;
}

async function checkRateLimits(base44, actorId, actorRole) {
  const limits = RATE_LIMITS[actorRole];
  if (!limits) {
    return { allowed: true }; // Unknown role, allow (should not happen)
  }

  const now = new Date();
  const shortWindowStart = new Date(now.getTime() - limits.short_window_minutes * 60 * 1000);
  const dayStart = getISTStartOfDay();

  // Count messages in short window
  const shortWindowMessages = await base44.asServiceRole.entities.Message.filter({
    sender_id: actorId,
  }, null, 1000); // Get all, then filter locally by date

  const shortWindowCount = shortWindowMessages.filter(
    m => new Date(m.created_date) >= shortWindowStart
  ).length;

  if (shortWindowCount >= limits.short_window_limit) {
    const oldestInWindow = shortWindowMessages
      .filter(m => new Date(m.created_date) >= shortWindowStart)
      .sort((a, b) => new Date(a.created_date) - new Date(b.created_date))[0];
    
    const retryAfterMs = new Date(oldestInWindow.created_date).getTime() + (limits.short_window_minutes * 60 * 1000) - now.getTime();
    const retryAfterSeconds = Math.ceil(Math.max(1, retryAfterMs / 1000));

    return {
      allowed: false,
      error: `Rate limit exceeded (${limits.short_window_limit} messages per ${limits.short_window_minutes} minutes)`,
      retryAfterSeconds,
    };
  }

  // Count messages since start of day
  const dayCount = shortWindowMessages.filter(
    m => new Date(m.created_date) >= dayStart
  ).length;

  if (dayCount >= limits.day_limit) {
    const dayEndIST = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const retryAfterMs = dayEndIST.getTime() - now.getTime();
    const retryAfterSeconds = Math.ceil(Math.max(1, retryAfterMs / 1000));

    return {
      allowed: false,
      error: `Rate limit exceeded (${limits.day_limit} messages per day)`,
      retryAfterSeconds,
    };
  }

  return { allowed: true };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { 
      sender_id, 
      sender_name, 
      sender_role, 
      recipient_type, 
      recipient_id, 
      recipient_name, 
      recipient_class, 
      recipient_section, 
      subject, 
      body, 
      thread_id, 
      parent_message_id, 
      academic_year, 
      subject_area 
    } = payload;

    // Validate body
    if (!body || typeof body !== 'string') {
      return Response.json({ error: 'Message body is required' }, { status: 400 });
    }

    const trimmedBody = body.trim();
    if (trimmedBody.length === 0) {
      return Response.json({ error: 'Message cannot be empty' }, { status: 400 });
    }

    if (trimmedBody.length > MAX_BODY_LENGTH) {
      return Response.json(
        { error: `Message must be ${MAX_BODY_LENGTH} characters or less` },
        { status: 400 }
      );
    }

    // Determine actor role for rate limiting (student or teacher/staff)
    const actorRole = sender_role === 'student' ? 'student' : 'teacher';

    // Check rate limits
    const rateLimitCheck = await checkRateLimits(base44, sender_id, actorRole);
    if (!rateLimitCheck.allowed) {
      return Response.json(
        { 
          error: rateLimitCheck.error,
          retryAfterSeconds: rateLimitCheck.retryAfterSeconds,
        },
        { status: 429 }
      );
    }

    // Create message(s)
    if (recipient_type === 'individual') {
      await base44.asServiceRole.entities.Message.create({
        sender_id,
        sender_name,
        sender_role,
        recipient_type: 'individual',
        recipient_id,
        recipient_name,
        subject: (subject || '').trim(),
        body: trimmedBody,
        is_read: false,
        thread_id,
        parent_message_id: parent_message_id || null,
        academic_year: academic_year || '2024-25',
        subject_area: subject_area || null,
      });
    } else {
      // Bulk create for class/section
      const messages = payload.messages || [];
      if (messages.length === 0) {
        return Response.json({ error: 'No recipients specified' }, { status: 400 });
      }

      await base44.asServiceRole.entities.Message.bulkCreate(
        messages.map(m => ({
          sender_id,
          sender_name,
          sender_role,
          recipient_type,
          recipient_id: m.recipient_id,
          recipient_name: m.recipient_name,
          recipient_class: m.recipient_class,
          recipient_section: m.recipient_section,
          subject: (subject || '').trim(),
          body: trimmedBody,
          is_read: false,
          thread_id,
          academic_year: academic_year || '2024-25',
          subject_area: subject_area || null,
        }))
      );
    }

    return Response.json({ success: true, message: 'Message sent' });
  } catch (error) {
    console.error('Error in sendMessage:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});