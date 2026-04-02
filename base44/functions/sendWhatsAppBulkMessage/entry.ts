import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const MSG91_BULK_ENDPOINT = 'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/';
const MSG91_AUTH_KEY = Deno.env.get('MSG91_AUTH_KEY') || '';
const MSG91_INTEGRATED_NUMBER = Deno.env.get('MSG91_INTEGRATED_NUMBER') || '';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    try { await base44.auth.me(); } catch {}

    const { template_id, use_case, recipients } = await req.json();

    if (!template_id || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return Response.json({ error: 'template_id and recipients array are required' }, { status: 400 });
    }

    // Filter out invalid recipients (missing variables)
    const validRecipients = recipients.filter(r => r.variables && r.variables.length > 0);
    const invalidCount = recipients.length - validRecipients.length;

    if (validRecipients.length === 0) {
      return Response.json({ error: 'No valid recipients with variables' }, { status: 400 });
    }

    // Build ONE single bulk payload for all recipients — 1 MSG91 API call instead of N
    const to_and_components = validRecipients.map(r => ({
      to: [r.phone],
      components: r.variables.reduce((acc, v, i) => ({
        ...acc,
        [`body_${i + 1}`]: { type: 'text', value: String(v) }
      }), {})
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
          to_and_components,
        },
      },
    };

    console.log(`[sendWhatsAppBulkMessage] Sending 1 BULK call for ${validRecipients.length} recipients (was ${validRecipients.length} separate calls before)`);
    console.log('MSG91 BULK PAYLOAD:', JSON.stringify(msg91Payload, null, 2));

    // ONE API call for all recipients
    const apiRes = await fetch(MSG91_BULK_ENDPOINT, {
      method: 'POST',
      headers: { 'authkey': MSG91_AUTH_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(msg91Payload),
    });

    const rawText = await apiRes.text();
    console.log('MSG91 BULK RESPONSE:', { status: apiRes.status, body: rawText });
    let apiData = {};
    try { apiData = JSON.parse(rawText); } catch {}

    const success = apiRes.ok && apiData.type !== 'error';
    const logStatus = success ? 'sent' : 'failed';
    const errorReason = success ? null : (apiData?.message || apiData?.error || 'MSG91 API error');
    const now = new Date().toISOString();

    // Create log entries for all recipients in parallel (1 round of entity creates, no per-message updates)
    await Promise.all(validRecipients.map(r =>
      base44.asServiceRole.entities.WhatsAppMessageLog.create({
        student_id: r.student_id,
        phone_number_used: r.phone,
        template_id,
        use_case: use_case || 'Notice',
        message_variables: r.variables || [],
        status: logStatus,
        error_reason: errorReason || undefined,
        timestamp_sent: now,
        status_history: [{ status: logStatus, timestamp: now }],
      })
    ));

    console.log(`[sendWhatsAppBulkMessage] Done. success: ${success ? validRecipients.length : 0}, failed: ${success ? invalidCount : validRecipients.length + invalidCount}`);

    return Response.json({
      total: recipients.length,
      success: success ? validRecipients.length : 0,
      failed: success ? invalidCount : (validRecipients.length + invalidCount),
      msg91_response: apiData,
    });

  } catch (error) {
    console.error('[sendWhatsAppBulkMessage] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});