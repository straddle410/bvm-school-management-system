import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { userType, userId } = await req.json();

    if (!userType || !userId) {
      return Response.json({ error: 'userType and userId required' }, { status: 400 });
    }

    if (userType === 'student') {
      // Students can only delete their own account
      const student = await base44.entities.Student.filter({ username: user.email.split('@')[0] });
      if (!student || student.length === 0 || student[0].id !== userId) {
        return Response.json({ error: 'Forbidden: Can only delete own student account' }, { status: 403 });
      }

      await base44.entities.Student.update(userId, {
        is_deleted: true,
        deletion_type: 'self_delete',
        deleted_at: new Date().toISOString(),
        deleted_by: user.email,
        is_active: false
      });

      return Response.json({
        success: true,
        message: 'Student account deleted successfully',
        userType: 'student'
      });
    } else if (userType === 'staff') {
      // Staff can only delete their own account
      const staffSession = globalThis.staffSessionCache || {};
      const sessionUser = Object.values(staffSession).find(s => s.id === userId);

      if (!sessionUser || sessionUser.id !== userId) {
        return Response.json({ error: 'Forbidden: Can only delete own staff account' }, { status: 403 });
      }

      await base44.entities.StaffAccount.update(userId, {
        is_deleted: true,
        deletion_type: 'self_delete',
        deleted_at: new Date().toISOString(),
        deleted_by: user.email,
        is_active: false
      });

      return Response.json({
        success: true,
        message: 'Staff account deleted successfully',
        userType: 'staff'
      });
    } else {
      return Response.json({ error: 'Invalid userType' }, { status: 400 });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});