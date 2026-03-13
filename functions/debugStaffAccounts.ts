import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Fetch all StaffAccount records
    const allStaffAccounts = await base44.asServiceRole.entities.StaffAccount.list();
    
    // Find specific staff codes
    const staffA101 = allStaffAccounts.find(s => s.staff_code === 'A101');
    const staffA102 = allStaffAccounts.find(s => s.staff_code === 'A102');

    // Fetch all User records
    const allUsers = await base44.asServiceRole.entities.User.list();

    return Response.json({
      success: true,
      staff_accounts: {
        total_count: allStaffAccounts.length,
        all_staff_codes: allStaffAccounts.map(s => ({
          staff_code: s.staff_code,
          username: s.username,
          email: s.email,
          name: s.name,
          role: s.role
        })),
        staff_A101: staffA101,
        staff_A102: staffA102
      },
      base44_users: {
        total_count: allUsers.length,
        all_users: allUsers.map(u => ({
          id: u.id,
          email: u.email,
          full_name: u.full_name,
          role: u.role
        }))
      }
    });
  } catch (error) {
    return Response.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});