import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { getSession } from '@/components/sessionHelper';

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
    }
  }, [currentPageName, navigate]);

  return children;
}