import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const examSchedule = `
<table style="width:100%; border-collapse: collapse; margin: 15px 0;">
  <tr style="background-color: #1a237e; color: white;">
    <th style="border: 1px solid #ddd; padding: 10px; text-align: center;">Date</th>
    <th style="border: 1px solid #ddd; padding: 10px; text-align: center;">Subject</th>
    <th style="border: 1px solid #ddd; padding: 10px; text-align: center;">Day</th>
  </tr>
  <tr>
    <td style="border: 1px solid #ddd; padding: 10px; text-align: center;">20-02-2026</td>
    <td style="border: 1px solid #ddd; padding: 10px; text-align: center;"><strong>Telugu</strong></td>
    <td style="border: 1px solid #ddd; padding: 10px; text-align: center;">Wednesday</td>
  </tr>
  <tr>
    <td style="border: 1px solid #ddd; padding: 10px; text-align: center;">21-02-2026</td>
    <td style="border: 1px solid #ddd; padding: 10px; text-align: center;"><strong>Hindi</strong></td>
    <td style="border: 1px solid #ddd; padding: 10px; text-align: center;">Thursday</td>
  </tr>
  <tr>
    <td style="border: 1px solid #ddd; padding: 10px; text-align: center;">22-02-2026</td>
    <td style="border: 1px solid #ddd; padding: 10px; text-align: center;"><strong>English</strong></td>
    <td style="border: 1px solid #ddd; padding: 10px; text-align: center;">Friday</td>
  </tr>
  <tr>
    <td style="border: 1px solid #ddd; padding: 10px; text-align: center;">23-02-2026</td>
    <td style="border: 1px solid #ddd; padding: 10px; text-align: center;"><strong>Mathematics</strong></td>
    <td style="border: 1px solid #ddd; padding: 10px; text-align: center;">Saturday</td>
  </tr>
  <tr>
    <td style="border: 1px solid #ddd; padding: 10px; text-align: center;">24-02-2026</td>
    <td style="border: 1px solid #ddd; padding: 10px; text-align: center;"><strong>Science</strong></td>
    <td style="border: 1px solid #ddd; padding: 10px; text-align: center;">Sunday</td>
  </tr>
  <tr>
    <td style="border: 1px solid #ddd; padding: 10px; text-align: center;">27-02-2026</td>
    <td style="border: 1px solid #ddd; padding: 10px; text-align: center;"><strong>Social Studies</strong></td>
    <td style="border: 1px solid #ddd; padding: 10px; text-align: center;">Wednesday</td>
  </tr>
</table>`;

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