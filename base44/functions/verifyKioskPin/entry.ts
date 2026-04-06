import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { pin } = await req.json();

  if (!pin) {
    return Response.json({ success: false, message: 'PIN is required.' }, { status: 400 });
  }

  const records = await base44.asServiceRole.entities.KioskPasscode.list();

  if (!records || records.length === 0) {
    // No PIN configured — default is 123456
    if (pin === '123456') {
      return Response.json({ success: true });
    }
    return Response.json({ success: false, message: 'Incorrect PIN.' });
  }

  const passcode = records[0];

  if (!passcode.is_active) {
    return Response.json({ success: true }); // PIN disabled — allow through
  }

  if (pin === passcode.pin) {
    return Response.json({ success: true });
  }

  return Response.json({ success: false, message: 'Incorrect PIN. Please try again.' });
});