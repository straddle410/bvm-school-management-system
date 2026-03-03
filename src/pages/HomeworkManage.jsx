import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

export default function HomeworkManage() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/pages/PostingDashboard?tab=homework');
  }, [navigate]);

  return null;
}