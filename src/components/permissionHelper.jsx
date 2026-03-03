/**
 * Permission helper for role-based access control.
 * Checks user permissions against required keys.
 * Supports admin override, legacy fees_reverse_receipt → fees_void_receipt mapping.
 */

export function can(user, permissionKey) {
  if (!user) return false;

  // Admin/Principal override (bypass all checks)
  const isAdmin = user?.role === 'admin' || user?.role === 'Admin' || 
                  user?.role === 'principal' || user?.role === 'Principal';
  if (isAdmin) return true;

  // Direct permission check
  if (user?.permissions?.[permissionKey] === true) return true;

  // Backward compatibility: fees_reverse_receipt → fees_void_receipt
  if (permissionKey === 'fees_void_receipt' && user?.permissions?.fees_reverse_receipt === true) {
    return true;
  }

  return false;
}

/**
 * Gets default permissions object for a new staff member.
 * Used when creating staff accounts to ensure all keys are present.
 */
export const DEFAULT_PERMISSIONS = {
  // Attendance
  attendance: false,
  attendance_needs_approval: true,
  manage_holidays: false,
  override_holidays: false,

  // Marks
  marks: false,
  marks_needs_approval: true,

  // Notices
  post_notices: false,
  notices_needs_approval: true,

  // Gallery
  gallery: false,
  gallery_needs_approval: true,

  // Quiz
  quiz: false,
  quiz_needs_approval: true,

  // Admissions
  student_admission_permission: false,

  // Fees — Legacy (for backward compatibility)
  fees_reverse_receipt: false,

  // Fees — New (Access & Operations)
  fees_view_module: false,
  fees_view_ledger: false,
  fees_record_payment: false,
  fees_void_receipt: false,
  fees_apply_discount: false,
  fees_apply_charge: false,
  fees_generate_invoices: false,

  // Fees — Configuration
  fees_manage_fee_heads: false,
  fees_manage_fee_plans: false,
  fees_manage_families: false,
  fees_configure_receipt_settings: false,

  // Fee Reports
  fee_reports_view: false,
  fee_reports_export: false,
  fee_reports_view_parent_statement: false,
};

/**
 * Permission categories for UI grouping (Roles tab, staff dialogs).
 */
export const PERMISSION_CATEGORIES = [
  {
    label: 'Attendance',
    permissions: [
      { key: 'attendance', label: 'Mark Attendance', approvalKey: 'attendance_needs_approval' },
      { key: 'manage_holidays', label: 'Manage Holidays (Create/Edit/Delete)', approvalKey: null },
      { key: 'override_holidays', label: 'Override Holiday & Take Attendance', approvalKey: null },
    ],
  },
  {
    label: 'Marks & Exams',
    permissions: [
      { key: 'marks', label: 'Enter Marks', approvalKey: 'marks_needs_approval' },
    ],
  },
  {
    label: 'Notices',
    permissions: [
      { key: 'post_notices', label: 'Post Notices', approvalKey: 'notices_needs_approval' },
    ],
  },
  {
    label: 'Gallery',
    permissions: [
      { key: 'gallery', label: 'Upload Gallery', approvalKey: 'gallery_needs_approval' },
    ],
  },
  {
    label: 'Quiz',
    permissions: [
      { key: 'quiz', label: 'Create/Edit Quizzes', approvalKey: 'quiz_needs_approval' },
    ],
  },
  {
    label: 'Admissions',
    permissions: [
      { key: 'student_admission_permission', label: 'Review Admission Applications', approvalKey: null },
    ],
  },
  {
    label: 'Fees — Access & Operations',
    permissions: [
      { key: 'fees_view_module', label: 'Access Fees Module', approvalKey: null },
      { key: 'fees_view_ledger', label: 'View Student Fee Ledger', approvalKey: null },
      { key: 'fees_record_payment', label: 'Record Payments & Generate Receipts', approvalKey: null },
      { key: 'fees_void_receipt', label: 'Void/Reverse Receipts', approvalKey: null },
      { key: 'fees_apply_discount', label: 'Apply Fee Discounts', approvalKey: null },
      { key: 'fees_apply_charge', label: 'Apply Additional Charges', approvalKey: null },
      { key: 'fees_generate_invoices', label: 'Generate/Regenerate Fee Invoices', approvalKey: null },
    ],
  },
  {
    label: 'Fees — Configuration',
    permissions: [
      { key: 'fees_manage_fee_heads', label: 'Manage Fee Heads (Tuition, Transport, etc)', approvalKey: null },
      { key: 'fees_manage_fee_plans', label: 'Manage Annual Fee Plans', approvalKey: null },
      { key: 'fees_manage_families', label: 'Manage Fee Families', approvalKey: null },
      { key: 'fees_configure_receipt_settings', label: 'Configure Receipt Settings', approvalKey: null },
    ],
  },
  {
    label: 'Fee Reports',
    permissions: [
      { key: 'fee_reports_view', label: 'View Fee Reports (Collection, Outstanding, etc)', approvalKey: null },
      { key: 'fee_reports_export', label: 'Export Fee Reports', approvalKey: null },
      { key: 'fee_reports_view_parent_statement', label: 'Generate Parent Statements', approvalKey: null },
    ],
  },
];