import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { staff_code, mobile } = await req.json();

    if (!staff_code || !mobile) {
      return Response.json(
        { success: false, error: 'Staff code and mobile are required' },
        { status: 400 }
      );
    }

    // Find staff by staff_code
    const staffRecords = await base44.asServiceRole.entities.StaffAccount.filter({
      staff_code: staff_code.trim()
    });

    if (!staffRecords || staffRecords.length === 0) {
      return Response.json(
        { success: false, error: 'Staff not found' },
        { status: 404 }
      );
    }

    const staff = staffRecords[0];

    // Validate mobile number matches
    if (staff.mobile !== mobile.trim()) {
      return Response.json(
        { success: false, error: 'Mobile number does not match' },
        { status: 400 }
      );
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Set expiry to 10 minutes from now
    const expiryTime = new Date();
    expiryTime.setMinutes(expiryTime.getMinutes() + 10);

    // Update staff record with OTP and expiry
    await base44.asServiceRole.entities.StaffAccount.update(staff.id, {
      reset_otp: otp,
      reset_otp_expiry: expiryTime.toISOString()
    });

    // Send SMS via Fast2SMS
    const apiKey = Deno.env.get('FAST2SMS_API_KEY');
    if (!apiKey) {
      return Response.json(
        { success: false, error: 'SMS service not configured' },
        { status: 500 }
      );
    }

    const smsResponse = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        'authorization': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        route: 'otp',
        variables_values: otp,
        numbers: mobile.trim()
      })
    });

    const smsData = await smsResponse.json();

    if (smsData.return === true) {
      return Response.json({ success: true, message: 'OTP sent successfully' });
    } else {
      console.error('Fast2SMS error:', smsData);
      return Response.json(
        { success: false, error: 'Failed to send SMS' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Send OTP error:', error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
});