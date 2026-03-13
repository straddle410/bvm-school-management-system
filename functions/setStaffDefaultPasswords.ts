import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const defaultPassword = 'Bvm@1234';
    const staffEmails = [
      'A101@bvmschool.com',
      'straddle410@gmail.com',
      'A102@bvmschool.com',
      'T101@bvmschool.com',
      'T102@bvmschool.com'
    ];

    const results = [];

    for (const email of staffEmails) {
      console.log(`Setting password for: ${email}`);
      
      try {
        // Update password using Base44 service role
        await base44.asServiceRole.auth.updateUserPassword(email, defaultPassword);
        
        results.push({
          email,
          status: 'success',
          message: 'Password set to Bvm@1234'
        });
        
        console.log(`✓ Password updated for ${email}`);
      } catch (error) {
        results.push({
          email,
          status: 'error',
          error: error.message
        });
        console.error(`✗ Error for ${email}:`, error.message);
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;

    return Response.json({
      success: true,
      message: `Updated ${successCount} of ${staffEmails.length} accounts`,
      default_password: defaultPassword,
      results
    });

  } catch (error) {
    console.error('Error setting staff passwords:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});