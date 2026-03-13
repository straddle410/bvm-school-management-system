import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export function usePendingStaffCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    loadCount();
    // Refresh every 30 seconds
    const interval = setInterval(loadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadCount = async () => {
    try {
      const records = await base44.entities.StaffAccount.filter({ status: 'pending' });
      setCount(records?.length || 0);
    } catch (error) {
      console.error('Failed to load pending staff count:', error);
    }
  };

  return count;
}