import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

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
    // Only guard staff pages
    if (!STAFF_PAGES.includes(currentPageName)) {
      return;
    }

    // Check for staff and student sessions
    let hasStaffSession = false;
    let hasStudentSession = false;
    try {
      const staffSession = localStorage.getItem('staff_session');
      if (staffSession) {
        const parsed = JSON.parse(staffSession);
        hasStaffSession = !!parsed;
      }
      const studentSession = localStorage.getItem('student_session');
      if (studentSession) {
        const parsed = JSON.parse(studentSession);
        hasStudentSession = !!parsed;
      }
    } catch {}

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