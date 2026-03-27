import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Map MSG91 status strings → our WhatsAppMessageLog status enum
const STATUS_MAP = {
  SENT: 'sent',
  DELIVERED: 'delivered',
  READ: 'delivered',   // treat READ as delivered for our purposes
  FAILED: 'failed',
};

Deno.serve(async (req) => {
  try {
    const rawBody = await req.text();
    console.log('[handleMsg91Webhook] Raw payload:', rawBody);

    let payload = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.warn('[handleMsg91Webhook] Could not parse JSON body');
      return Response.json({ received: true });
    }

    const uuid = payload.uuid || payload.msgId || payload.message_id;
    const rawStatus = (payload.status || '').toUpperCase();
    const deliveryMessage = payload.deliveryMessage || payload.delivery_message || null;
    const phone = payload.to || payload.mobile || null;

    console.log(`[handleMsg91Webhook] uuid=${uuid} status=${rawStatus} phone=${phone}`);

    if (!uuid) {
      console.warn('[handleMsg91Webhook] No uuid found in payload — ignoring');
      return Response.json({ received: true });
    }

    const mappedStatus = STATUS_MAP[rawStatus];
    if (!mappedStatus) {
      console.warn(`[handleMsg91Webhook] Unknown status "${rawStatus}" — ignoring`);
      return Response.json({ received: true });
    }

    // Initialize SDK as service role (no user session in webhook)
    const base44 = createClientFromRequest(req);

    // Find the WhatsAppMessageLog by msg91_message_id
    const logs = await base44.asServiceRole.entities.WhatsAppMessageLog.filter({
      msg91_message_id: uuid,
    });

    if (!logs || logs.length === 0) {
      console.warn(`[handleMsg91Webhook] No WhatsAppMessageLog found for uuid=${uuid} — ignoring`);
      return Response.json({ received: true });
    }

    const log = logs[0];

    // Idempotency: if status is already the same, skip update
    if (log.status === mappedStatus) {
      console.log(`[handleMsg91Webhook] Status already "${mappedStatus}" for log=${log.id} — skipping`);
      return Response.json({ received: true });
    }

    const now = new Date().toISOString();
    const existingHistory = Array.isArray(log.status_history) ? log.status_history : [];

    // Append new status entry to history
    const newHistory = [
      ...existingHistory,
      { status: mappedStatus, timestamp: now, reason: deliveryMessage || null },
    ];

    await base44.asServiceRole.entities.WhatsAppMessageLog.update(log.id, {
      status: mappedStatus,
      error_reason: mappedStatus === 'failed' ? (deliveryMessage || 'Delivery failed') : null,
      status_history: newHistory,
    });

    console.log(`[handleMsg91Webhook] Updated log=${log.id} → status=${mappedStatus}`);

    // Update Student aggregate fields
    if (log.student_id) {
      const isDelivered = mappedStatus === 'delivered';
      const isFailed = mappedStatus === 'failed';

      const studentUpdate = {
        last_whatsapp_status: mappedStatus,
        last_whatsapp_error_reason: isFailed ? (deliveryMessage || 'Delivery failed') : null,
      };

      // Only update is_whatsapp_available on terminal statuses
      if (isDelivered) studentUpdate.is_whatsapp_available = true;
      if (isFailed) studentUpdate.is_whatsapp_available = false;

      await base44.asServiceRole.entities.Student.update(log.student_id, studentUpdate);
      console.log(`[handleMsg91Webhook] Updated student=${log.student_id} whatsapp status`);
    }

    return Response.json({ received: true });

  } catch (error) {
    console.error('[handleMsg91Webhook] Error:', error.message);
    // Always return 200 to MSG91 so it doesn't keep retrying on our internal errors
    return Response.json({ received: true, warning: error.message });
  }
});