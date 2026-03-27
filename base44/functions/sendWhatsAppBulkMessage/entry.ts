import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { template_id, use_case, recipients } = await req.json();

    if (!template_id || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return Response.json({ error: 'template_id and recipients array are required' }, { status: 400 });
    }

    const now = new Date().toISOString();
    let delivered = 0;
    let failed = 0;

    for (const recipient of recipients) {
      const { student_id, phone, variables } = recipient;

      // Step 1: Create log entry with status = "sent"
      const log = await base44.asServiceRole.entities.WhatsAppMessageLog.create({
        student_id,
        phone_number_used: phone,
        template_id,
        use_case: use_case || 'Notice',
        message_variables: variables || [],
        status: 'sent',
        timestamp_sent: now,
        status_history: [{ status: 'sent', timestamp: now }],
      });

      // Step 2: Simulate 80% delivered / 20% failed
      const isDelivered = Math.random() < 0.8;
      const updatedStatus = isDelivered ? 'delivered' : 'failed';
      const errorReason = isDelivered ? null : 'Simulated failure: number not on WhatsApp';

      const statusNow = new Date().toISOString();

      // Step 3: Update log with final status
      await base44.asServiceRole.entities.WhatsAppMessageLog.update(log.id, {
        status: updatedStatus,
        error_reason: errorReason,
        status_history: [
          { status: 'sent', timestamp: now },
          { status: updatedStatus, timestamp: statusNow, reason: errorReason },
        ],
      });

      // Step 4: Update Student aggregate fields
      await base44.asServiceRole.entities.Student.update(student_id, {
        is_whatsapp_available: isDelivered,
        last_whatsapp_status: updatedStatus,
        last_whatsapp_error_reason: errorReason,
      });

      if (isDelivered) delivered++; else failed++;
    }

    return Response.json({
      total: recipients.length,
      delivered,
      failed,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});