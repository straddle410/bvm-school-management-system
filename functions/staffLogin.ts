import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import bcrypt from 'npm:bcryptjs@2.4.3';

function b64urlEncode(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function generateSessionToken(staff) {
  const secret = Deno.env.get('STAFF_SESSION_SECRET');
  if (!secret) throw new Error('STAFF_SESSION_SECRET is not set');
  
  const now = Date.now();
  const payload = {
    staff_id: staff.id,
    username: staff.username,
    role: staff.role,
    iat: now,
    exp: now + (24 * 60 * 60 * 1000), // 24 hours
  };
  
  const payloadStr = JSON.stringify(payload);
  const payloadB64 = b64urlEncode(payloadStr);
  
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64));
  const sigB64 = b64urlEncode(String.fromCharCode(...new Uint8Array(signature)));
  
  return `${payloadB64}.${sigB64}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { staff_code, password } = await req.json();

    if (!staff_code || !password) {
      return Response.json(
        { error: 'Staff ID and password are required' },
        { status: 400 }
      );
    }

    // STEP 1: Fetch staff record by staff_code (using service role, no auth required)
    let staffRecords = [];
    try {
      staffRecords = await base44.asServiceRole.entities.StaffAccount.filter({
        staff_code: staff_code.trim()
      });
    } catch (filterError) {
      console.error('Staff lookup error:', filterError.message);
      return Response.json(
        { error: 'Failed to retrieve staff information' },
        { status: 500 }
      );
    }

    if (!staffRecords || staffRecords.length === 0) {
      return Response.json(
        { error: 'Invalid Staff ID' },
        { status: 404 }
      );
    }

    const staff = staffRecords[0];

    // STEP 2: Verify password BEFORE checking status
    // This prevents timing attacks and confirms credentials first
    let passwordMatch = false;
    
    if (staff.password_hash) {
      try {
        passwordMatch = await bcrypt.compare(password, staff.password_hash);
      } catch (hashErr) {
        console.error('Password hash comparison error:', hashErr.message);
        return Response.json(
          { error: 'Login failed. Please try again.' },
          { status: 500 }
        );
      }
    } else if (staff.password) {
      // Legacy plain text password (deprecated)
      passwordMatch = (password === staff.password);
    }

    if (!passwordMatch) {
      return Response.json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }

    // STEP 3: Check account status AFTER password verification succeeds
    if (staff.status === 'rejected') {
      return Response.json(
        { error: 'Account has been rejected' },
        { status: 403 }
      );
    }

    if (staff.status === 'pending') {
      return Response.json(
        { error: 'Account pending approval' },
        { status: 403 }
      );
    }

    // STEP 4: Generate session token
    let sessionToken = '';
    try {
      sessionToken = await generateSessionToken(staff);
    } catch (tokenErr) {
      console.error('Session token generation error:', tokenErr.message);
      return Response.json(
        { error: 'Failed to create session. Please try again.' },
        { status: 500 }
      );
    }

    // STEP 5: Return staff details with session token
    return Response.json({
      success: true,
      staff: {
        id: staff.id,
        staff_code: staff.staff_code,
        full_name: staff.name,
        role: staff.role,
        department: staff.designation,
        status: staff.status,
        username: staff.username,
        email: staff.email,
        mobile: staff.mobile,
        force_password_change: staff.force_password_change || false,
        staff_session_token: sessionToken
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Staff login error:', error);
    return Response.json(
      { error: 'Login failed. Please try again.' },
      { status: 500 }
    );
  }
});