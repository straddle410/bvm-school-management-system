import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const { email, staffName } = await req.json();

    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 400 });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Send via Resend
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      return Response.json({ error: 'Email service not configured' }, { status: 500 });
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'onboarding@resend.dev',
        to: email,
        subject: 'Your BVM School Admin Login OTP',
        html: `<p>Dear ${staffName || 'Admin'},</p><p>Your OTP for login is: <strong>${otp}</strong></p><p>This OTP is valid for 10 minutes.</p><p>Do not share this OTP with anyone.</p><p>Best regards,<br>BVM School of Excellence</p>`
      })
    });

    if (!response.ok) {
      const error = await response.json();
      return Response.json({ error: error.message || 'Failed to send email' }, { status: 500 });
    }

    return Response.json({ otp, success: true });
  } catch (error) {
    console.error('OTP Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});