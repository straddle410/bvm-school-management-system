import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { staff_code } = await req.json();

    if (!staff_code) {
      return Response.json(
        { error: 'staff_code required' },
        { status: 400 }
      );
    }

    // Check all staff records to find duplicates or mismatches
    const allStaff = await base44.asServiceRole.entities.StaffAccount.list();
    
    // Filter for the specific code
    const matchedRecords = await base44.asServiceRole.entities.StaffAccount.filter({
      staff_code: staff_code.trim()
    });

    // Check for case-insensitive matches
    const caseInsensitiveMatches = allStaff.filter(s => 
      s.staff_code && s.staff_code.toLowerCase() === staff_code.trim().toLowerCase()
    );

    // Find all staff with codes starting with T or A
    const t103Records = allStaff.filter(s => s.staff_code === 'T103');
    const a103Records = allStaff.filter(s => s.staff_code === 'A103');

    return Response.json({
      requested_code: staff_code.trim(),
      filter_result_count: matchedRecords.length,
      filter_result: matchedRecords.length > 0 ? matchedRecords[0] : null,
      case_insensitive_matches: caseInsensitiveMatches.map(s => ({
        id: s.id,
        staff_code: s.staff_code,
        name: s.name,
        role: s.role
      })),
      t103_count: t103Records.length,
      t103_records: t103Records.map(s => ({
        id: s.id,
        staff_code: s.staff_code,
        name: s.name,
        role: s.role,
        password_hash_length: s.password_hash ? s.password_hash.length : 0
      })),
      a103_count: a103Records.length,
      a103_records: a103Records.map(s => ({
        id: s.id,
        staff_code: s.staff_code,
        name: s.name,
        role: s.role,
        password_hash_length: s.password_hash ? s.password_hash.length : 0
      })),
      total_staff: allStaff.length
    });
  } catch (error) {
    console.error('Debug error:', error);
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }
});