import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { selectedStudents, academic_year, sender_id, sender_name } = await req.json();

    if (!selectedStudents || !Array.isArray(selectedStudents) || selectedStudents.length === 0) {
      return Response.json({ error: 'selectedStudents array is required' }, { status: 400 });
    }

    if (!academic_year || !sender_id || !sender_name) {
      return Response.json({ error: 'academic_year, sender_id, and sender_name are required' }, { status: 400 });
    }

    const results = {
      success_count: 0,
      failed_count: 0,
      notified_students: [] as string[],
      errors: [] as string[]
    };

    for (const student of selectedStudents) {
      try {
        // STEP A: Fetch push token
        const prefs = await base44.asServiceRole.entities.StudentNotificationPreference.filter({ 
          student_id: student.student_id 
        });
        const pushToken = prefs[0]?.browser_push_token;

        // STEP B: Create Message record
        await base44.asServiceRole.entities.Message.create({
          sender_id: sender_id,
          sender_name: sender_name,
          sender_role: "admin",
          recipient_type: "individual",
          recipient_id: student.student_id,
          recipient_name: student.student_name,
          subject: "Fee Payment Reminder",
          body: `Dear ${student.parent_name}, fee of ₹${student.due_amount} is pending for ${student.student_name} (${student.class_name}). Please pay at earliest.`,
          is_read: false,
          academic_year: academic_year
        });

        // STEP C: Send FCM notification
        if (pushToken) {
          try {
            const pushTokenObj = JSON.parse(pushToken);
            
            const fcmPayload = {
              message: {
                token: pushTokenObj.keys?.auth || pushToken,
                notification: {
                  title: "Fee Payment Reminder",
                  body: `Fee pending for ${student.student_name}. Tap to view.`
                },
                data: {
                  url: "/StudentMessaging",
                  type: "fee_reminder"
                }
              }
            };

            const fcmResponse = await fetch(
              `https://fcm.googleapis.com/v1/projects/${Deno.env.get('FCM_PROJECT_ID')}/messages:send`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${Deno.env.get('FCM_SERVER_KEY')}`
                },
                body: JSON.stringify(fcmPayload)
              }
            );

            if (!fcmResponse.ok) {
              console.warn(`FCM push failed for ${student.student_id}:`, await fcmResponse.text());
            }
          } catch (pushError) {
            console.warn(`Push notification error for ${student.student_id}:`, pushError.message);
          }
        }

        results.success_count++;
        results.notified_students.push(student.student_name);
      } catch (error) {
        results.failed_count++;
        results.errors.push(`${student.student_name}: ${error.message}`);
      }
    }

    return Response.json(results);
  } catch (error) {
    console.error('sendFeeReminder error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});