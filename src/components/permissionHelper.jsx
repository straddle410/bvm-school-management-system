/**
 * Permission helper for role-based access control.
 * Checks user permissions against required keys.
 * Supports admin override, legacy fees_reverse_receipt → fees_void_receipt mapping.
 */

/**
 * Backward compatibility mapping: old permission keys → new keys
 */
// Bidirectional legacy key map.
// OLD → CANONICAL: when code checks an old key, also check the canonical alt in permissions.
// CANONICAL → OLD: when code checks a new canonical key, also check old key in legacy sessions.
const LEGACY_PERMISSION_MAP = {
  // Old StaffAccount.permissions keys → canonical (supports old sessions with new code)
  attendance:                   'attendance_mark',
  manage_holidays:              'attendance_manage_holidays',
  override_holidays:            'attendance_override_holiday',
  marks:                        'marks_enter',
  post_notices:                 'notices_create',
  gallery:                      'gallery_upload',
  quiz:                         'quiz_create',
  quiz_create_edit:             'quiz_create',
  fees_reverse_receipt:         'fees_void_receipt',       // CRITICAL: old void key
  fees_apply_charge:            'fees_manage_adhoc_charges', // CRITICAL: old adhoc key
  fees_view_module:             'fees_view',
  fees_view_ledger:             'fees_ledger_view',
  student_admission_permission: 'admissions_review',
  admissions_view_module:       'admissions_view',
  attendance_view_module:       'attendance_view',
  marks_view_module:            'marks_view',
  notices_view_module:          'notices_view',
  gallery_view_module:          'gallery_view',
  quiz_view_module:             'quiz_view',

  // Canonical keys → old keys (supports new code with old legacy sessions)
  attendance_mark:              'attendance',
  attendance_manage_holidays:   'manage_holidays',
  attendance_override_holiday:  'override_holidays',
  marks_enter:                  'marks',
  notices_create:               'post_notices',
  gallery_upload:               'gallery',
  quiz_create:                  'quiz',
  fees_void_receipt:            'fees_reverse_receipt',
  fees_manage_adhoc_charges:    'fees_apply_charge',
  fees_view:                    'fees_view_module',
  fees_ledger_view:             'fees_view_ledger',
  admissions_review:            'student_admission_permission',
  admissions_view:              'admissions_view_module',
  attendance_view:              'attendance_view_module',
  marks_view:                   'marks_view_module',
  notices_view:                 'notices_view_module',
  gallery_view:                 'gallery_view_module',
  quiz_view:                    'quiz_view_module',
};

/**
 * Role checks — centralised so one change propagates everywhere.
 * principal has full admin access.
 * exam_staff has access only to marks/exams + attendance.
 */
export function isAdminRole(role) {
  const r = (role || '').toLowerCase();
  return r === 'admin' || r === 'principal';
}

export function isExamStaffRole(role) {
  return (role || '').toLowerCase() === 'exam_staff';
}

/**
 * Returns the effective permissions object for a session or staff record.
 * Prefers effective_permissions (Phase 2+ session format).
 * Falls back to permissions (legacy session format).
 * Always returns a plain object — never undefined or null.
 */
export function getEffectivePermissions(session) {
  if (!session) return {};
  if (session.effective_permissions !== undefined) {
    return session.effective_permissions || {};
  }
  return session.permissions || {};
}

export function can(user, permissionKey) {
  if (!user) return false;

  // Admin/Principal override — bypass all permission checks
  const isAdmin = isAdminRole(user?.role);
  if (isAdmin) return true;

  // Phase 2+ sessions: check effective_permissions first
  if (user?.effective_permissions) {
    if (user.effective_permissions[permissionKey] === true) return true;
    // Also check if a legacy/alternate key in effective_permissions matches
    const altKey = LEGACY_PERMISSION_MAP[permissionKey];
    if (altKey && user.effective_permissions[altKey] === true) return true;
  }

  // Legacy: direct check on permissions flat object (current session format)
  if (user?.permissions?.[permissionKey] === true) return true;

  // Legacy: check via bidirectional key mapping (old session, new canonical key in code)
  const mappedKey = LEGACY_PERMISSION_MAP[permissionKey];
  if (mappedKey && user?.permissions?.[mappedKey] === true) {
    return true;
  }

  return false;
}

/**
 * Gets default permissions object for a new staff member.
 * Used when creating staff accounts to ensure all keys are present.
 */
export const DEFAULT_PERMISSIONS = {
  // ===== ATTENDANCE =====
  attendance_view_module: false,
  attendance_mark: false,
  attendance_view_summary: false,
  attendance_manage_holidays: false,
  attendance_override_holiday: false,
  attendance_needs_approval: true,

  // ===== MARKS =====
  marks_view_module: false,
  marks_enter: false,
  marks_publish: false,
  marks_needs_approval: true,

  // ===== NOTICES =====
  notices_view_module: false,
  post_notices: false,
  notices_approve: false,
  notices_needs_approval: true,

  // ===== GALLERY =====
  gallery_view_module: false,
  gallery_upload: false,
  gallery_approve: false,
  gallery_needs_approval: true,

  // ===== QUIZ =====
  quiz_view_module: false,
  quiz_create_edit: false,
  quiz_publish: false,
  quiz_needs_approval: true,

  // ===== ADMISSIONS =====
  admissions_view_module: false,
  student_admission_permission: false,

  // ===== FEES MODULE =====
  fees_view_module: false,
  fees_view_ledger: false,
  fees_record_payment: false,
  fees_void_receipt: false,
  fees_print_receipt: false,
  fees_apply_discount: false,
  fees_manage_families: false,
  fees_manage_fee_plans: false,
  fees_manage_fee_heads: false,
  fees_manage_adhoc_charges: false,
  fees_generate_invoices: false,
  fees_configure_receipt_settings: false,
  fees_reset_fees_data: false,

  // ===== FEE REPORTS =====
  fee_reports_view: false,
  fee_reports_collection: false,
  fee_reports_outstanding: false,
  fee_reports_discount: false,
  fee_reports_student_ledger: false,
  fee_reports_export: false,

  // ===== LEGACY (for backward compatibility) =====
  attendance: false,
  manage_holidays: false,
  override_holidays: false,
  marks: false,
  gallery: false,
  quiz: false,
  fees_reverse_receipt: false,
  fees_apply_charge: false,
  fees_view_parent_statement: false,
};

/**
 * Permission categories for UI grouping (Roles tab).
 * Organized by module with module-level, tab-level, and action-level permissions.
 */
export const PERMISSION_CATEGORIES = [
  {
    label: 'Attendance',
    moduleKey: 'attendance_view_module',
    permissions: [
      { key: 'attendance_mark', label: 'Mark Attendance (Tab)', approvalKey: 'attendance_needs_approval' },
      { key: 'attendance_view_summary', label: 'View Summary (Tab)' },
      { key: 'attendance_manage_holidays', label: 'Manage Holidays (Tab)' },
      { key: 'attendance_override_holiday', label: 'Override Holiday & Mark' },
    ],
  },
  {
    label: 'Marks & Exams',
    moduleKey: 'marks_view_module',
    permissions: [
      { key: 'marks_enter', label: 'Enter Marks (Tab)', approvalKey: 'marks_needs_approval' },
      { key: 'marks_publish', label: 'Publish/Finalize Results' },
    ],
  },
  {
    label: 'Notices',
    moduleKey: 'notices_view_module',
    permissions: [
      { key: 'post_notices', label: 'Create/Post Notices', approvalKey: 'notices_needs_approval' },
      { key: 'notices_approve', label: 'Approve & Publish' },
    ],
  },
  {
    label: 'Gallery',
    moduleKey: 'gallery_view_module',
    permissions: [
      { key: 'gallery_upload', label: 'Upload Photos', approvalKey: 'gallery_needs_approval' },
      { key: 'gallery_approve', label: 'Approve & Publish' },
    ],
  },
  {
    label: 'Quiz',
    moduleKey: 'quiz_view_module',
    permissions: [
      { key: 'quiz_create_edit', label: 'Create/Edit Quizzes', approvalKey: 'quiz_needs_approval' },
      { key: 'quiz_publish', label: 'Publish/Manage' },
    ],
  },
  {
    label: 'Admissions',
    moduleKey: 'admissions_view_module',
    permissions: [
      { key: 'student_admission_permission', label: 'Review/Approve Applications' },
    ],
  },
  {
    label: 'Fees Module',
    moduleKey: 'fees_view_module',
    presets: [
      { name: 'Read-Only', perms: ['fees_view_module', 'fees_view_ledger'] },
      { name: 'Cashier', perms: ['fees_view_module', 'fees_view_ledger', 'fees_record_payment', 'fees_print_receipt'] },
      { name: 'Manager', perms: ['fees_view_module', 'fees_view_ledger', 'fees_record_payment', 'fees_void_receipt', 'fees_print_receipt', 'fees_apply_discount', 'fees_generate_invoices'] },
    ],
    permissions: [
      { key: 'fees_view_ledger', label: 'Student Ledger (Tab)' },
      { key: 'fees_record_payment', label: 'Record Payment & Generate Receipt' },
      { key: 'fees_print_receipt', label: 'Print Receipt' },
      { key: 'fees_void_receipt', label: 'Void/Reverse Receipt' },
      { key: 'fees_apply_discount', label: 'Apply Discounts (Tab)' },
      { key: 'fees_manage_families', label: 'Manage Families (Tab)' },
      { key: 'fees_manage_fee_plans', label: 'Manage Fee Plans (Tab)' },
      { key: 'fees_manage_fee_heads', label: 'Manage Fee Heads (Tab)' },
      { key: 'fees_manage_adhoc_charges', label: 'Additional Charges (Tab)' },
      { key: 'fees_generate_invoices', label: 'Generate/Regenerate Invoices' },
      { key: 'fees_configure_receipt_settings', label: 'Receipt Settings (Tab)' },
      { key: 'fees_reset_fees_data', label: 'Reset Fees Data (Admin Only)' },
    ],
  },
  {
    label: 'Fee Reports',
    moduleKey: 'fee_reports_view',
    permissions: [
      { key: 'fee_reports_collection', label: 'Collection/Day Book Report' },
      { key: 'fee_reports_outstanding', label: 'Outstanding/Due Report' },
      { key: 'fee_reports_discount', label: 'Discount Report' },
      { key: 'fee_reports_student_ledger', label: 'Student Ledger Report' },
      { key: 'fee_reports_export', label: 'Export Reports' },
    ],
  },
];