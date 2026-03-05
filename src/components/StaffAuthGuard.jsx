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

    // Check for staff session
    let hasStaffSession = false;
    try {
      const session = localStorage.getItem('staff_session');
      if (session) {
        const parsed = JSON.parse(session);
        hasStaffSession = !!parsed;
      }
    } catch {}

    // Redirect to login if no session
    if (!hasStaffSession) {
      navigate(createPageUrl('StaffLogin'));
    }
  }, [currentPageName, navigate]);

  return children;
}