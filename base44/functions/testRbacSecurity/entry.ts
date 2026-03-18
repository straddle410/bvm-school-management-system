/**
 * RBAC Role Debugging (Server-side)
 * 
 * Returns user details and role extraction debug info only.
 * Frontend tests (pages/RbacTest) test actual RBAC enforcement.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function getRoleDebugInfo(user) {
  return {
    role: user?.role,
    roleName: user?.roleName,
    user_metadata_role: user?.user_metadata?.role,
    app_metadata_role: user?.app_metadata?.role,
    userKeys: user ? Object.keys(user).filter(k => !k.includes('secret') && !k.includes('token')) : []
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (user.role || '').toLowerCase().trim();
    const results = {
      user: { email: user.email, role: userRole, id: user.id },
      effectiveRoleDebug: getRoleDebugInfo(user),
      message: 'Use pages/RbacTest for actual RBAC testing'
    };

    return Response.json(results);

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});