import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { event, data } = payload;

    if (event.type !== 'update' || data.status !== 'Verified') {
      return Response.json({ success: true });
    }

    // Notify all admin staff
    const admins = await base44.asServiceRole.entities.StaffAccount.filter({ role: 'Admin' });
    for (const admin of admins) {
      // Skip if email is missing
      if (!admin.email) continue;
      
      try {
        await base44.asServiceRole.entities.Notification.create({
          user_email: admin.email,
          type: 'admission_application_verified',
          title: 'Application Verified',
          message: `${data.student_name} (Class ${data.applying_for_class}) application has been verified by staff. Review and approve to create student record.`,
          entity_type: 'AdmissionApplication',
          entity_id: data.id,
          academic_year: data.academic_year,
          is_read: false
        });
      } catch {}
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});