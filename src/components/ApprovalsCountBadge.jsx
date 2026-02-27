import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useApprovalsCount(academicYear, enabled = true) {
  const { data: admissionCount = 0 } = useQuery({
    queryKey: ['approvals-count-admissions'],
    queryFn: async () => {
      try {
        const items = await base44.entities.Admission.filter({ status: 'Verified' });
        return items.length;
      } catch { return 0; }
    },
    enabled,
    staleTime: 30000,
    refetchInterval: 30000,
  });

  const { data: marksCount = 0 } = useQuery({
    queryKey: ['approvals-count-marks', academicYear],
    queryFn: async () => {
      try {
        const items = await base44.entities.Marks.filter({ 
          status: 'Verified',
          academic_year: academicYear 
        });
        return items.length;
      } catch { return 0; }
    },
    enabled,
    staleTime: 60000,
  });

  const { data: attendanceCount = 0 } = useQuery({
    queryKey: ['approvals-count-attendance', academicYear],
    queryFn: async () => {
      try {
        const items = await base44.entities.Attendance.filter({ 
          status: 'Verified',
          academic_year: academicYear 
        });
        return items.length;
      } catch { return 0; }
    },
    enabled,
    staleTime: 60000,
  });

  const { data: noticesCount = 0 } = useQuery({
    queryKey: ['approvals-count-notices'],
    queryFn: async () => {
      try {
        const items = await base44.entities.Notice.filter({ status: 'Submitted' });
        return items.length;
      } catch { return 0; }
    },
    enabled,
    staleTime: 60000,
  });

  return admissionCount + marksCount + attendanceCount + noticesCount;
}

export default function ApprovalsCountBadge({ count }) {
  if (!count || count === 0) return null;
  
  return (
    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-bold px-1 shadow">
      {count > 9 ? '9+' : count}
    </span>
  );
}