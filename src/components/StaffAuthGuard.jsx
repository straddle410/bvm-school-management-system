import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { getSession } from '@/components/sessionHelper';
import { PAGE_PERMISSION_MAP } from '@/components/permissionRegistry';
import { getEffectivePermissions, isAdminRole, can } from '@/components/permissionHelper';

const PUBLIC_PAGES = ['Index', 'index', 'Home', 'StaffLogin', 'StudentLogin'];

const STAFF_PAGES = [
  'Dashboard',
  'Students',
  'Attendance',
  'Marks',
  'Fees',
  'Staff',
  'Notices',
  'Gallery',
  'Approvals',
  'Calendar',
  'More',
  'DiaryManagement',
  'Homework',
  'ExamManagement',
  'HallTicketManagement',
  'Settings',
  'Reports',
  'Profile',
  'ChangeStaffPassword',
  'Messaging',
  'TimetableManagement',
  'SubjectManagement',
  'Teachers',
  'PostingDashboard',
  'AttendanceReports',
  'CollectionReport',
  'OutstandingReport',
  'StudentLedgerReport',
  'DayBookReport',
  'DefaultersReport',
  'ClassCollectionSummaryReport',
  'DailyClosingReport',
  'ParentStatement',
  'AnalyticsDashboard',
  'ReportsManagement',
  'StudentNotifications',
  'Admissions',
  'AdmissionLanding',
  'PublicAdmission',
  'IDCards',
];

export default function StaffAuthGuard({ children, currentPageName }) {
  const navigate = useNavigate();

  useEffect(() => {
    // Public pages bypass authentication
    if (PUBLIC_PAGES.includes(currentPageName)) {
      return;
    }

    // Only guard staff pages
    if (!STAFF_PAGES.includes(currentPageName)) {
      return;
    }

    // Check for staff and student sessions (localStorage + cookie fallback)
    const staffData = getSession('staff_session');
    const studentData = getSession('student_session');
    const hasStaffSession = !!staffData;
    const hasStudentSession = !!studentData;

    // If student session exists, redirect to student dashboard (cross-role protection)
    if (hasStudentSession) {
      navigate(createPageUrl('StudentDashboard'));
      return;
    }

    // Redirect to login if no staff session
    if (!hasStaffSession) {
      navigate(createPageUrl('StaffLogin'));
      return;
    }

    // ─── PHASE 4: Permission-based page access ──────────────────────────────────
    // If page has a mapping in PAGE_PERMISSION_MAP, enforce permission checks.
    const pageRule = PAGE_PERMISSION_MAP[currentPageName];
    if (pageRule) {
      const isAdmin = isAdminRole(staffData?.role);

      // Admin/Principal bypass
      if (isAdmin) return;

      // adminOnly pages
      if (pageRule.adminOnly) {
        navigate(createPageUrl('Dashboard'));
        return;
      }

      // Permission-gated pages
      if (pageRule.permission) {
        const effectivePerms = getEffectivePermissions(staffData);
        const hasPermission = can({ ...staffData, effective_permissions: effectivePerms }, pageRule.permission);
        if (!hasPermission) {
          navigate(createPageUrl('Dashboard'));
          return;
        }
      }
      // staffOnly pages — authenticated staff already pass through
    }
  }, [currentPageName, navigate]);

  return children;
}