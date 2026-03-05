/**
 * Centralized permission helper for RBAC
 * Handles:
 * - Admin/Principal override
 * - Role template-based permissions
 * - Permission overrides
 * - Legacy permission fallback
 * - Backward compatibility for fees_reverse_receipt
 */

/**
 * Check if a user/staff has a specific permission
 * @param {Object} user - Staff account object with role_template_id, permissions_override, permissions
 * @param {string} permissionKey - Permission key to check
 * @param {Array} roleTemplates - Available role templates (optional for caching)
 * @returns {boolean}
 */
export const canStaff = (user, permissionKey, roleTemplates = null) => {
  if (!user) return false;

  // Admin/Principal bypass - full access (principal === admin permissions)
  const role = (user.role || '').toLowerCase();
  if (role === 'admin' || role === 'principal') {
    return true;
  }

  // If user has role_template_id, use template-based permissions
  if (user.role_template_id) {
    // In a real app, you'd fetch the template
    // For now, assume it's passed or cached
    let effectivePermissions = {};
    
    // Apply role template permissions
    // (You can fetch these from context/cache or pass them)
    
    // Apply permission overrides
    if (user.permissions_override && user.permissions_override[permissionKey]) {
      return user.permissions_override[permissionKey];
    }
    
    // Check template (requires external data)
    return false; // Default deny if template not loaded
  }

  // Fallback to legacy permissions object
  if (user.permissions) {
    // Handle backward compatibility: fees_reverse_receipt → fees_void_receipt
    if (permissionKey === 'fees_void_receipt' && user.permissions.fees_reverse_receipt) {
      return true;
    }
    
    return !!user.permissions[permissionKey];
  }

  return false;
};

/**
 * Get effective permissions for a staff member
 * Merges role template + overrides + legacy
 */
export const getEffectivePermissions = (user, template = null) => {
  let effective = {};

  // Start with template permissions
  if (template && template.permissions) {
    effective = { ...template.permissions };
  }

  // Override with explicit overrides
  if (user.permissions_override) {
    effective = { ...effective, ...user.permissions_override };
  }

  // Handle backward compatibility
  if (user.permissions && user.permissions.fees_reverse_receipt) {
    effective.fees_void_receipt = true;
  }

  return effective;
};

/**
 * All available permission keys (for UI display)
 */
export const ALL_PERMISSIONS = {
  // Attendance
  attendance: { label: 'Mark Attendance', category: 'Attendance' },
  attendance_needs_approval: { label: 'Attendance Needs Approval', category: 'Attendance' },
  manage_holidays: { label: 'Manage Holidays', category: 'Attendance' },
  override_holidays: { label: 'Override Holidays', category: 'Attendance' },

  // Marks
  marks: { label: 'Mark Entry', category: 'Marks' },
  marks_needs_approval: { label: 'Marks Needs Approval', category: 'Marks' },

  // Notices
  post_notices: { label: 'Post Notices', category: 'Notices' },
  notices_needs_approval: { label: 'Notices Needs Approval', category: 'Notices' },

  // Gallery
  gallery: { label: 'Manage Gallery', category: 'Gallery' },
  gallery_needs_approval: { label: 'Gallery Needs Approval', category: 'Gallery' },

  // Quiz
  quiz: { label: 'Create Quiz', category: 'Quiz' },
  quiz_needs_approval: { label: 'Quiz Needs Approval', category: 'Quiz' },

  // Admissions
  student_admission_permission: { label: 'Review Admissions', category: 'Admissions' },

  // Fees
  fees_view_module: { label: 'View Fees Module', category: 'Fees' },
  fees_view_ledger: { label: 'View Student Ledger', category: 'Fees' },
  fees_record_payment: { label: 'Record Payment', category: 'Fees' },
  fees_void_receipt: { label: 'Void Receipt', category: 'Fees' },
  fees_apply_discount: { label: 'Apply Discount', category: 'Fees' },
  fees_apply_charge: { label: 'Apply Charge', category: 'Fees' },
  fees_generate_invoices: { label: 'Generate Invoices', category: 'Fees' },
  fees_manage_fee_heads: { label: 'Manage Fee Heads', category: 'Fees' },
  fees_manage_fee_plans: { label: 'Manage Fee Plans', category: 'Fees' },
  fees_manage_families: { label: 'Manage Families', category: 'Fees' },
  fees_configure_receipt_settings: { label: 'Configure Receipt Settings', category: 'Fees' },

  // Fee Reports
  fee_reports_view: { label: 'View Fee Reports', category: 'Reports' },
  fee_reports_export: { label: 'Export Fee Reports', category: 'Reports' },
  fee_reports_view_parent_statement: { label: 'Parent Statement', category: 'Reports' },
};

/**
 * Default role templates
 */
export const DEFAULT_ROLE_TEMPLATES = [
  {
    name: 'Teacher',
    description: 'Full teaching permissions',
    permissions: {
      attendance: true,
      marks: true,
      post_notices: true,
      gallery: true,
      quiz: true,
    },
    is_system: true,
  },
  {
    name: 'Accountant',
    description: 'Financial operations',
    permissions: {
      fees_view_module: true,
      fees_view_ledger: true,
      fees_record_payment: true,
      fees_void_receipt: true,
      fees_apply_discount: true,
      fees_apply_charge: true,
      fees_generate_invoices: true,
      fee_reports_view: true,
      fee_reports_export: true,
    },
    is_system: true,
  },
  {
    name: 'Librarian',
    description: 'Library management',
    permissions: {
      gallery: true,
    },
    is_system: true,
  },
  {
    name: 'Staff',
    description: 'Basic staff access',
    permissions: {},
    is_system: true,
  },
  {
    // Principal: full admin access — role check bypasses permission lookup
    name: 'Principal',
    description: 'Full admin access — same as Admin role',
    permissions: {},  // not needed; role bypass handles it
    is_system: true,
  },
  {
    // Exam Staff: marks + attendance only
    name: 'Exam Staff',
    description: 'Limited to Marks/Exams and Attendance modules only',
    permissions: {
      attendance_view_module: true,
      attendance_mark: true,
      attendance_view_summary: true,
      marks_view_module: true,
      marks_enter: true,
      marks_publish: false,
      // Legacy keys
      attendance: true,
      marks: true,
    },
    is_system: true,
  },
];