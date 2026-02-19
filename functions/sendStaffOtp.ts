import { Resend } from 'npm:resend@3.2.0';

const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

Deno.serve(async (req) => {
  try {
    const { email, staffName } = await req.json();

    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 400 });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Send via Resend
    const result = await resend.emails.send({
      from: 'BVM School <onboarding@resend.dev>',
      to: email,
      subject: 'Your BVM School Admin Login OTP',
      html: `<p>Dear ${staffName || 'Admin'},</p><p>Your OTP for login is: <strong>${otp}</strong></p><p>This OTP is valid for 10 minutes.</p><p>Do not share this OTP with anyone.</p><p>Best regards,<br>BVM School of Excellence</p>`
    });

    if (result.error) {
      throw new Error(result.error.message);
    }

    return Response.json({ otp, success: true });
  } catch (error) {
    console.error('OTP Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});