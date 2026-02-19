import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { email, staffName } = await req.json();

    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 400 });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Send via Base44 SendEmail integration
    await base44.integrations.Core.SendEmail({
      to: email,
      subject: 'Your BVM School Admin Login OTP',
      body: `Dear ${staffName || 'Admin'},\n\nYour OTP for login is: ${otp}\n\nThis OTP is valid for 10 minutes.\n\nDo not share this OTP with anyone.\n\nBest regards,\nBVM School of Excellence`
    });

    return Response.json({ otp, success: true });
  } catch (error) {
    console.error('OTP Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});