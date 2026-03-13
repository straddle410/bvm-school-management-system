import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import bcrypt from 'npm:bcryptjs@2.4.3';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);

    if (!user || (user.role !== 'admin' && user.role !== 'principal')) {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const staffData = await req.json();
    const { role, password } = staffData;

    if (!role) {
      return Response.json({ error: 'Role is required' }, { status: 400 });
    }

    // Auto-generate Staff ID based on role
    const prefix = (role === 'admin' || role === 'accountant') ? 'A' : 'T';
    const counterKey = `staff_code_${prefix}`;

    // Fetch and increment counter
    const counters = await base44.asServiceRole.entities.Counter.filter({ key: counterKey });
    
    if (counters.length === 0) {
      return Response.json({ error: `Counter ${counterKey} not found. Please create it first.` }, { status: 404 });
    }

    const counter = counters[0];
    const newValue = (counter.current_value || 0) + 1;
    const generatedId = `${prefix}${newValue}`;

    // Update counter
    await base44.asServiceRole.entities.Counter.update(counter.id, {
      current_value: newValue
    });

    console.log(`Generated Staff ID: ${generatedId} for ${staffData.name}`);

    // Hash password
    const password_hash = await bcrypt.hash(password || 'password123', 10);

    // Create staff account with auto-generated ID
    const newStaff = await base44.asServiceRole.entities.StaffAccount.create({
      ...staffData,
      staff_code: generatedId,
      username: generatedId,
      password_hash,
      force_password_change: true,
      is_active: true,
      failed_login_attempts: 0
    });

    console.log(`✓ Created staff: ${newStaff.name} (${generatedId})`);

    return Response.json({
      success: true,
      staff: newStaff,
      generated_id: generatedId,
      message: `Staff account created with ID: ${generatedId}`
    });

  } catch (error) {
    console.error('Error creating staff with auto ID:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});