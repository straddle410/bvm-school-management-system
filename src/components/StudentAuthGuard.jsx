import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { getSession } from '@/components/sessionHelper';

const STUDENT_PAGES = [
  'StudentDashboard',
  'StudentAttendance',
  'StudentMarks',
  'StudentDiary',
  'StudentNotices',
  'StudentTimetable',
  'StudentHomework',
  'StudentMessaging',
  'StudentHallTicketView',
  'StudentMore',
  'StudentFees',
  'Results',
  'Quiz',
  'Gallery',
  'StudentProfile',
];

export default function StudentAuthGuard({ children, currentPageName }) {
  const navigate = useNavigate();

  useEffect(() => {
    // Only guard student pages
    if (!STUDENT_PAGES.includes(currentPageName)) {
      return;
    }

    // Check for student and staff sessions (localStorage + cookie fallback)
    const studentData = getSession('student_session');
    const staffData = getSession('staff_session');
    const hasStudentSession = !!studentData;
    const hasStaffSession = !!staffData;

    // If staff session exists BUT no student session, redirect to staff dashboard
    if (hasStaffSession && !hasStudentSession) {
      navigate(createPageUrl('Dashboard'));
      return;
    }

    // Redirect to login if no student session
    if (!hasStudentSession) {
      navigate(createPageUrl('StudentLogin'));
    }
  }, [currentPageName, navigate]);

  return children;
}