import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    if (!data || data.status !== 'Published') {
      return Response.json({ success: true, notified: 0 });
    }

    const diary = data;
    const class_name = diary.class_name;
    const section = diary.section || 'A';

    if (!class_name) {
      return Response.json({ success: true, notified: 0 });
    }

    // Get current academic year
    const currentAcademicYear = diary.academic_year || '2024-25';

    // FIX #1a: Add academic year filter to prevent multi-year notifications
    // Status: 'Published' = actively enrolled students (Previous statuses: Pending, Verified, Approved)
    const students = await base44.asServiceRole.entities.Student.filter({
      class_name: class_name,
      section: section,
      status: 'Published',
      academic_year: currentAcademicYear,
    });

    if (students.length === 0) {
      return Response.json({ success: true, notified: 0 });
    }

    // IDEMPOTENCY STRATEGY: Option A - Second verification inside creation
    // Check for existing notifications to avoid duplicates
    const existingNotifs = await base44.asServiceRole.entities.Notification.filter({
      type: 'diary_published',
      related_entity_id: diary.id,
    });
    const alreadyNotified = new Set(existingNotifs.map(n => n.recipient_student_id));

    let notified = 0;

    // Convert to parallel creation with race window closure
    const notificationPromises = students
      .filter(s => !alreadyNotified.has(s.student_id))
      .map(async (student) => {
        try {
          // IDEMPOTENCY: Second micro-check right before create
          const existsNow = await base44.asServiceRole.entities.Notification.filter({
            type: 'diary_published',
            related_entity_id: diary.id,
            recipient_student_id: student.student_id,
          });
          
          if (existsNow.length > 0) {
            return null;
          }

          const created = await base44.asServiceRole.entities.Notification.create({
            recipient_student_id: student.student_id,
            type: 'diary_published',
            title: 'Class Diary Published',
            message: diary.title || `Class diary for Class ${class_name}`,
            related_entity_id: diary.id,
            action_url: '/Diary',
            is_read: false,
            duplicate_key: `diary_${diary.id}_${student.student_id}`,
          });
          
          return created;
        } catch (err) {
          if (err.message?.includes('duplicate') || err.message?.includes('unique')) {
            console.warn(`Duplicate diary notification for ${student.student_id}, ignoring`);
            return null;
          }
          console.error(`Failed to notify ${student.student_id}:`, err.message);
          return null;
        }
      });
    
    const results = await Promise.all(notificationPromises);
    notified = results.filter(r => r !== null).length;

    // Push notifications removed for diary to optimize credit usage
    // In-app notifications (created above) are sufficient for daily diary updates

    return Response.json({ success: true, notified });
  } catch (error) {
    console.error('Error in notifyStudentsOnDiaryPublish:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});