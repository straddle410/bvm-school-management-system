import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20'; 

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { staff_code, mobile } = await req.json();
    
    if (!staff_code || !mobile) {
      return Response.json({ success: false, error: 'Staff code and mobile required' }, { status: 400 });
    }

    // Find staff by staff_code
    const staffRecords = await base44.asServiceRole.entities.StaffAccount.filter({
      staff_code: staff_code.trim()
    });

    if (!staffRecords || staffRecords.length === 0) {
      return Response.json({ success: false, error: 'Staff not found' }, { status: 404 });
    }

    const staff = staffRecords[0];

    // Validate mobile number matches
    if (staff.mobile !== mobile.trim()) {
      return Response.json({ success: false, error: 'Mobile number does not match' }, { status: 400 });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    console.log('Generated OTP:', otp);
    console.log('Sending to:', mobile);

    // Set expiry to 10 minutes from now
    const expiryTime = new Date();
    expiryTime.setMinutes(expiryTime.getMinutes() + 10);

    // Update staff record with OTP and expiry
    await base44.asServiceRole.entities.StaffAccount.update(staff.id, {
      reset_otp: otp,
      reset_otp_expiry: expiryTime.toISOString()
    });
    
    const apiKey = Deno.env.get('FAST2SMS_API_KEY');
    if (!apiKey) {
      return Response.json({ success: false, error: 'API key not found' }, { status: 500 });
    }
    
    const url = `https://www.fast2sms.com/dev/bulkV2?route=otp&variables_value=${otp}&numbers=${mobile}&flash=0&authorization=${apiKey}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'cache-control': 'no-cache'
      }
    });
    
    const text = await response.text();
    console.log('Fast2SMS response:', text);
    
    let result;
    try {
      result = JSON.parse(text);
    } catch(e) {
      throw new Error('Parse error: ' + text);
    }
    
    if(!result.return) {
      throw new Error('Fast2SMS error: ' + JSON.stringify(result));
    }
    
    return Response.json({ success: true, message: 'OTP sent successfully' });
    
  } catch(e) {
    console.log('Error:', e.message);
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
});