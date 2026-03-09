import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function Index() {
  const navigate = useNavigate();

  useEffect(() => {
    // Check student session first
    try {
      const studentRaw = localStorage.getItem('student_session');
      if (studentRaw) {
        const student = JSON.parse(studentRaw);
        if (student?.student_id) {
          navigate(createPageUrl('StudentDashboard'), { replace: true });
          return;
        }
      }
    } catch {}

    // Check staff session
    try {
      const staffRaw = localStorage.getItem('staff_session');
      if (staffRaw) {
        const staff = JSON.parse(staffRaw);
        if (staff?.username) {
          navigate(createPageUrl('Dashboard'), { replace: true });
          return;
        }
      }
    } catch {}

    // No session — go to home/landing
    navigate(createPageUrl('Home'), { replace: true });
  }, [navigate]);

  return null;
}