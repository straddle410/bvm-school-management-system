import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

async function hashValue(value) {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function generateToken() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { otp, record_id } = await req.json();
    if (!otp || !record_id) {
      return Response.json({ error: 'otp and record_id required' }, { status: 400 });
    }

    // Fetch the OTP record
    const records = await base44.asServiceRole.entities.AdminResetLog.filter({ id: record_id });
    const record = records[0];
    if (!record) {
      return Response.json({ success: false, error: 'OTP record not found' }, { status: 404 });
    }

    // Check if already used
    if (record.otp_used) {
      return Response.json({ success: false, error: 'OTP already used. Please generate a new one.' });
    }

    // Check expiry
    if (new Date() > new Date(record.otp_expires_at)) {
      return Response.json({ success: false, error: 'OTP expired. Please generate a new one.', expired: true });
    }

    // Check max attempts
    const attempts = record.otp_attempts || 0;
    if (attempts >= 3) {
      return Response.json({ success: false, error: 'Too many failed attempts. Please generate a new OTP.', locked: true });
    }

    // Compare hash
    const inputHash = await hashValue(String(otp).trim());
    if (inputHash !== record.otp_hash) {
      const newAttempts = attempts + 1;
      await base44.asServiceRole.entities.AdminResetLog.update(record.id, { otp_attempts: newAttempts });
      return Response.json({
        success: false,
        error: 'Incorrect OTP',
        remaining_attempts: 3 - newAttempts
      });
    }

    // OTP correct — issue reset_token valid for 10 minutes
    const resetToken = await generateToken();
    const tokenHash = await hashValue(resetToken);
    const tokenExpiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    await base44.asServiceRole.entities.AdminResetLog.update(record.id, {
      otp_verified: true,
      otp_verified_at: new Date().toISOString(),
      reset_token_hash: tokenHash,
      reset_token_expires_at: tokenExpiresAt,
      reset_token_used: false
    });

    return Response.json({
      success: true,
      reset_token: resetToken,
      expires_at_token: tokenExpiresAt
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});