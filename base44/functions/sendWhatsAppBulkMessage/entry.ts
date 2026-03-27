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

    // Step 2: Build MSG91 bulk payload — single API call
    const toArray = recipients.map(r => ({
      phone: r.phone,
      var: r.variables,
    }));

    const msg91Payload = {
      integrated_number: MSG91_INTEGRATED_NUMBER,
      content_type: 'template',
      payload: {
        messaging_product: 'whatsapp',
        type: 'template',
        template: {
          name: template_id,
          language: { code: 'en' },
        },
        to: toArray,
      },
    };

    console.log(`[sendWhatsAppBulkMessage] Sending bulk to ${recipients.length} recipients`);

    // Step 3: Single API call to MSG91
    const apiRes = await fetch(MSG91_ENDPOINT, {
      method: 'POST',
      headers: {
        'authkey': MSG91_AUTH_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(msg91Payload),
    });

    const rawText = await apiRes.text();
    console.log('[sendWhatsAppBulkMessage] MSG91 HTTP status:', apiRes.status);
    console.log('[sendWhatsAppBulkMessage] MSG91 raw response:', rawText);
    let apiData = {};
    try { apiData = JSON.parse(rawText); } catch {}
    console.log('[sendWhatsAppBulkMessage] MSG91 parsed:', JSON.stringify(apiData));
    console.log('[sendWhatsAppBulkMessage] MSG91 error code:', apiData?.code || apiData?.error_code || 'N/A');
    console.log('[sendWhatsAppBulkMessage] MSG91 error message:', apiData?.message || apiData?.error || 'N/A');

    const sentAt = new Date().toISOString();

    if (apiRes.ok && apiData.type !== 'error') {
      // Step 4: Success — update all logs to "sent"
      const msgIds = apiData?.data?.message_ids || apiData?.message_ids || [];

      await Promise.all(logEntries.map((log, idx) =>
        base44.asServiceRole.entities.WhatsAppMessageLog.update(log.id, {
          status: 'sent',
          msg91_message_id: msgIds[idx] || null,
          status_history: [
            { status: 'queued', timestamp: now },
            { status: 'sent', timestamp: sentAt },
          ],
        })
      ));

      return Response.json({
        total: recipients.length,
        success: recipients.length,
        failed: 0,
        api_response: apiData,
      });

    } else {
      // Step 5: Failure — update all logs to "failed"
      const errorReason = apiData?.message || apiData?.error || 'MSG91 API error';

      await Promise.all(logEntries.map(log =>
        base44.asServiceRole.entities.WhatsAppMessageLog.update(log.id, {
          status: 'failed',
          error_reason: errorReason,
          status_history: [
            { status: 'queued', timestamp: now },
            { status: 'failed', timestamp: sentAt, reason: errorReason },
          ],
        })
      ));

      return Response.json({
        total: recipients.length,
        success: 0,
        failed: recipients.length,
        error: errorReason,
        api_response: apiData,
      });
    }

  } catch (error) {
    console.error('[sendWhatsAppBulkMessage] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});