import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * MSG91 WhatsApp Webhook Handler
 *
 * This function receives delivery status updates from MSG91.
 * Currently logs the incoming payload — full delivery status
 * update logic (updating WhatsAppMessageLog) to be implemented
 * once MSG91 account is live and webhook format is confirmed.
 *
 * Register this URL in your MSG91 account under:
 * Settings → Webhooks → WhatsApp Delivery Report URL
 */
Deno.serve(async (req) => {
  try {
    // Log raw body for debugging during integration
    const rawBody = await req.text();
    console.log('[handleMsg91Webhook] Raw payload received:', rawBody);

    let payload = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.warn('[handleMsg91Webhook] Could not parse JSON body');
    }

    console.log('[handleMsg91Webhook] Parsed payload:', JSON.stringify(payload, null, 2));

    // TODO (when MSG91 is live):
    // 1. Validate webhook authenticity (shared secret or IP whitelist)
    // 2. Extract message_id → payload.uuid or payload.msgId
    // 3. Extract status → payload.status (SENT / DELIVERED / READ / FAILED)
    // 4. Extract error reason → payload.deliveryMessage if status === FAILED
    // 5. Lookup WhatsAppMessageLog by msg91_message_id
    // 6. Update status, error_reason, status_history
    // 7. Update Student.last_whatsapp_status and is_whatsapp_available

    return Response.json({ received: true });

  } catch (error) {
    console.error('[handleMsg91Webhook] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});