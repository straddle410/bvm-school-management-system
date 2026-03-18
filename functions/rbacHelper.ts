/**
 * RBAC Helper Functions
 * 
 * Centralized role extraction and validation to prevent mismatches
 * across all RBAC-protected functions.
 */

/**
 * Extract effective role from user object
 * Tries multiple fallback sources to handle different auth flows
 */
export function getEffectiveRole(user, staffUser = null) {
  const candidates = [
    staffUser?.role,
    user?.role,
    user?.roleName,
    user?.user_metadata?.role,
    user?.app_metadata?.role
  ].filter(v => v !== null && v !== undefined && v !== '');

  const role = String(candidates[0] || '').trim().toLowerCase();
  return role;
}

/**
 * Check if role is authorized for specific operation
 * Returns error response or null if authorized
 */
export function checkRoleAuthorization(role, allowedRoles) {
  const normalizedAllowed = allowedRoles.map(r => String(r).trim().toLowerCase());
  if (!normalizedAllowed.includes(role)) {
    return Response.json(
      { error: 'Forbidden', userRole: role, requiredRoles: normalizedAllowed },
      { status: 403 }
    );
  }
  return null;
}

/**
 * Combined check: extract role + verify authorization
 * Usage: const blocked = requireRoles(user, ['admin', 'principal', 'accountant']);
 *        if (blocked) return blocked;
 */
export function requireRoles(user, allowedRoles, staffUser = null) {
  const role = getEffectiveRole(user, staffUser);
  return checkRoleAuthorization(role, allowedRoles);
}

/**
 * Get detailed role debugging info (for diagnostics)
 */
export function getRoleDebugInfo(user, staffUser = null) {
  return {
    effectiveRole: getEffectiveRole(user, staffUser),
    role: user?.role,
    roleName: user?.roleName,
    user_metadata_role: user?.user_metadata?.role,
    app_metadata_role: user?.app_metadata?.role,
    staffUserRole: staffUser?.role,
    userKeys: user ? Object.keys(user).filter(k => !k.includes('secret') && !k.includes('token')) : []
  };
}