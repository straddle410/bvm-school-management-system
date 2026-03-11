/**
 * CANONICAL PERMISSION REGISTRY
 *
 * Single source of truth for ALL permission keys, base role permissions,
 * page access rules, and dashboard tile configuration.
 *
 * Phase 1 — Foundation (additive only, no runtime wiring yet).
 * Pages/guards/dashboard will wire to this in Phases 3–5.
 *
 * DO NOT import runtime dependencies (React, lucide, base44) here.
 * This is a pure data/constants module.
 */

// ─── Permission Key Constants ─────────────────────────────────────────────────
// Reference these via PERMS.X throughout the codebase to prevent typos.
export const PERMS = {
  // Attendance
  ATTENDANCE_VIEW:             'attendance_view',
  ATTENDANCE_MARK:             'attendance_mark',
  ATTENDANCE_VIEW_SUMMARY:     'attendance_view_summary',
  ATTENDANCE_VIEW_SNAPSHOT:    'attendance_view_snapshot',
  ATTENDANCE_MANAGE_HOLIDAYS:  'attendance_manage_holidays',
  ATTENDANCE_OVERRIDE_HOLIDAY: 'attendance_override_holiday',
  ATTENDANCE_NEEDS_APPROVAL:   'attendance_needs_approval',

  // Marks & Exams
  MARKS_VIEW:              'marks_view',
  MARKS_ENTER:             'marks_enter',
  MARKS_PUBLISH:           'marks_publish',
  MARKS_NEEDS_APPROVAL:    'marks_needs_approval',
  EXAMS_VIEW:              'exams_view',
  EXAMS_MANAGE:            'exams_manage',
  HALL_TICKETS_GENERATE:   'hall_tickets_generate',
  PROGRESS_CARDS_GENERATE: 'progress_cards_generate',

  // Notices
  NOTICES_VIEW:           'notices_view',
  NOTICES_CREATE:         'notices_create',
  NOTICES_APPROVE:        'notices_approve',
  NOTICES_NEEDS_APPROVAL: 'notices_needs_approval',

  // Gallery
  GALLERY_VIEW:           'gallery_view',
  GALLERY_UPLOAD:         'gallery_upload',
  GALLERY_APPROVE:        'gallery_approve',
  GALLERY_NEEDS_APPROVAL: 'gallery_needs_approval',

  // Quiz
  QUIZ_VIEW:           'quiz_view',
  QUIZ_CREATE:         'quiz_create',
  QUIZ_PUBLISH:        'quiz_publish',
  QUIZ_NEEDS_APPROVAL: 'quiz_needs_approval',

  // Homework
  HOMEWORK_VIEW:   'homework_view',
  HOMEWORK_MANAGE: 'homework_manage',

  // Diary
  DIARY_VIEW:   'diary_view',
  DIARY_MANAGE: 'diary_manage',

  // Timetable
  TIMETABLE_VIEW:   'timetable_view',
  TIMETABLE_MANAGE: 'timetable_manage',

  // Admissions
  ADMISSIONS_VIEW:   'admissions_view',
  ADMISSIONS_REVIEW: 'admissions_review',

  // Students
  STUDENTS_VIEW:   'students_view',
  STUDENTS_MANAGE: 'students_manage',

  // Messages
  MESSAGES_VIEW: 'messages_view',
  MESSAGES_SEND: 'messages_send',

  // Calendar
  CALENDAR_VIEW: 'calendar_view',

  // Reports
  REPORTS_VIEW: 'reports_view',

  // Fees Module
  FEES_VIEW:              'fees_view',
  FEES_LEDGER_VIEW:       'fees_ledger_view',
  FEES_RECORD_PAYMENT:    'fees_record_payment',
  FEES_VOID_RECEIPT:      'fees_void_receipt',
  FEES_PRINT_RECEIPT:     'fees_print_receipt',
  FEES_APPLY_DISCOUNT:    'fees_apply_discount',
  FEES_MANAGE_FAMILIES:   'fees_manage_families',
  FEES_MANAGE_FEE_PLANS:  'fees_manage_fee_plans',
  FEES_MANAGE_FEE_HEADS:  'fees_manage_fee_heads',
  FEES_MANAGE_ADHOC:      'fees_manage_adhoc_charges',
  FEES_GENERATE_INVOICES: 'fees_generate_invoices',
  FEES_CONFIGURE_RECEIPT: 'fees_configure_receipt_settings',

  // Fee Reports
  FEE_REPORTS_VIEW:             'fee_reports_view',
  FEE_REPORTS_COLLECTION:       'fee_reports_collection',
  FEE_REPORTS_OUTSTANDING:      'fee_reports_outstanding',
  FEE_REPORTS_LEDGER:           'fee_reports_ledger',
  FEE_REPORTS_EXPORT:           'fee_reports_export',
  FEE_REPORTS_PARENT_STATEMENT: 'fee_reports_parent_statement',
};

// ─── Legacy Key Map ───────────────────────────────────────────────────────────
// BIDIRECTIONAL mapping covering:
//   OLD key → CANONICAL key  (old session, new code calls can(user, 'marks_enter'))
//   CANONICAL key → OLD key  (new canonical code, old session has 'marks: true')
//
// Used by permissionHelper.can() — do NOT use this map directly in pages.
export const LEGACY_KEY_MAP = {
  // ── Old StaffAccount.permissions keys → canonical (old session → new code) ──
  attendance:                   PERMS.ATTENDANCE_MARK,
  manage_holidays:              PERMS.ATTENDANCE_MANAGE_HOLIDAYS,
  override_holidays:            PERMS.ATTENDANCE_OVERRIDE_HOLIDAY,
  marks:                        PERMS.MARKS_ENTER,
  post_notices:                 PERMS.NOTICES_CREATE,
  gallery:                      PERMS.GALLERY_UPLOAD,
  quiz:                         PERMS.QUIZ_CREATE,
  quiz_create_edit:             PERMS.QUIZ_CREATE,
  fees_reverse_receipt:         PERMS.FEES_VOID_RECEIPT,       // CRITICAL fix
  fees_apply_charge:            PERMS.FEES_MANAGE_ADHOC,       // CRITICAL fix
  fees_view_module:             PERMS.FEES_VIEW,
  fees_view_ledger:             PERMS.FEES_LEDGER_VIEW,
  student_admission_permission: PERMS.ADMISSIONS_REVIEW,
  admissions_view_module:       PERMS.ADMISSIONS_VIEW,
  attendance_view_module:       PERMS.ATTENDANCE_VIEW,
  marks_view_module:            PERMS.MARKS_VIEW,
  notices_view_module:          PERMS.NOTICES_VIEW,
  gallery_view_module:          PERMS.GALLERY_VIEW,
  quiz_view_module:             PERMS.QUIZ_VIEW,
  gallery_approve:              PERMS.GALLERY_APPROVE,
  gallery_upload:               PERMS.GALLERY_UPLOAD,
  marks_enter:                  PERMS.MARKS_ENTER,
  marks_publish:                PERMS.MARKS_PUBLISH,
  attendance_mark:              PERMS.ATTENDANCE_MARK,
  attendance_needs_approval:    PERMS.ATTENDANCE_NEEDS_APPROVAL,
  marks_needs_approval:         PERMS.MARKS_NEEDS_APPROVAL,
  notices_needs_approval:       PERMS.NOTICES_NEEDS_APPROVAL,
  gallery_needs_approval:       PERMS.GALLERY_NEEDS_APPROVAL,
  quiz_needs_approval:          PERMS.QUIZ_NEEDS_APPROVAL,
  fees_void_receipt:            PERMS.FEES_VOID_RECEIPT,
  fees_manage_adhoc_charges:    PERMS.FEES_MANAGE_ADHOC,
  fees_record_payment:          PERMS.FEES_RECORD_PAYMENT,
  fees_apply_discount:          PERMS.FEES_APPLY_DISCOUNT,
  fees_manage_families:         PERMS.FEES_MANAGE_FAMILIES,
  fees_manage_fee_plans:        PERMS.FEES_MANAGE_FEE_PLANS,
  fees_manage_fee_heads:        PERMS.FEES_MANAGE_FEE_HEADS,
  fees_generate_invoices:       PERMS.FEES_GENERATE_INVOICES,
  fees_configure_receipt_settings: PERMS.FEES_CONFIGURE_RECEIPT,
  fee_reports_view:             PERMS.FEE_REPORTS_VIEW,
  fee_reports_export:           PERMS.FEE_REPORTS_EXPORT,
  fee_reports_view_parent_statement: PERMS.FEE_REPORTS_PARENT_STATEMENT,

  // ── Canonical keys → old keys (new code → old session backward compat) ──
  [PERMS.ATTENDANCE_MARK]:             'attendance',
  [PERMS.ATTENDANCE_MANAGE_HOLIDAYS]:  'manage_holidays',
  [PERMS.ATTENDANCE_OVERRIDE_HOLIDAY]: 'override_holidays',
  [PERMS.MARKS_ENTER]:                 'marks',
  [PERMS.NOTICES_CREATE]:              'post_notices',
  [PERMS.GALLERY_UPLOAD]:              'gallery',
  [PERMS.QUIZ_CREATE]:                 'quiz',
  [PERMS.FEES_VOID_RECEIPT]:           'fees_reverse_receipt',
  [PERMS.FEES_MANAGE_ADHOC]:           'fees_apply_charge',
  [PERMS.FEES_VIEW]:                   'fees_view_module',
  [PERMS.FEES_LEDGER_VIEW]:            'fees_view_ledger',
  [PERMS.ADMISSIONS_REVIEW]:           'student_admission_permission',
  [PERMS.ADMISSIONS_VIEW]:             'admissions_view_module',
  [PERMS.ATTENDANCE_VIEW]:             'attendance_view_module',
  [PERMS.MARKS_VIEW]:                  'marks_view_module',
  [PERMS.NOTICES_VIEW]:                'notices_view_module',
  [PERMS.GALLERY_VIEW]:                'gallery_view_module',
  [PERMS.QUIZ_VIEW]:                   'quiz_view_module',
};

// ─── Base Role Permissions ────────────────────────────────────────────────────
// Canonical permission sets for each base staff role.
// Used to seed system RoleTemplates and as the default for new staff creation.
// All keys are canonical PERMS values (strings).
export const BASE_ROLE_PERMISSIONS = {
  teacher: {
    [PERMS.ATTENDANCE_VIEW]: true,
    [PERMS.ATTENDANCE_MARK]: true,
    [PERMS.ATTENDANCE_NEEDS_APPROVAL]: true,
    [PERMS.MARKS_VIEW]: true,
    [PERMS.MARKS_ENTER]: true,
    [PERMS.MARKS_NEEDS_APPROVAL]: true,
    [PERMS.NOTICES_VIEW]: true,
    [PERMS.NOTICES_CREATE]: true,
    [PERMS.NOTICES_NEEDS_APPROVAL]: true,
    [PERMS.GALLERY_VIEW]: true,
    [PERMS.GALLERY_UPLOAD]: true,
    [PERMS.GALLERY_NEEDS_APPROVAL]: true,
    [PERMS.QUIZ_VIEW]: true,
    [PERMS.QUIZ_CREATE]: true,
    [PERMS.QUIZ_NEEDS_APPROVAL]: true,
    [PERMS.HOMEWORK_VIEW]: true,
    [PERMS.HOMEWORK_MANAGE]: true,
    [PERMS.DIARY_VIEW]: true,
    [PERMS.DIARY_MANAGE]: true,
    [PERMS.TIMETABLE_VIEW]: true,
    [PERMS.MESSAGES_VIEW]: true,
    [PERMS.MESSAGES_SEND]: true,
    [PERMS.CALENDAR_VIEW]: true,
    [PERMS.STUDENTS_VIEW]: true,
  },

  accountant: {
    [PERMS.FEES_VIEW]: true,
    [PERMS.FEES_LEDGER_VIEW]: true,
    [PERMS.FEES_RECORD_PAYMENT]: true,
    [PERMS.FEES_VOID_RECEIPT]: true,
    [PERMS.FEES_PRINT_RECEIPT]: true,
    [PERMS.FEES_APPLY_DISCOUNT]: true,
    [PERMS.FEES_MANAGE_FAMILIES]: true,
    [PERMS.FEES_MANAGE_ADHOC]: true,
    [PERMS.FEES_GENERATE_INVOICES]: true,
    [PERMS.FEE_REPORTS_VIEW]: true,
    [PERMS.FEE_REPORTS_COLLECTION]: true,
    [PERMS.FEE_REPORTS_OUTSTANDING]: true,
    [PERMS.FEE_REPORTS_LEDGER]: true,
    [PERMS.FEE_REPORTS_EXPORT]: true,
    [PERMS.STUDENTS_VIEW]: true,
    [PERMS.MESSAGES_VIEW]: true,
    [PERMS.CALENDAR_VIEW]: true,
  },

  exam_staff: {
    [PERMS.ATTENDANCE_VIEW]: true,
    [PERMS.ATTENDANCE_MARK]: true,
    [PERMS.ATTENDANCE_VIEW_SUMMARY]: true,
    [PERMS.ATTENDANCE_VIEW_SNAPSHOT]: true,
    [PERMS.MARKS_VIEW]: true,
    [PERMS.MARKS_ENTER]: true,
    [PERMS.EXAMS_VIEW]: true,
    [PERMS.STUDENTS_VIEW]: true,
  },

  librarian: {
    [PERMS.GALLERY_VIEW]: true,
    [PERMS.GALLERY_UPLOAD]: true,
    [PERMS.GALLERY_NEEDS_APPROVAL]: true,
    [PERMS.NOTICES_VIEW]: true,
    [PERMS.MESSAGES_VIEW]: true,
    [PERMS.CALENDAR_VIEW]: true,
    [PERMS.STUDENTS_VIEW]: true,
  },

  staff: {
    [PERMS.NOTICES_VIEW]: true,
    [PERMS.GALLERY_VIEW]: true,
    [PERMS.MESSAGES_VIEW]: true,
    [PERMS.CALENDAR_VIEW]: true,
  },

  // Admin / Principal bypass all permission checks — empty permissions is correct.
  admin:     {},
  principal: {},
};

// ─── Permission Categories (Role Editor UI) ───────────────────────────────────
// Grouped permission definitions for the role template editor (pages/Staff).
// Uses canonical PERMS keys.
// NOTE: pages/Staff currently imports PERMISSION_CATEGORIES from permissionHelper.js
// (old keys). This version replaces it in Phase 5 when Staff page is updated.
export const PERMISSION_CATEGORIES_V2 = [
  {
    label: 'Attendance',
    moduleKey: PERMS.ATTENDANCE_VIEW,
    permissions: [
      { key: PERMS.ATTENDANCE_MARK,             label: 'Mark Attendance',             approvalKey: PERMS.ATTENDANCE_NEEDS_APPROVAL },
      { key: PERMS.ATTENDANCE_VIEW_SUMMARY,     label: 'View Summary Report' },
      { key: PERMS.ATTENDANCE_VIEW_SNAPSHOT,    label: 'View Daily Snapshot' },
      { key: PERMS.ATTENDANCE_MANAGE_HOLIDAYS,  label: 'Manage Holidays' },
      { key: PERMS.ATTENDANCE_OVERRIDE_HOLIDAY, label: 'Override Holiday & Mark' },
    ],
  },
  {
    label: 'Marks & Exams',
    moduleKey: PERMS.MARKS_VIEW,
    permissions: [
      { key: PERMS.MARKS_ENTER,             label: 'Enter Marks',                   approvalKey: PERMS.MARKS_NEEDS_APPROVAL },
      { key: PERMS.MARKS_PUBLISH,           label: 'Publish / Finalize Results' },
      { key: PERMS.EXAMS_VIEW,              label: 'View Exam Management' },
      { key: PERMS.EXAMS_MANAGE,            label: 'Manage Exam Types & Timetable' },
      { key: PERMS.HALL_TICKETS_GENERATE,   label: 'Generate Hall Tickets' },
      { key: PERMS.PROGRESS_CARDS_GENERATE, label: 'Generate Progress Cards' },
    ],
  },
  {
    label: 'Notices',
    moduleKey: PERMS.NOTICES_VIEW,
    permissions: [
      { key: PERMS.NOTICES_CREATE,  label: 'Create / Post Notices', approvalKey: PERMS.NOTICES_NEEDS_APPROVAL },
      { key: PERMS.NOTICES_APPROVE, label: 'Approve & Publish Notices' },
    ],
  },
  {
    label: 'Gallery',
    moduleKey: PERMS.GALLERY_VIEW,
    permissions: [
      { key: PERMS.GALLERY_UPLOAD,  label: 'Upload Photos', approvalKey: PERMS.GALLERY_NEEDS_APPROVAL },
      { key: PERMS.GALLERY_APPROVE, label: 'Approve & Publish Photos' },
    ],
  },
  {
    label: 'Quiz',
    moduleKey: PERMS.QUIZ_VIEW,
    permissions: [
      { key: PERMS.QUIZ_CREATE,  label: 'Create / Edit Quizzes', approvalKey: PERMS.QUIZ_NEEDS_APPROVAL },
      { key: PERMS.QUIZ_PUBLISH, label: 'Publish / Manage Quizzes' },
    ],
  },
  {
    label: 'Homework',
    moduleKey: PERMS.HOMEWORK_VIEW,
    permissions: [
      { key: PERMS.HOMEWORK_MANAGE, label: 'Create & Manage Homework' },
    ],
  },
  {
    label: 'Diary',
    moduleKey: PERMS.DIARY_VIEW,
    permissions: [
      { key: PERMS.DIARY_MANAGE, label: 'Post Diary Entries' },
    ],
  },
  {
    label: 'Timetable',
    moduleKey: PERMS.TIMETABLE_VIEW,
    permissions: [
      { key: PERMS.TIMETABLE_MANAGE, label: 'Manage Timetable' },
    ],
  },
  {
    label: 'Admissions',
    moduleKey: PERMS.ADMISSIONS_VIEW,
    permissions: [
      { key: PERMS.ADMISSIONS_REVIEW, label: 'Review / Approve Applications' },
    ],
  },
  {
    label: 'Students',
    moduleKey: PERMS.STUDENTS_VIEW,
    permissions: [
      { key: PERMS.STUDENTS_MANAGE, label: 'Edit Student Records' },
    ],
  },
  {
    label: 'Messages',
    moduleKey: PERMS.MESSAGES_VIEW,
    permissions: [
      { key: PERMS.MESSAGES_SEND, label: 'Send Messages' },
    ],
  },
  {
    label: 'Fees Module',
    moduleKey: PERMS.FEES_VIEW,
    presets: [
      { name: 'Read-Only', perms: [PERMS.FEES_VIEW, PERMS.FEES_LEDGER_VIEW] },
      { name: 'Cashier',   perms: [PERMS.FEES_VIEW, PERMS.FEES_LEDGER_VIEW, PERMS.FEES_RECORD_PAYMENT, PERMS.FEES_PRINT_RECEIPT] },
      { name: 'Manager',   perms: [PERMS.FEES_VIEW, PERMS.FEES_LEDGER_VIEW, PERMS.FEES_RECORD_PAYMENT, PERMS.FEES_VOID_RECEIPT, PERMS.FEES_PRINT_RECEIPT, PERMS.FEES_APPLY_DISCOUNT, PERMS.FEES_GENERATE_INVOICES, PERMS.FEES_MANAGE_ADHOC] },
    ],
    permissions: [
      { key: PERMS.FEES_LEDGER_VIEW,       label: 'View Student Ledger' },
      { key: PERMS.FEES_RECORD_PAYMENT,    label: 'Record Payment & Generate Receipt' },
      { key: PERMS.FEES_PRINT_RECEIPT,     label: 'Print Receipt' },
      { key: PERMS.FEES_VOID_RECEIPT,      label: 'Void / Reverse Receipt' },
      { key: PERMS.FEES_APPLY_DISCOUNT,    label: 'Apply Discounts' },
      { key: PERMS.FEES_MANAGE_FAMILIES,   label: 'Manage Families' },
      { key: PERMS.FEES_MANAGE_FEE_PLANS,  label: 'Manage Fee Plans' },
      { key: PERMS.FEES_MANAGE_FEE_HEADS,  label: 'Manage Fee Heads' },
      { key: PERMS.FEES_MANAGE_ADHOC,      label: 'Additional / Adhoc Charges' },
      { key: PERMS.FEES_GENERATE_INVOICES, label: 'Generate / Regenerate Invoices' },
      { key: PERMS.FEES_CONFIGURE_RECEIPT, label: 'Configure Receipt Settings' },
    ],
  },
  {
    label: 'Fee Reports',
    moduleKey: PERMS.FEE_REPORTS_VIEW,
    permissions: [
      { key: PERMS.FEE_REPORTS_COLLECTION,       label: 'Collection / Day Book Report' },
      { key: PERMS.FEE_REPORTS_OUTSTANDING,       label: 'Outstanding / Due Report' },
      { key: PERMS.FEE_REPORTS_LEDGER,            label: 'Student Ledger Report' },
      { key: PERMS.FEE_REPORTS_EXPORT,            label: 'Export Reports' },
      { key: PERMS.FEE_REPORTS_PARENT_STATEMENT,  label: 'Parent Statement' },
    ],
  },
];

// ─── Page Permission Map ──────────────────────────────────────────────────────
// Maps each app page name → access rule.
// Wired to StaffAuthGuard in Phase 4.
// Defined here now — NOT enforced yet in Phase 1.
//
// Rule shape:
//   { adminOnly: true }         → admin/principal only
//   { permission: PERMS.X }     → staff needs this permission (admin bypasses)
//   { staffOnly: true }         → any authenticated staff (no specific permission)
export const PAGE_PERMISSION_MAP = {
  // Admin-only
  Settings:              { adminOnly: true },
  Staff:                 { adminOnly: true },
  SubjectManagement:     { adminOnly: true },
  IDCards:               { adminOnly: true },
  AnalyticsDashboard:    { adminOnly: true },

  // Permission-gated
  Attendance:            { permission: PERMS.ATTENDANCE_VIEW },
  Marks:                 { permission: PERMS.MARKS_VIEW },
  ExamManagement:        { permission: PERMS.EXAMS_VIEW },
  HallTicketManagement:  { permission: PERMS.EXAMS_VIEW },
  Homework:              { permission: PERMS.HOMEWORK_VIEW },
  DiaryManagement:       { permission: PERMS.DIARY_VIEW },
  Diary:                 { permission: PERMS.DIARY_VIEW },
  Notices:               { permission: PERMS.NOTICES_VIEW },
  Gallery:               { permission: PERMS.GALLERY_VIEW },
  Quiz:                  { permission: PERMS.QUIZ_VIEW },
  Admissions:            { permission: PERMS.ADMISSIONS_VIEW },
  Fees:                  { permission: PERMS.FEES_VIEW },
  TimetableManagement:   { permission: PERMS.TIMETABLE_VIEW },
  Messaging:             { permission: PERMS.MESSAGES_VIEW },

  // Fee report pages — currently unguarded, enforced in Phase 4
  CollectionReport:             { permission: PERMS.FEE_REPORTS_COLLECTION },
  OutstandingReport:            { permission: PERMS.FEE_REPORTS_OUTSTANDING },
  StudentLedgerReport:          { permission: PERMS.FEE_REPORTS_LEDGER },
  DayBookReport:                { permission: PERMS.FEE_REPORTS_COLLECTION },
  DefaultersReport:             { permission: PERMS.FEE_REPORTS_OUTSTANDING },
  ClassCollectionSummaryReport: { permission: PERMS.FEE_REPORTS_COLLECTION },
  DailyClosingReport:           { permission: PERMS.FEE_REPORTS_COLLECTION },
  ParentStatement:              { permission: PERMS.FEE_REPORTS_PARENT_STATEMENT },

  // Staff session required, no specific permission key
  Dashboard:           { staffOnly: true },
  Students:            { staffOnly: true },
  Reports:             { staffOnly: true },
  ReportsManagement:   { staffOnly: true },
  Approvals:           { staffOnly: true },
  Calendar:            { staffOnly: true },
  More:                { staffOnly: true },
  Profile:             { staffOnly: true },
  ChangeStaffPassword: { staffOnly: true },
  PostingDashboard:    { staffOnly: true },
};

// ─── Dashboard Tiles ──────────────────────────────────────────────────────────
// Tile definitions for permission-aware dashboard rendering (Phase 3).
// Dashboard component resolves iconName → lucide-react icon at render time.
// Defined here for future use — NOT wired to Dashboard yet in Phase 1.
//
// Tile fields:
//   id           — unique tile identifier
//   label        — display text
//   page         — createPageUrl() target
//   section      — grouping header on the dashboard
//   requiredPerm — PERMS.X, or null if no permission needed
//   adminOnly    — true = only visible to admin/principal
//   staffOnly    — true = any authenticated staff (no specific permission)
//   iconName     — lucide-react icon name (string, resolved in Dashboard component)
//   gradient     — tailwind gradient classes for ActionCard
export const DASHBOARD_TILES = [
  // ── Academics ──────────────────────────────────────────────────────────────
  { id: 'students',   label: 'Students',   page: 'Students',            section: 'Academics', requiredPerm: null,                          staffOnly: true,  iconName: 'Users',        gradient: 'from-blue-400 to-blue-600' },
  { id: 'attendance', label: 'Attendance', page: 'Attendance',          section: 'Academics', requiredPerm: PERMS.ATTENDANCE_VIEW,                           iconName: 'CheckSquare',  gradient: 'from-teal-400 to-teal-600' },
  { id: 'marks',      label: 'Marks',      page: 'Marks',               section: 'Academics', requiredPerm: PERMS.MARKS_VIEW,                                iconName: 'BookOpen',     gradient: 'from-green-400 to-green-600' },
  { id: 'exams',      label: 'Exams',      page: 'ExamManagement',      section: 'Academics', requiredPerm: PERMS.EXAMS_VIEW,                                iconName: 'BookMarked',   gradient: 'from-purple-400 to-purple-600' },
  { id: 'hall_ticket', label: 'Hall Tickets', page: 'HallTicketManagement', section: 'Academics', requiredPerm: PERMS.EXAMS_VIEW,                           iconName: 'FileText',     gradient: 'from-indigo-400 to-indigo-600' },
  { id: 'timetable',  label: 'Timetable',  page: 'TimetableManagement', section: 'Academics', requiredPerm: PERMS.TIMETABLE_VIEW,                            iconName: 'Calendar',     gradient: 'from-cyan-400 to-cyan-600' },
  { id: 'homework',   label: 'Homework',   page: 'Homework',            section: 'Academics', requiredPerm: PERMS.HOMEWORK_VIEW,                             iconName: 'BookMarked',   gradient: 'from-pink-400 to-pink-600' },
  { id: 'diary',      label: 'Diary',      page: 'DiaryManagement',     section: 'Academics', requiredPerm: PERMS.DIARY_VIEW,                                iconName: 'NotebookPen',  gradient: 'from-rose-400 to-rose-600' },
  { id: 'admissions', label: 'Admissions', page: 'Admissions',          section: 'Academics', requiredPerm: PERMS.ADMISSIONS_VIEW,                           iconName: 'FileText',     gradient: 'from-amber-400 to-amber-600' },

  // ── Communication ───────────────────────────────────────────────────────────
  { id: 'notices',    label: 'Notices',    page: 'Notices',             section: 'Communication', requiredPerm: PERMS.NOTICES_VIEW,         iconName: 'Bell',           gradient: 'from-yellow-400 to-yellow-600' },
  { id: 'gallery',    label: 'Gallery',    page: 'Gallery',             section: 'Communication', requiredPerm: PERMS.GALLERY_VIEW,         iconName: 'Image',          gradient: 'from-orange-400 to-orange-600' },
  { id: 'quiz',       label: 'Quiz',       page: 'Quiz',                section: 'Communication', requiredPerm: PERMS.QUIZ_VIEW,            iconName: 'ListChecks',     gradient: 'from-indigo-400 to-indigo-600' },
  { id: 'messaging',  label: 'Messages',   page: 'Messaging',           section: 'Communication', requiredPerm: PERMS.MESSAGES_VIEW,        iconName: 'MessageSquare',  gradient: 'from-sky-400 to-sky-600' },

  // ── Fees & Finance ─────────────────────────────────────────────────────────
  { id: 'fees',            label: 'Fee Collection',   page: 'Fees',                 section: 'Fees & Finance', requiredPerm: PERMS.FEES_VIEW,                    iconName: 'Wallet',      gradient: 'from-emerald-400 to-emerald-600' },
  { id: 'collection_rpt',  label: 'Collection Rpt',   page: 'CollectionReport',     section: 'Fees & Finance', requiredPerm: PERMS.FEE_REPORTS_COLLECTION,       iconName: 'BarChart3',   gradient: 'from-blue-400 to-blue-600' },
  { id: 'outstanding_rpt', label: 'Outstanding',      page: 'OutstandingReport',    section: 'Fees & Finance', requiredPerm: PERMS.FEE_REPORTS_OUTSTANDING,      iconName: 'TrendingUp',  gradient: 'from-red-400 to-red-600' },
  { id: 'ledger_rpt',      label: 'Ledger',           page: 'StudentLedgerReport',  section: 'Fees & Finance', requiredPerm: PERMS.FEE_REPORTS_LEDGER,           iconName: 'BookOpen',    gradient: 'from-violet-400 to-violet-600' },
  { id: 'daybook_rpt',     label: 'Day Book',         page: 'DayBookReport',        section: 'Fees & Finance', requiredPerm: PERMS.FEE_REPORTS_COLLECTION,       iconName: 'FileText',    gradient: 'from-slate-400 to-slate-600' },
  { id: 'closing_rpt',     label: 'Daily Closing',    page: 'DailyClosingReport',   section: 'Fees & Finance', requiredPerm: PERMS.FEE_REPORTS_COLLECTION,       iconName: 'Receipt',     gradient: 'from-teal-400 to-teal-600' },
  { id: 'defaulters_rpt',  label: 'Defaulters',       page: 'DefaultersReport',     section: 'Fees & Finance', requiredPerm: PERMS.FEE_REPORTS_OUTSTANDING,      iconName: 'AlertCircle', gradient: 'from-orange-400 to-orange-600' },
  { id: 'parent_stmt',     label: 'Parent Statement', page: 'ParentStatement',      section: 'Fees & Finance', requiredPerm: PERMS.FEE_REPORTS_PARENT_STATEMENT, iconName: 'DollarSign',  gradient: 'from-pink-400 to-pink-600' },

  // ── Reports & Analytics ────────────────────────────────────────────────────
  { id: 'reports',   label: 'Reports',   page: 'ReportsManagement',  section: 'Reports & Analytics', requiredPerm: null, adminOnly: true,  iconName: 'BarChart3',  gradient: 'from-purple-400 to-purple-600' },
  { id: 'analytics', label: 'Analytics', page: 'AnalyticsDashboard', section: 'Reports & Analytics', requiredPerm: null, adminOnly: true,  iconName: 'TrendingUp', gradient: 'from-fuchsia-400 to-fuchsia-600' },

  // ── Administration (admin/principal only) ──────────────────────────────────
  { id: 'staff_mgmt', label: 'Staff',    page: 'Staff',    section: 'Administration', requiredPerm: null, adminOnly: true, iconName: 'BookUser', gradient: 'from-amber-400 to-amber-600' },
  { id: 'settings',   label: 'Settings', page: 'Settings', section: 'Administration', requiredPerm: null, adminOnly: true, iconName: 'Settings', gradient: 'from-gray-400 to-gray-600' },
];