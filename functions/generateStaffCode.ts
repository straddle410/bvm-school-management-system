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
      return Response.json({ error: 'Missing role parameter' }, { status: 400 });
    }

    const prefix = (role === 'admin' || role === 'principal') ? 'A' : 'T';
    const counterKey = `staff_code_${prefix}`;

    // Get or create counter
    const counters = await base44.asServiceRole.entities.Counter.filter({ key: counterKey });
    let counter = counters.length > 0 ? counters[0] : null;
    
    if (!counter) {
      counter = await base44.asServiceRole.entities.Counter.create({
        key: counterKey,
        current_value: 0
      });
    }

    // Increment counter
    const nextValue = counter.current_value + 1;
    await base44.asServiceRole.entities.Counter.update(counter.id, {
      current_value: nextValue
    });

    // Generate staff code (A001, A002, T001, T002, etc.)
    const staffCode = `${prefix}${String(nextValue).padStart(3, '0')}`;

    return Response.json({
      success: true,
      staff_code: staffCode
    });
  } catch (error) {
    console.error('Error generating staff code:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});