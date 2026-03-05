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

    // Check for student session
    let hasStudentSession = false;
    try {
      const session = localStorage.getItem('student_session');
      if (session) {
        const parsed = JSON.parse(session);
        hasStudentSession = !!parsed;
      }
    } catch {}

    // Redirect to login if no session
    if (!hasStudentSession) {
      navigate(createPageUrl('StudentLogin'));
    }
  }, [currentPageName, navigate]);

  return children;
}