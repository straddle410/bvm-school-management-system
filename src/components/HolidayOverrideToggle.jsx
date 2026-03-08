import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from "sonner";

export default function HolidayOverrideToggle({ selectedDate, selectedClass, selectedSection, canOverride, staffEmail, academicYear }) {
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
      if (!staffEmail) throw new Error('User details still loading. Please try again.');
      if (!academicYear) throw new Error('Academic year not set');
      if (!selectedClass) throw new Error('Class not selected');
      if (!selectedSection) throw new Error('Section not selected');
      return base44.entities.HolidayOverride.create({
        date: selectedDate,
        class_name: selectedClass,
        section: selectedSection,
        user_id: staffEmail,
        reason: overrideReason || 'Attendance Override',
        academic_year: academicYear
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holiday-override', selectedDate, selectedClass, selectedSection, academicYear] });
      base44.entities.AuditLog.create({
        action: 'override_applied',
        module: 'Override',
        date: selectedDate,
        performed_by: staffEmail,
        details: `Applied holiday override for ${selectedClass}-${selectedSection}: ${overrideReason}`,
        academic_year: academicYear
      });
      setOverrideActive(true);
      toast.success('Holiday override enabled successfully');
    },
    onError: (err) => {
      console.error('Override error:', err);
      toast.error('Failed to enable override: ' + (err?.message || 'Unknown error'));
    }
  });

  const removeOverrideMutation = useMutation({
    mutationFn: () => {
      if (!existingOverride?.[0]?.id) throw new Error('No override found');
      return base44.entities.HolidayOverride.delete(existingOverride[0].id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holiday-override', selectedDate, selectedClass, selectedSection, academicYear] });
      base44.entities.AuditLog.create({
        action: 'override_removed',
        module: 'Override',
        date: selectedDate,
        performed_by: staffEmail,
        details: `Removed holiday override for ${selectedClass}-${selectedSection}`,
        academic_year: academicYear
      });
      setOverrideActive(false);
      setOverrideReason('');
      toast.success('Holiday override disabled successfully');
    },
    onError: (err) => {
      console.error('Remove override error:', err);
      toast.error('Failed to disable override: ' + (err?.message || 'Unknown error'));
    }
  });

  if (!canOverride) return null;

  return (
    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
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
            className="border border-blue-300 rounded-lg px-2 py-1.5 text-xs w-full"
            disabled={!staffEmail}
          />
          <Button
            type="button"
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 text-white w-full"
            onClick={() => createOverrideMutation.mutate()}
            disabled={!staffEmail || createOverrideMutation.isPending}
          >
            <Zap className="h-3 w-3 mr-1" />
            {!staffEmail ? 'Loading user...' : createOverrideMutation.isPending ? 'Applying...' : 'Apply Override'}
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between p-2 bg-blue-100 rounded">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-xs font-medium text-blue-900">Override Active</span>
          </div>
          <Button
            type="button"
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