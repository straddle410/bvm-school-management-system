import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { getSession } from '@/components/sessionHelper';

export default function Index() {
  const navigate = useNavigate();

  useEffect(() => {
    // Check student session (localStorage + cookie fallback for iOS PWA)
    const student = getSession('student_session');
    if (student?.student_id || student?.id) {
      navigate(createPageUrl('StudentDashboard'), { replace: true });
      return;
    }

    // Check staff session
    const staff = getSession('staff_session');
    if (staff?.username || staff?.staff_id) {
      navigate(createPageUrl('Dashboard'), { replace: true });
      return;
    }

    // No session — go to home/landing
    navigate(createPageUrl('Home'), { replace: true });
  }, [navigate]);

  return null;
}