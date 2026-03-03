import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

export default function DiaryManagement() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/pages/PostingDashboard?tab=diary');
  }, [navigate]);

  return null;
}