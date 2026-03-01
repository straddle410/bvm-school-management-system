import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

// Redirects to Attendance page (Holidays tab is now inside Attendance)
export default function HolidayCalendar() {
  const navigate = useNavigate();
  useEffect(() => { navigate(createPageUrl('Attendance'), { replace: true }); }, [navigate]);
  return null;
}