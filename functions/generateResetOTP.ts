import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const OTP_EMAIL = 'straddle410@gmail.com';
const OTP_VALIDITY_MINUTES = 5;

function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Simple hash using Web Crypto (SHA-256)
async function hashValue(value) {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const otp = generateOTP();
    const otpHash = await hashValue(otp);
    const expiresAt = new Date(Date.now() + OTP_VALIDITY_MINUTES * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    // Store OTP record (creates a new AdminResetLog record to hold OTP state)
    const record = await base44.asServiceRole.entities.AdminResetLog.create({
      admin_user_id: user.email,
      timestamp: now,
      otp_hash: otpHash,
      otp_expires_at: expiresAt,
      otp_attempts: 0,
      otp_used: false,
      otp_verified: false,
      otp_email_used: OTP_EMAIL,
      is_dry_run: true // placeholder until reset runs
    });

    // Send email via Resend
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: OTP_EMAIL,
      subject: 'School Data Reset OTP',
      body: `Your OTP for School Data Reset is: ${otp}\n\nValid for ${OTP_VALIDITY_MINUTES} minutes.\n\nIf you did not request this, ignore this email.`
    });

    return Response.json({
      success: true,
      record_id: record.id,
      expires_at: expiresAt,
      otp_email: OTP_EMAIL
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});