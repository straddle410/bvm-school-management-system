import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { event, data } = payload;

    if (event.type !== 'create') {
      return Response.json({ success: true });
    }

    // Get staff with student admission permission
    const staffAccounts = await base44.asServiceRole.entities.StaffAccount.list();
    const admissionStaff = staffAccounts.filter(staff => 
      staff.permissions?.student_admission_permission === true
    );

    // Notify each staff member
    for (const staff of admissionStaff) {
      try {
        await base44.asServiceRole.entities.Notification.create({
          user_email: staff.email,
          type: 'admission_application_submitted',
          title: 'New Admission Application',
          message: `${data.student_name} (Class ${data.applying_for_class}) has submitted an admission application. Please review.`,
          entity_type: 'AdmissionApplication',
          entity_id: data.id,
          academic_year: data.academic_year,
          is_read: false
        });
      } catch {}
    }

    // Also notify all admin staff
    const admins = await base44.asServiceRole.entities.StaffAccount.filter({ role: 'Admin' });
    for (const admin of admins) {
      try {
        await base44.asServiceRole.entities.Notification.create({
          user_email: admin.email,
          type: 'admission_application_submitted',
          title: 'New Admission Application',
          message: `${data.student_name} (Class ${data.applying_for_class}) has submitted an admission application.`,
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