import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

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

    // Check for student and staff sessions
    let hasStudentSession = false;
    let hasStaffSession = false;
    try {
      const studentSession = localStorage.getItem('student_session');
      if (studentSession) {
        const parsed = JSON.parse(studentSession);
        hasStudentSession = !!parsed;
      }
      const staffSession = localStorage.getItem('staff_session');
      if (staffSession) {
        const parsed = JSON.parse(staffSession);
        hasStaffSession = !!parsed;
      }
    } catch {}

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