import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const examSchedule = `
EXAMINATION SCHEDULE - CLASSES VII TO X
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Date            Subject              Day
─────────────────────────────────────────────────
20-02-2026      TELUGU               Wednesday
21-02-2026      HINDI                Thursday
22-02-2026      ENGLISH              Friday
23-02-2026      MATHEMATICS          Saturday
24-02-2026      SCIENCE              Sunday
27-02-2026      SOCIAL STUDIES       Wednesday

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    const notice = await base44.entities.Notice.create({
      title: 'Annual Examination Schedule - Classes VII to X',
      content: `Dear Students and Parents,

We are pleased to announce the Annual Examination schedule for Classes VII to X. The examinations will be conducted from 20th February 2026 to 27th February 2026.

${examSchedule}

Important Guidelines:
• Arrive 15 minutes before the examination time
• Carry your hall ticket and required stationery
• No electronic devices are allowed in the examination hall
• Maintain silence and follow all examination rules

For any queries, please contact the examination department.

Best wishes for your exams!`,
      notice_type: 'Exam',
      target_audience: 'Students',
      publish_date: '2026-02-19',
      is_pinned: true,
      status: 'Published',
      created_by_name: user.full_name || user.email
    });

    return Response.json({ 
      success: true, 
      message: 'Exam notice created and published successfully',
      notice 
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});