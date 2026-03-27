import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// ─── CONFIG ─────────────────────────────────────────────────────────────────
// Set USE_MOCK = false when MSG91 account is ready and MSG91_AUTH_KEY is set.
const USE_MOCK = true;

const MSG91_ENDPOINT = 'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/';
const MSG91_AUTH_KEY = Deno.env.get('MSG91_AUTH_KEY') || '';
const MSG91_INTEGRATED_NUMBER = Deno.env.get('MSG91_INTEGRATED_NUMBER') || '';

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/**
 * Convert our recipients array into MSG91 to_and_components format.
 * variables[0] → body_1, variables[1] → body_2, etc.
 */
function buildMsg91Payload(template_id, recipients) {
  const to_and_components = recipients.map(({ phone, variables }) => {
    const components = {};
    (variables || []).forEach((val, idx) => {
      components[`body_${idx + 1}`] = { type: 'text', value: val };
    });
    return { to: [phone], components };
  });

  return {
    integrated_number: MSG91_INTEGRATED_NUMBER,
    content_type: 'template',
    payload: {
      messaging_product: 'whatsapp',
      type: 'template',
      template: {
        name: template_id,
        language: { code: 'en', policy: 'deterministic' },
        namespace: null,
        to_and_components,
      },
    },
  };
}

// ─── MOCK LOGIC ───────────────────────────────────────────────────────────────

async function runMock(base44, template_id, use_case, recipients) {
  const now = new Date().toISOString();
  let delivered = 0;
  let failed = 0;

  for (const recipient of recipients) {
    const { student_id, phone, variables } = recipient;

    // Create log with status = "queued"
    const log = await base44.asServiceRole.entities.WhatsAppMessageLog.create({
      student_id,
      phone_number_used: phone,
      template_id,
      use_case: use_case || 'Notice',
      message_variables: variables || [],
      status: 'queued',
      timestamp_sent: now,
      status_history: [{ status: 'queued', timestamp: now }],
    });

    // Simulate 80% delivered / 20% failed
    const isDelivered = Math.random() < 0.8;
    const updatedStatus = isDelivered ? 'delivered' : 'failed';
    const errorReason = isDelivered ? null : 'Simulated failure: number not on WhatsApp';
    const statusNow = new Date().toISOString();

    await base44.asServiceRole.entities.WhatsAppMessageLog.update(log.id, {
      status: updatedStatus,
      error_reason: errorReason,
      status_history: [
        { status: 'queued', timestamp: now },
        { status: updatedStatus, timestamp: statusNow, reason: errorReason },
      ],
    });

    await base44.asServiceRole.entities.Student.update(student_id, {
      is_whatsapp_available: isDelivered,
      last_whatsapp_status: updatedStatus,
      last_whatsapp_error_reason: errorReason,
    });

    if (isDelivered) delivered++; else failed++;
  }

  return { total: recipients.length, delivered, failed, mode: 'mock' };
}

// ─── REAL MSG91 LOGIC ─────────────────────────────────────────────────────────

async function runMsg91(base44, template_id, use_case, recipients) {
  const now = new Date().toISOString();

  // Step 1: Create "queued" log entries for all recipients upfront
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

  // Step 2: Build MSG91 payload and call API
  const payload = buildMsg91Payload(template_id, recipients);

  const apiRes = await fetch(MSG91_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'authkey': MSG91_AUTH_KEY,
    },
    body: JSON.stringify(payload),
  });

  const apiData = await apiRes.json().catch(() => ({}));
  console.log('MSG91 API response:', JSON.stringify(apiData));

  const sentAt = new Date().toISOString();

  // Step 3: Update all logs to "sent" (webhook will update to delivered/failed later)
  // MSG91 may return message IDs — map by index if available
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

  return {
    total: recipients.length,
    delivered: 0,    // Will be updated via webhook
    failed: 0,       // Will be updated via webhook
    mode: 'msg91',
    api_response: apiData,
  };
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────

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

    console.log(`[sendWhatsAppBulkMessage] mode=${USE_MOCK ? 'MOCK' : 'MSG91'} recipients=${recipients.length}`);

    const result = USE_MOCK
      ? await runMock(base44, template_id, use_case, recipients)
      : await runMsg91(base44, template_id, use_case, recipients);

    return Response.json(result);

  } catch (error) {
    console.error('[sendWhatsAppBulkMessage] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});