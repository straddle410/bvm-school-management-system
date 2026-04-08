import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { getSession } from '@/components/sessionHelper';

export default function Index() {
  const navigate = useNavigate();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);

      const student = getSession('student_session');
      if (student?.student_id || student?.id) {
        navigate(createPageUrl('StudentDashboard'), { replace: true });
        return;
      }

      const staff = getSession('staff_session');
      if (staff?.username || staff?.staff_id) {
        navigate(createPageUrl('Dashboard'), { replace: true });
        return;
      }

      navigate(createPageUrl('StudentLogin'), { replace: true });
    }, 2500);

    return () => clearTimeout(timer);
  }, [navigate]);

  if (!showSplash) return null;

  return (
    <div className="fixed inset-0 w-full h-full">
      <img
        src="https://media.base44.com/images/public/69965572f33252d650e49c9b/98d9b52fa_bvmsplashscreen.png"
        alt="BVM School Splash"
        className="w-full h-full object-cover"
      />
    </div>
  );
}