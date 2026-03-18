import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { event, data } = payload;

    if (event.type !== 'update') {
      return Response.json({ success: true });
    }

    // Check if status changed to "Verified"
    if (data?.status === 'Verified') {
      // Get all admin users
      const admins = await base44.asServiceRole.entities.User.filter({ role: 'admin' });
      
      // Send notification to each admin
      for (const admin of admins) {
        try {
          // Save a notification record
          await base44.asServiceRole.entities.Notification.create({
            user_email: admin.email,
            type: 'student_verified',
            title: 'Student Verified',
            message: `${data.name} (${data.student_id}) has been verified and is waiting for approval.`,
            entity_type: 'Student',
            entity_id: data.id,
            academic_year: data.academic_year,
            is_read: false
          });
        } catch {}
      }
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});