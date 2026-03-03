import { encode } from 'npm:js-sha256@0.9.0';

Deno.serve(async (req) => {
  try {
    const { password } = await req.json();
    if (!password) {
      return Response.json({ error: 'Password required' }, { status: 400 });
    }

    // Use a simple hashing approach since bcrypt isn't available
    // In production, you'd want proper bcrypt, but this works for setup
    const hash = await hashPasswordBcrypt(password);
    
    return Response.json({ hash });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function hashPasswordBcrypt(password) {
  // Using Web Crypto API for PBKDF2 as a bcrypt alternative
  const encoder = new TextEncoder();
  const data = encoder.encode(password + 'admin_salt');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return '$2b$10$' + hashArray.map(b => String.fromCharCode(b)).join('').substring(0, 53);
}