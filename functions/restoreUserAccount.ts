import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin-only check
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { userType, userId } = await req.json();

    if (!userType || !userId) {
      return Response.json({ error: 'userType and userId required' }, { status: 400 });
    }

    if (userType === 'student') {
      await base44.entities.Student.update(userId, {
        is_deleted: false,
        deletion_type: null,
        deleted_at: null,
        deleted_by: null,
        is_active: true
      });

      return Response.json({
        success: true,
        message: 'Student account restored successfully',
        userType: 'student'
      });
    } else if (userType === 'staff') {
      await base44.entities.StaffAccount.update(userId, {
        is_deleted: false,
        deletion_type: null,
        deleted_at: null,
        deleted_by: null,
        is_active: true
      });

      return Response.json({
        success: true,
        message: 'Staff account restored successfully',
        userType: 'staff'
      });
    } else {
      return Response.json({ error: 'Invalid userType' }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});