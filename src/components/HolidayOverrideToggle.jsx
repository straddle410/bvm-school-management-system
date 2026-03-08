import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from "sonner";
import { getStaffSession } from '@/components/useStaffSession';

export default function HolidayOverrideToggle({ selectedDate, selectedClass, selectedSection, canOverride, user, academicYear, onOverrideChange }) {
  const staffSession = getStaffSession();
  const [overrideActive, setOverrideActive] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const queryClient = useQueryClient();

  const { data: existingOverride } = useQuery({
    queryKey: ['holiday-override', selectedDate, selectedClass, selectedSection, academicYear],
    queryFn: () => base44.entities.HolidayOverride.filter({ date: selectedDate, class_name: selectedClass, section: selectedSection, academic_year: academicYear }),
    enabled: !!selectedDate && !!selectedClass && !!selectedSection && !!academicYear
  });

  useEffect(() => {
    if (existingOverride?.length > 0) {
      setOverrideActive(true);
      setOverrideReason(existingOverride[0].reason || 'Attendance Override');
    } else {
      setOverrideActive(false);
      setOverrideReason('');
    }
  }, [existingOverride]);

  const createOverrideMutation = useMutation({
    mutationFn: () => {
      console.log('[HolidayOverrideToggle] mutate() called');
      const userId = staffSession?.email || user?.email;
      console.log('[HolidayOverrideToggle] staffSession.email:', staffSession?.email, 'user.email:', user?.email, 'userId:', userId);
      if (!userId) throw new Error('User identity not available');
      const payload = {
        date: selectedDate,
        class_name: selectedClass,
        section: selectedSection,
        user_id: userId,
        reason: overrideReason || 'Attendance Override',
        academic_year: academicYear
      };
      console.log('[HolidayOverrideToggle] payload:', payload);
      return base44.entities.HolidayOverride.create(payload);
    },
    onSuccess: () => {
       const userId = staffSession?.email || user?.email;
       queryClient.invalidateQueries({ queryKey: ['holiday-override', selectedDate, selectedClass, selectedSection, academicYear] });
       if (userId) {
         base44.entities.AuditLog.create({
           action: 'override_applied',
           module: 'Override',
           date: selectedDate,
           performed_by: userId,
           details: `Applied holiday override: ${overrideReason}`,
           academic_year: academicYear
         });
       }
       setOverrideActive(true);
       onOverrideChange?.(true);
       toast.success('Holiday override applied');
     }
  });

  const removeOverrideMutation = useMutation({
    mutationFn: () => {
      if (!existingOverride?.[0]?.id) throw new Error('No override found');
      return base44.entities.HolidayOverride.delete(existingOverride[0].id);
    },
    onSuccess: () => {
       const userId = staffSession?.email || user?.email;
       queryClient.invalidateQueries({ queryKey: ['holiday-override', selectedDate, selectedClass, selectedSection, academicYear] });
       if (userId) {
         base44.entities.AuditLog.create({
           action: 'override_removed',
           module: 'Override',
           date: selectedDate,
           performed_by: userId,
           details: 'Removed holiday override',
           academic_year: academicYear
         });
       }
       setOverrideActive(false);
       setOverrideReason('');
       onOverrideChange?.(false);
       toast.success('Holiday override removed');
     }
  });

  if (!canOverride) return null;

  return (
    <div className="relative p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2 z-10">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-blue-600" />
        <p className="text-sm font-medium text-blue-900">Override Holiday</p>
      </div>
      <p className="text-xs text-blue-700">You can allow attendance on this holiday</p>
      
      {!overrideActive ? (
        <div className="space-y-2">
          <input
            type="text"
            placeholder="Reason (e.g., Makeup class)"
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            className="relative border border-blue-300 rounded-lg px-2 py-1.5 text-xs w-full"
          />
          <Button
            size="sm"
            className="relative bg-blue-600 hover:bg-blue-700 text-white w-full"
            onClick={() => {
              console.log('[HolidayOverrideToggle] Apply Override button clicked');
              createOverrideMutation.mutate();
            }}
            disabled={createOverrideMutation.isPending}
          >
            <Zap className="h-3 w-3 mr-1" />
            {createOverrideMutation.isPending ? 'Applying...' : 'Apply Override'}
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between p-2 bg-blue-100 rounded">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-xs font-medium text-blue-900">Override Active</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7"
            onClick={() => removeOverrideMutation.mutate()}
            disabled={removeOverrideMutation.isPending}
          >
            Remove
          </Button>
        </div>
      )}
    </div>
  );
}