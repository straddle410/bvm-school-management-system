import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const MSG91_ENDPOINT = 'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/';
const MSG91_AUTH_KEY = Deno.env.get('MSG91_AUTH_KEY') || '';
const MSG91_INTEGRATED_NUMBER = Deno.env.get('MSG91_INTEGRATED_NUMBER') || '';

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

    // Step 1: Create "queued" log entries for all recipients
    const logEntries = await Promise.all(recipients.map(({ student_id, phone, variables }) =>
      base44.asServiceRole.entities.WhatsAppMessageLog.create({
        student_id,
        phone_number_used: phone,
        template_id,
        use_case: use_case || 'Notice',
        message_variables: variables || [],
        status: 'queued',
        timestamp_sent: now,
        status_history: [{ status: 'queued', timestamp: now }],
      })
    ));

    // Step 2: Send one-by-one using components/parameters format
    console.log(`[sendWhatsAppBulkMessage] Sending to ${recipients.length} recipients one-by-one`);

    const sentAt = new Date().toISOString();
    let successCount = 0;
    let failedCount = 0;

    for (let i = 0; i < recipients.length; i++) {
      const r = recipients[i];
      const log = logEntries[i];

      if (!r.variables || r.variables.length === 0) {
        console.error(`[sendWhatsAppBulkMessage] Invalid variables for ${r.phone}:`, r.variables);
        failedCount++;
        await base44.asServiceRole.entities.WhatsAppMessageLog.update(log.id, {
          status: 'failed',
          error_reason: 'No variables provided',
          status_history: [{ status: 'queued', timestamp: now }, { status: 'failed', timestamp: sentAt, reason: 'No variables provided' }],
        });
        continue;
      }

      const msg91Payload = {
        integrated_number: MSG91_INTEGRATED_NUMBER,
        content_type: 'template',
        payload: {
          messaging_product: 'whatsapp',
          type: 'template',
          template: {
            name: template_id,
            language: { code: 'en' },
            components: [
              {
                type: 'body',
                parameters: r.variables.map(v => ({ type: 'text', text: String(v) })),
              },
            ],
          },
          to: r.phone,
        },
      };

      console.log('WA DEBUG REQUEST:', { phone: r.phone, template_id, variables: r.variables });
      console.log('MSG91 PAYLOAD:', JSON.stringify(msg91Payload, null, 2));

      try {
        const apiRes = await fetch(MSG91_ENDPOINT, {
          method: 'POST',
          headers: { 'authkey': MSG91_AUTH_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify(msg91Payload),
        });

        const rawText = await apiRes.text();
        console.log('WA DEBUG RESPONSE:', { phone: r.phone, status: apiRes.status, body: rawText });
        console.log(`[sendWhatsAppBulkMessage] ${r.phone} status:`, apiRes.status, rawText);
        let apiData = {};
        try { apiData = JSON.parse(rawText); } catch {}

        if (apiRes.ok && apiData.type !== 'error') {
          successCount++;
          await base44.asServiceRole.entities.WhatsAppMessageLog.update(log.id, {
            status: 'sent',
            msg91_message_id: apiData?.data?.message_id || null,
            status_history: [{ status: 'queued', timestamp: now }, { status: 'sent', timestamp: sentAt }],
          });
        } else {
          failedCount++;
          const errorReason = apiData?.message || apiData?.error || 'MSG91 API error';
          await base44.asServiceRole.entities.WhatsAppMessageLog.update(log.id, {
            status: 'failed',
            error_reason: errorReason,
            status_history: [{ status: 'queued', timestamp: now }, { status: 'failed', timestamp: sentAt, reason: errorReason }],
          });
        }
      } catch (sendErr) {
        failedCount++;
        console.error('WA ERROR:', { phone: r.phone, error: sendErr.message });
        console.error(`[sendWhatsAppBulkMessage] Error sending to ${r.phone}:`, sendErr.message);
        await base44.asServiceRole.entities.WhatsAppMessageLog.update(log.id, {
          status: 'failed',
          error_reason: sendErr.message,
          status_history: [{ status: 'queued', timestamp: now }, { status: 'failed', timestamp: sentAt, reason: sendErr.message }],
        });
      }
    }

    return Response.json({
      total: recipients.length,
      success: successCount,
      failed: failedCount,
    });

  } catch (error) {
    console.error('[sendWhatsAppBulkMessage] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});