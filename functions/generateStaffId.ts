import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);

    if (!user || (user.role !== 'admin' && user.role !== 'principal')) {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { role } = await req.json();

    if (!role) {
      return Response.json({ error: 'Role is required' }, { status: 400 });
    }

    // Determine prefix based on role
    const prefix = (role === 'admin' || role === 'accountant') ? 'A' : 'T';
    const counterKey = `staff_code_${prefix}`;

    // Fetch current counter
    const counters = await base44.asServiceRole.entities.Counter.filter({ key: counterKey });
    
    if (counters.length === 0) {
      return Response.json({ error: `Counter ${counterKey} not found` }, { status: 404 });
    }

    const counter = counters[0];
    const newValue = (counter.current_value || 0) + 1;
    const generatedId = `${prefix}${newValue}`;

    // Update counter
    await base44.asServiceRole.entities.Counter.update(counter.id, {
      current_value: newValue
    });

    console.log(`Generated Staff ID: ${generatedId} (${counterKey}: ${counter.current_value} → ${newValue})`);

    return Response.json({
      success: true,
      staff_id: generatedId,
      prefix,
      counter_value: newValue
    });

  } catch (error) {
    console.error('Error generating staff ID:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});