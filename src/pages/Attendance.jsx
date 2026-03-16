import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import LoginRequired from '@/components/LoginRequired';
import { getStaffSession } from '@/components/useStaffSession';
import { useAcademicYear } from '@/components/AcademicYearContext';
import { can, getEffectivePermissions } from '@/components/permissionHelper';
import PastYearWarning, { isPastAcademicYear } from '@/components/PastYearWarning';
import { getAttendancePercentage, deduplicateAttendanceRecords } from '@/components/attendanceCalculations';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import HolidayStatusDisplay from '@/components/HolidayStatusDisplay';
import HolidayOverrideToggle from '@/components/HolidayOverrideToggle';
import HalfDayModal from '@/components/attendance/HalfDayModal';
import DailySnapshotTab from '@/components/attendance/DailySnapshotTab';
import AbsentNotificationTab from '@/components/attendance/AbsentNotificationTab';
import FilterSection from '@/components/attendanceSummary/FilterSection';
import SummaryCards from '@/components/attendanceSummary/SummaryCards';
import ReportTable from '@/components/attendanceSummary/ReportTable';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Suspense, lazy } from 'react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Calendar, CheckCircle2, XCircle, Users, Save, Palmtree, CalendarRange,
  AlertCircle, Lock, BarChart3, Plus, Trash2, Edit2, LockOpen, Zap
} from 'lucide-react';
import PullToRefresh from '@/components/PullToRefresh';
import { format, getDay, eachDayOfInterval, parseISO } from 'date-fns';
import { toast } from "sonner";
import { getClassesForYear, getSectionsForClass } from '@/components/classSectionHelper';

// Lazy load heavy attendance tab components
const DailySnapshotTabLazy = lazy(() => import('@/components/attendance/DailySnapshotTab'));

const TabLoadingSpinner = () => (
  <Card className="border-0 shadow-sm dark:bg-gray-800">
    <CardContent className="py-12 flex justify-center">
      <div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
    </CardContent>
  </Card>
);

// ─── Mark Attendance Tab ──────────────────────────────────────────────────────
function MarkAttendanceTab({ 
  user, 
  academicYear, 
  isAdmin, 
  holidays, 
  classSectionData,    // ✅ Receive from parent to avoid duplicate query
  sectionData,         // ✅ Receive from parent to avoid duplicate query
  selectedClass,       // ✅ Pass selected class to get correct sections
  onClassChange        // ✅ Callback to update parent's selectedClass
}) {
  const todayDate = format(new Date(), 'yyyy-MM-dd');
  const [selectedDate, setSelectedDate] = useState(isAdmin ? '' : todayDate);
  const [selectedSection, setSelectedSection] = useState('');

  const availableClasses = classSectionData?.classes || [];
  const availableSections = sectionData?.sections || [];

  // Reset section if it's no longer valid after class/year change
  useEffect(() => {
    if (availableSections.length > 0 && selectedSection && !availableSections.includes(selectedSection)) {
      setSelectedSection('');
    }
    if (availableSections.length === 1 && !selectedSection) {
      setSelectedSection(availableSections[0]);
    }
  }, [availableSections, selectedSection]);

  // ✅ Notify parent when class changes
  const handleClassChange = (newClass) => {
    setSelectedSection('');
    onClassChange(newClass);
  };
  const [attendanceData, setAttendanceData] = useState({});
  const [isHoliday, setIsHoliday] = useState(false);
  const [holidayReason, setHolidayReason] = useState('');
  const [showRangeMode, setShowRangeMode] = useState(false);
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [rangeReason, setRangeReason] = useState('');
  const [rangeProgress, setRangeProgress] = useState(0);
  const [halfDayModal, setHalfDayModal] = useState({ isOpen: false, studentId: null, studentName: null });
  const [showPastYearWarning, setShowPastYearWarning] = useState(false);
  const [manuallyChanged, setManuallyChanged] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const queryClient = useQueryClient();

  const workingDate = isAdmin ? selectedDate : todayDate;
  const isSunday = getDay(new Date(workingDate + 'T00:00:00')) === 0;

  // ✅ FIX #3: Pagination - Load 100 students at a time
  const [studentPage, setStudentPage] = useState(1);
  const STUDENTS_PER_PAGE = 100;
  
  const { data: studentResponse = {} } = useQuery({
    queryKey: ['students-published-paginated', academicYear, selectedClass, selectedSection, studentPage],
    queryFn: async () => {
      const allStudents = await base44.entities.Student.filter({
        status: 'Published',
        academic_year: academicYear,
        class_name: selectedClass,
        section: selectedSection,
        is_deleted: false
      });
      const total = allStudents.length;
      const start = (studentPage - 1) * STUDENTS_PER_PAGE;
      const end = start + STUDENTS_PER_PAGE;
      return {
        students: allStudents.slice(start, end),
        total,
        currentPage: studentPage,
        totalPages: Math.ceil(total / STUDENTS_PER_PAGE)
      };
    },
    enabled: !!selectedClass && !!selectedSection && !!academicYear,
    staleTime: 5 * 60 * 1000,
  });

  const students = studentResponse.students || [];

  // ✅ FIX #5: STALE TIME FIX - Set staleTime to 5 minutes instead of 0
  const { data: existingAttendance = [] } = useQuery({
    queryKey: ['attendance', workingDate, selectedClass, selectedSection, academicYear],
    queryFn: () => base44.entities.Attendance.filter({
      date: workingDate, class_name: selectedClass, section: selectedSection, academic_year: academicYear
    }),
    enabled: !!selectedClass && !!selectedSection && !!workingDate,
    staleTime: 5 * 60 * 1000 // Cache for 5 minutes to prevent unnecessary refetches
  });

  const isRecordLocked = existingAttendance.length > 0 && existingAttendance[0]?.is_locked;
  const lockedAtTime = existingAttendance[0]?.locked_at ? new Date(existingAttendance[0].locked_at).toLocaleString() : null;



  // ✅ FIX #4: HOLIDAY OVERRIDE - Only fetch when actually editing (lazy load)
  const [isEditingOverride, setIsEditingOverride] = useState(false);
  
  const { data: overrides = [] } = useQuery({
    queryKey: ['holiday-override', workingDate, selectedClass, selectedSection, academicYear],
    queryFn: () => base44.entities.HolidayOverride.filter({ date: workingDate, class_name: selectedClass, section: selectedSection, academic_year: academicYear }),
    enabled: isEditingOverride, // Only fetch when user is actually editing
    staleTime: 5 * 60 * 1000
  });

  // Filter holidays for current working date from parent-level holidays prop
  const isMarkedHoliday = holidays.some(h => h.date === workingDate && h.status === 'Active');

  // Phase 5: Use can() helper with effective permissions
  const userWithPerms = { ...user, effective_permissions: getEffectivePermissions(user || {}) };
  const canOverrideHoliday = can(userWithPerms, 'attendance_override_holiday');
  const hasOverride = overrides.length > 0;
  const canManageHolidays = isAdmin || can(userWithPerms, 'attendance_manage_holidays');
  // Single source of truth for holiday override state
  const effectiveHoliday = hasOverride ? false : (isSunday || isMarkedHoliday);

  useEffect(() => {
    // effectiveHoliday is single source of truth: hasOverride takes precedence over holiday/sunday
    setIsHoliday(effectiveHoliday);
    setHolidayReason(isMarkedHoliday ? (holidays[0]?.title || 'Holiday') : (isSunday ? 'Sunday' : ''));
    
    // Load attendance data if exists
    if (existingAttendance.length > 0) {
      const dedupedAttendance = deduplicateAttendanceRecords(existingAttendance);
      const data = {};
      dedupedAttendance.forEach(a => {
        data[a.student_id] = {
          is_present: a.is_present, id: a.id, status: a.status,
          attendance_type: a.attendance_type || 'full_day',
          half_day_period: a.half_day_period || null,
          half_day_reason: a.half_day_reason || ''
        };
      });
      setAttendanceData(data);
    } else {
      setAttendanceData({});
    }
  }, [existingAttendance, isSunday, isMarkedHoliday, holidays, hasOverride, effectiveHoliday]);

  const filteredStudents = [...students].sort((a, b) => (a.roll_no || 0) - (b.roll_no || 0));

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!academicYear) throw new Error('Academic year not configured');
      if (!selectedClass) throw new Error('Class is required');
      if (!selectedSection) throw new Error('Section is required');
      if (!workingDate) throw new Error('Date is required');
      if (isPastAcademicYear(academicYear)) throw new Error('PAST_YEAR_WARNING');
      const session = getStaffSession();
      
      // ✅ OPTIMIZATION: Fetch ALL existing attendance records for this date/class/section in ONE call
      const existingRecords = await base44.entities.Attendance.filter({
        date: workingDate, class_name: selectedClass, section: selectedSection, academic_year: academicYear
      });
      const existingMap = Object.fromEntries(existingRecords.map(r => [r.student_id, r]));
      
      // ✅ Separate new vs existing in memory (no API calls for this)
      const toCreate = [];
      const toUpdate = [];
      
      filteredStudents.forEach(student => {
        const sid = student.student_id || student.id;
        const existing = attendanceData[sid] || existingMap[sid];
        const attType = existing?.attendance_type || 'full_day';
        const data = {
          date: workingDate, class_name: selectedClass, section: selectedSection,
          student_id: sid, student_name: student.name,
          attendance_type: effectiveHoliday ? 'holiday' : attType,
          half_day_period: existing?.half_day_period || null,
          half_day_reason: existing?.half_day_reason || '',
          is_present: effectiveHoliday ? false : (attType !== 'absent'),
          is_holiday: effectiveHoliday, holiday_reason: effectiveHoliday ? (holidayReason || 'Holiday') : '',
          marked_by: user?.email, academic_year: academicYear,
          status: effectiveHoliday ? 'Holiday' : 'Taken'
        };
        
        if (existingMap[sid]) {
          toUpdate.push({ id: existingMap[sid].id, data });
        } else {
          toCreate.push(data);
        }
      });
      
      // ✅ Bulk operations: 1 bulkCreate + 1 bulk update
       const results = [];
       if (toCreate.length > 0) {
         results.push(await base44.entities.Attendance.bulkCreate(toCreate));
       }
       if (toUpdate.length > 0) {
         const updatePromises = toUpdate.map(({ id, data }) =>
           base44.entities.Attendance.update(id, data)
         );
         results.push(await Promise.all(updatePromises));
       }

       // ── AUTO-LOCK RECORDS AFTER SAVE (ADMIN ONLY) ──
       if (isAdmin && isRecordLocked) {
         try {
           const lockPromises = [];
           if (toCreate.length > 0) {
             const createdRecords = results[0] || [];
             createdRecords.forEach(r => {
               lockPromises.push(base44.entities.Attendance.update(r.id, { is_locked: true, locked_at: new Date().toISOString() }));
             });
           }
           if (toUpdate.length > 0) {
             toUpdate.forEach(({ id }) => {
               lockPromises.push(base44.entities.Attendance.update(id, { is_locked: true, locked_at: new Date().toISOString() }));
             });
           }
           if (lockPromises.length > 0) {
             await Promise.all(lockPromises);
           }
         } catch (lockError) {
           console.warn('Auto-lock after save failed:', lockError);
         }
       }

       return results;
    },
    onSuccess: () => {
       queryClient.invalidateQueries(['attendance']);
       queryClient.invalidateQueries(['attendance', workingDate, selectedClass, selectedSection, academicYear]);
       toast.success(effectiveHoliday ? 'Holiday marked successfully' : 'Attendance saved successfully');
     },
    onError: (err) => {
      if (err?.message === 'PAST_YEAR_WARNING') setShowPastYearWarning(true);
      else if (err?.response?.status === 403) toast.error('❌ This record is locked. Only admin can unlock and edit.');
      else if (err?.message?.includes('different from today')) toast.error('❌ Can only mark attendance for today');
      else toast.error('Failed to save: ' + (err?.message || 'Unknown error'));
    }
  });

  const saveRangeMutation = useMutation({
    mutationFn: async () => {
      if (!rangeStart || !rangeEnd) throw new Error('Select start and end dates');
      const days = eachDayOfInterval({ start: parseISO(rangeStart), end: parseISO(rangeEnd) });
      
      // ✅ OPTIMIZATION: Fetch ALL holidays for the range in ONE call
      const existingHolidays = await base44.entities.Holiday.filter({ academic_year: academicYear });
      const existingDates = new Set(existingHolidays.map(h => h.date));
      
      // ✅ In-memory filtering: determine which dates need new holiday records
      const holidaysToCreate = [];
      days.forEach((day, index) => {
        const dateStr = format(day, 'yyyy-MM-dd');
        if (!existingDates.has(dateStr)) {
          holidaysToCreate.push({ date: dateStr, title: rangeReason || 'Holiday', reason: rangeReason || 'Holiday', marked_by: user?.email, academic_year: academicYear, status: 'Active' });
        }
        setRangeProgress(Math.round(((index + 1) / days.length) * 100));
      });
      
      if (holidaysToCreate.length > 0) await base44.entities.Holiday.bulkCreate(holidaysToCreate);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      toast.success(`Holiday marked from ${rangeStart} to ${rangeEnd}`);
      setShowRangeMode(false);
      setRangeStart(''); setRangeEnd(''); setRangeReason(''); setRangeProgress(0);
    },
    onError: (err) => { toast.error('Failed: ' + (err?.message || 'Unknown error')); setRangeProgress(0); }
  });

  const handleUnlockRecords = async () => {
    try {
      setIsUnlocking(true);
      const session = getStaffSession();
      const response = await base44.functions.invoke('unlockAttendanceForAdmin', {
        date: workingDate,
        class_name: selectedClass,
        section: selectedSection,
        academic_year: academicYear,
        staff_session_token: session?.staff_session_token || null
      });
      
      if (response.data?.success) {
        toast.success('Attendance unlocked successfully');
        queryClient.invalidateQueries(['attendance', workingDate, selectedClass, selectedSection, academicYear]);
      }
    } catch (err) {
      toast.error('Failed to unlock: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsUnlocking(false);
    }
  };

  const setAttendanceType = (studentId, type, halfDayData = {}) => {
    setAttendanceData(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], attendance_type: type, half_day_period: halfDayData.period || null, half_day_reason: halfDayData.reason || '', is_present: type !== 'absent' }
    }));
  };

  const markAllPresent = () => {
    const data = {};
    filteredStudents.forEach(s => { data[s.student_id || s.id] = { ...attendanceData[s.student_id || s.id], attendance_type: 'full_day', is_present: true }; });
    setAttendanceData(data);
  };

  const currentStatus = existingAttendance[0]?.status || 'Not Taken';
  const fullDayCount = filteredStudents.filter(s => attendanceData[s.student_id || s.id]?.attendance_type === 'full_day').length;
  const halfDayCount = filteredStudents.filter(s => attendanceData[s.student_id || s.id]?.attendance_type === 'half_day').length;
  const absentCount = filteredStudents.filter(s => attendanceData[s.student_id || s.id]?.attendance_type === 'absent').length;

  // Fallback holiday override mutation
  const fallbackOverrideMutation = useMutation({
    mutationFn: async () => {
      if (!user?.staff_id) throw new Error('Staff ID not found');
      const action = hasOverride ? 'remove' : 'create';
      
      if (hasOverride) {
        // Remove existing override
        if (!overrides?.[0]?.id) throw new Error('Override record not found');
        await base44.entities.HolidayOverride.delete(overrides[0].id);
      } else {
        // Create new override
        await base44.entities.HolidayOverride.create({
          date: workingDate,
          class_name: selectedClass,
          section: selectedSection,
          user_id: user.staff_id,
          reason: 'Attendance Override',
          academic_year: academicYear
        });
      }
      return action;
    },
    onSuccess: (action) => {
      // Invalidate all holiday-override queries to refresh immediately
      queryClient.invalidateQueries({ queryKey: ['holiday-override'] });
      setIsEditingOverride(false); // ✅ Close lazy load after action
      const performedBy = user?.email || user?.username || user?.name || 'system';
      if (performedBy && performedBy !== 'system') {
        base44.entities.AuditLog.create({
          action: action === 'remove' ? 'override_removed' : 'override_applied',
          module: 'Override',
          date: workingDate,
          performed_by: performedBy,
          details: action === 'remove' ? `Removed holiday override for ${selectedClass}-${selectedSection}` : `Applied holiday override for ${selectedClass}-${selectedSection}`,
          academic_year: academicYear
        });
      }
      toast.success(action === 'remove' ? 'Holiday override disabled successfully' : 'Holiday override enabled successfully');
    },
    onError: (err) => {
      console.error('Override toggle error:', err);
      toast.error('Failed to toggle override: ' + (err?.message || 'Unknown error'));
    }
  });

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-sm dark:bg-gray-800">
         <CardContent className="p-3 sm:p-4 space-y-3">
           <div className="flex flex-col gap-3">
             {/* Date: Read-only for Teacher, Editable for Admin */}
             {isAdmin ? (
               <div className="flex items-center gap-2">
                 <label className="text-xs font-medium text-slate-600 dark:text-gray-400 whitespace-nowrap">Date:</label>
                 <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm flex-1" />
               </div>
             ) : (
               <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-gray-700 rounded-lg border border-slate-200 dark:border-gray-600">
                <Calendar className="h-5 w-5 text-slate-400" />
                <span className="text-sm font-medium text-slate-700 dark:text-gray-200">{format(new Date(todayDate), 'MMM dd, yyyy')} (Today)</span>
               </div>
             )}

             {/* Class Dropdown */}
             <Select value={selectedClass} onValueChange={handleClassChange}>
               <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Select Class" /></SelectTrigger>
               <SelectContent>{availableClasses.map(c => <SelectItem key={c} value={c}>Class {c}</SelectItem>)}</SelectContent>
             </Select>

             {/* Section Dropdown (only show after class is selected) */}
             {selectedClass && (
               <Select value={selectedSection} onValueChange={setSelectedSection}>
                 <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Select Section" /></SelectTrigger>
                 <SelectContent>{availableSections.map(s => <SelectItem key={s} value={s}>Section {s}</SelectItem>)}</SelectContent>
               </Select>
             )}
           </div>

          {selectedClass && selectedSection && (
            <HolidayStatusDisplay isHoliday={effectiveHoliday} isSunday={isSunday} hasOverride={hasOverride} holidayReason={holidayReason} />
          )}

          {effectiveHoliday && canOverrideHoliday && selectedClass && selectedSection && (
            <HolidayOverrideToggle 
              selectedDate={workingDate} 
              selectedClass={selectedClass}
              selectedSection={selectedSection}
              canOverride={canOverrideHoliday} 
              user={user}
              academicYear={academicYear} 
            />
          )}

          {canManageHolidays && (
            <div className={`flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-2 pt-2 border-t ${isHoliday ? 'text-amber-600' : 'text-slate-500'}`}>
              <Palmtree className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm font-medium flex-1">
                {isSunday ? '🔴 Sunday — Auto Holiday' : isMarkedHoliday ? `📌 ${holidays[0]?.title || 'Holiday'}` : 'Mark as Holiday'}
              </span>
              {isHoliday && !isMarkedHoliday && (
                <input type="text" placeholder="Holiday reason" value={holidayReason} onChange={e => setHolidayReason(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[160px]" />
              )}
              {!isMarkedHoliday && !isSunday && (
                <button onClick={() => { setIsHoliday(!isHoliday); setManuallyChanged(true); if (isHoliday) setHolidayReason(''); }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${isHoliday ? 'bg-amber-500' : 'bg-gray-300'}`}>
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isHoliday ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              )}
            </div>
          )}

          {!canManageHolidays && (isHoliday || isSunday) && (
            <div className="pt-2 border-t text-amber-600 dark:text-amber-400 text-sm font-medium flex items-center gap-2">
              <Palmtree className="h-4 w-4" />
              {isSunday ? '🔴 Sunday — Auto Holiday' : `📌 ${holidayReason}`}
            </div>
          )}

          {canManageHolidays && (
            <div className="pt-2 border-t">
              <button onClick={() => setShowRangeMode(!showRangeMode)} className="flex items-center gap-2 text-sm text-slate-500 hover:text-amber-600 transition-colors">
                <CalendarRange className="h-4 w-4" />
                <span>Mark Holiday Range</span>
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Admin</span>
              </button>
              {showRangeMode && (
                <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800 space-y-3">
                  <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">Marks ALL classes as holiday for the date range.</p>
                  <div className="flex flex-wrap gap-3 items-center">
                    <div className="flex items-center gap-1.5"><label className="text-xs text-slate-600 dark:text-gray-400">From</label><input type="date" value={rangeStart} onChange={e => setRangeStart(e.target.value)} className="border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-2 py-1.5 text-sm" /></div>
                    <div className="flex items-center gap-1.5"><label className="text-xs text-slate-600 dark:text-gray-400">To</label><input type="date" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} className="border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-2 py-1.5 text-sm" /></div>
                    <input type="text" placeholder="Reason (e.g. Summer Vacation)" value={rangeReason} onChange={e => setRangeReason(e.target.value)} className="border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[160px]" />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button size="sm" className="bg-amber-500 hover:bg-amber-600" onClick={() => saveRangeMutation.mutate()} disabled={!rangeStart || !rangeEnd || saveRangeMutation.isPending}>
                      <Palmtree className="h-4 w-4 mr-1" />
                      {saveRangeMutation.isPending ? `Marking... ${rangeProgress}%` : 'Mark Holiday Range'}
                    </Button>
                    {saveRangeMutation.isPending && <div className="w-full bg-gray-200 rounded-full h-2"><div className="bg-amber-500 h-2 rounded-full transition-all" style={{ width: `${rangeProgress}%` }} /></div>}
                    <Button size="sm" variant="ghost" onClick={() => setShowRangeMode(false)} disabled={saveRangeMutation.isPending}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedClass && selectedSection && (
        <>
          {(isSunday || isMarkedHoliday) && !hasOverride && (
            <Card className="border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-900/20">
              <CardContent className="p-4 flex items-center justify-between">
                <p className="text-sm text-amber-900 dark:text-amber-300 font-medium">👉 Attendance is disabled due to holiday</p>
                {canOverrideHoliday && (
                  <Button
                    type="button"
                    size="sm"
                    className="bg-blue-600 hover:bg-blue-700 text-white flex-shrink-0 ml-4"
                    onClick={() => fallbackOverrideMutation.mutate()}
                    disabled={fallbackOverrideMutation.isPending}
                  >
                    <Zap className="h-3 w-3 mr-1" />
                    {fallbackOverrideMutation.isPending ? 'Enabling...' : 'Enable Attendance'}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {(isSunday || isMarkedHoliday) && hasOverride && (
            <Card className="border-l-4 border-l-blue-500 bg-blue-50 dark:bg-blue-900/20">
              <CardContent className="p-4 flex items-center justify-between">
                <p className="text-sm text-blue-900 dark:text-blue-300 font-medium">✓ Holiday override active — attendance enabled</p>
                {canOverrideHoliday && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="flex-shrink-0 ml-4"
                    onClick={() => fallbackOverrideMutation.mutate()}
                    disabled={fallbackOverrideMutation.isPending}
                  >
                    {fallbackOverrideMutation.isPending ? 'Removing...' : 'Remove Override'}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
          {isRecordLocked && (
            <Card className="border-l-4 border-l-red-500 bg-red-50 dark:bg-red-900/20">
              <CardContent className="p-4 flex items-center justify-between">
                <p className="text-sm text-red-900 dark:text-red-300 font-medium">🔒 Locked after 3:30 PM. Contact admin to unlock.</p>
                {isAdmin && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleUnlockRecords}
                    disabled={isUnlocking}
                    className="flex-shrink-0 ml-4"
                  >
                    <LockOpen className="h-4 w-4 mr-1" />
                    {isUnlocking ? 'Unlocking...' : 'Unlock Record'}
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[{ label: 'Total', value: filteredStudents.length, color: 'blue', Icon: Users },
              { label: 'Draft Full Day', value: fullDayCount, color: 'green', Icon: CheckCircle2 },
              { label: 'Draft Half Day', value: halfDayCount, color: 'yellow', Icon: AlertCircle },
              { label: 'Draft Absent', value: absentCount, color: 'red', Icon: XCircle }].map(({ label, value, color, Icon }) => (
              <Card key={label} className="border-0 shadow-sm p-4 dark:bg-gray-800">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-xl bg-${color}-50 flex items-center justify-center`}>
                    <Icon className={`h-5 w-5 text-${color}-600`} />
                  </div>
                  <div><p className="text-sm text-slate-500 dark:text-gray-400">{label}</p><p className={`text-xl font-bold ${color !== 'blue' ? `text-${color}-600` : 'dark:text-white'}`}>{value}</p></div>
                </div>
              </Card>
            ))}
            <Card className="border-0 shadow-sm p-4">
              <div className="flex items-center gap-3"><div className="text-sm text-slate-500">Status</div><StatusBadge status={currentStatus} /></div>
            </Card>
          </div>

          <Card className="border-0 shadow-sm dark:bg-gray-800 flex flex-col">
            {/* ✅ FIXED: Header stays at top, student list scrolls independently */}
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 flex-shrink-0">
                <CardTitle className="text-base">Class {selectedClass}-{selectedSection}</CardTitle>
                {!effectiveHoliday && <Button variant="outline" size="sm" onClick={markAllPresent}>Mark All Present</Button>}
              </CardHeader>
              <CardContent className="p-0 flex-1 flex flex-col min-h-0">
                {effectiveHoliday ? (
                  <div className="py-12 text-center text-amber-500">
                    <Palmtree className="h-10 w-10 mx-auto mb-3 opacity-60" />
                    <p className="font-medium text-slate-700 dark:text-gray-300">Holiday: {holidayReason || 'Holiday'}</p>
                    <p className="text-sm text-slate-400 dark:text-gray-500 mt-1">All {filteredStudents.length} students will be marked as holiday</p>
                  </div>
                ) : filteredStudents.length === 0 ? (
                 <div className="py-12 text-center text-slate-400 dark:text-gray-500">No published students in this class</div>
               ) : (
                 <div className="overflow-y-auto max-h-[600px] divide-y dark:divide-gray-700 flex-1">
                   {filteredStudents.map((student, index) => {
                     const attType = attendanceData[student.student_id || student.id]?.attendance_type || 'full_day';
                     const attendanceDisabled = effectiveHoliday || isRecordLocked;
                     const bgColor = attType === 'absent' ? 'bg-red-50 dark:bg-red-900/20' : attType === 'half_day' ? 'bg-yellow-50 dark:bg-yellow-900/20' : 'bg-white dark:bg-gray-800';
                     return (
                       <div key={student.id} className={`flex items-center gap-2 sm:gap-4 p-3 sm:p-4 transition-colors ${attendanceDisabled ? 'bg-slate-50 dark:bg-gray-700 opacity-60' : bgColor}`}>
                         <span className="text-xs text-slate-400 dark:text-gray-500 w-6 flex-shrink-0">{student.roll_no || index + 1}</span>
                         <Avatar className="h-8 w-8 flex-shrink-0">
                           <AvatarImage src={student.photo_url} />
                           <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">{student.name?.[0]}</AvatarFallback>
                         </Avatar>
                         <div className="flex-1 min-w-0">
                           <p className="font-medium text-slate-900 dark:text-white truncate text-sm">{student.name}</p>
                           <p className="text-xs text-slate-500 dark:text-gray-400">{student.student_id}</p>
                         </div>
                         <div className="flex gap-1 flex-shrink-0">
                           {[
                             { type: 'full_day', color: 'green', Icon: CheckCircle2, title: 'Present' },
                             { type: 'half_day', color: 'yellow', Icon: AlertCircle, title: 'Half Day' },
                             { type: 'absent', color: 'red', Icon: XCircle, title: 'Absent' }
                           ].map(({ type, color, Icon, title }) => (
                             <Button key={type} size="sm"
                               variant={attType === type ? 'default' : 'outline'}
                               className={attType === type ? `bg-${color}-600 hover:bg-${color}-700` : ''}
                               onClick={() => type === 'half_day'
                                 ? setHalfDayModal({ isOpen: true, studentId: student.student_id || student.id, studentName: student.name })
                                 : setAttendanceType(student.student_id || student.id, type)}
                               disabled={attendanceDisabled}
                               title={title}
                             >
                               <Icon className="h-4 w-4" />
                             </Button>
                           ))}
                         </div>
                       </div>
                     );
                   })}
                 </div>
               )}
             </CardContent>
           </Card>

           {/* ✅ FIXED: Pagination controls outside scrollable container, at bottom */}
           {filteredStudents.length > 0 && (
             <div className="flex items-center justify-between mt-4 px-4 py-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
               <span className="text-sm text-slate-600 dark:text-gray-400">
                 Showing {(studentPage - 1) * STUDENTS_PER_PAGE + 1} to {Math.min(studentPage * STUDENTS_PER_PAGE, studentResponse.total)} of {studentResponse.total} students
               </span>
               <div className="flex gap-2">
                 <Button
                   variant="outline"
                   size="sm"
                   onClick={() => setStudentPage(p => Math.max(1, p - 1))}
                   disabled={studentPage === 1}
                 >
                   Previous
                 </Button>
                 <span className="flex items-center px-3 text-sm text-slate-600 dark:text-gray-400">
                   Page {studentPage} of {studentResponse.totalPages}
                 </span>
                 <Button
                   variant="outline"
                   size="sm"
                   onClick={() => setStudentPage(p => Math.min(studentResponse.totalPages, p + 1))}
                   disabled={studentPage === studentResponse.totalPages}
                 >
                   Next
                 </Button>
               </div>
             </div>
           )}

          {(filteredStudents.length > 0 || effectiveHoliday) && (
            <div className="flex justify-end">
              {effectiveHoliday ? (
                <Button disabled><Palmtree className="mr-2 h-4 w-4" />Attendance Disabled (Holiday)</Button>
              ) : isRecordLocked && !isAdmin ? (
                <Button disabled><Lock className="mr-2 h-4 w-4" />Record Locked</Button>
              ) : isRecordLocked && isAdmin ? (
                <span className="text-sm text-red-600 font-medium">Unlock the record above to edit and save</span>
              ) : (
                <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                  <Save className="mr-2 h-4 w-4" />
                  {saveMutation.isPending ? 'Saving...' : 'Save Attendance'}
                </Button>
              )}
            </div>
          )}
        </>
      )}

      {!selectedClass && (
        <Card className="border-0 shadow-sm dark:bg-gray-800">
          <CardContent className="py-16 text-center">
            <Calendar className="h-12 w-12 text-slate-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-700 dark:text-gray-300">Select Date, Class and Section</h3>
            <p className="text-slate-500 dark:text-gray-400 mt-2">{isAdmin ? 'Choose a date, class and section to mark attendance' : 'Choose a class and section to mark attendance for today'}</p>
          </CardContent>
        </Card>
      )}

      {selectedClass && !selectedSection && (
        <Card className="border-0 shadow-sm dark:bg-gray-800">
          <CardContent className="py-16 text-center">
            <Calendar className="h-12 w-12 text-slate-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-700 dark:text-gray-300">Select Section</h3>
            <p className="text-slate-500 dark:text-gray-400 mt-2">Choose a section to proceed</p>
          </CardContent>
        </Card>
      )}

      {selectedClass && selectedSection && filteredStudents.length === 0 && (
        <Card className="border-0 shadow-sm dark:bg-gray-800">
          <CardContent className="py-16 text-center">
            <Users className="h-12 w-12 text-slate-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-700 dark:text-gray-300">No students found</h3>
            <p className="text-slate-500 dark:text-gray-400 mt-2">No students found for this class and section.</p>
          </CardContent>
        </Card>
      )}

      <HalfDayModal
        isOpen={halfDayModal.isOpen}
        onClose={() => setHalfDayModal({ isOpen: false, studentId: null, studentName: null })}
        onConfirm={(halfDayData) => { if (halfDayModal.studentId) { setAttendanceType(halfDayModal.studentId, 'half_day', halfDayData); setHalfDayModal({ isOpen: false, studentId: null, studentName: null }); } }}
        studentName={halfDayModal.studentName}
      />

      <PastYearWarning
        open={showPastYearWarning}
        academicYear={academicYear}
        onConfirm={() => { setShowPastYearWarning(false); saveMutation.mutate(); }}
        onCancel={() => setShowPastYearWarning(false)}
      />
    </div>
  );
}

// ─── Attendance Summary Tab ───────────────────────────────────────────────────
function AttendanceSummaryTab({ 
  academicYear, 
  user, 
  holidays,
  classSectionData,    // ✅ Receive from parent to avoid duplicate query
  sectionData          // ✅ Receive from parent to avoid duplicate query
}) {
  const [filters, setFilters] = useState({ class: '', section: '', fromDate: '', toDate: '' });
  const [recordsLimitHit, setRecordsLimitHit] = useState(false);

  const availableClasses = classSectionData?.classes || [];
  const availableSections = (sectionData && filters.class) ? sectionData.sections : [];
  const [hasGenerated, setHasGenerated] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');

  const { data: students = [] } = useQuery({
    queryKey: ['students-published', filters.class, filters.section, academicYear],
    queryFn: () => base44.entities.Student.filter({ status: 'Published', class_name: filters.class, section: filters.section, academic_year: academicYear, is_deleted: false }),
    enabled: hasGenerated && !!filters.class && !!filters.section
  });

  // ✅ FIX #2: CRITICAL - Optimize attendance range query with limits
   const { data: attendanceRecords = [] } = useQuery({
     queryKey: ['attendance-range', filters.class, filters.section, filters.fromDate, filters.toDate, academicYear, hasGenerated],
     queryFn: async () => {
       if (!filters.fromDate || !filters.toDate) return [];

       // ✅ OPTIMIZATION: Load records in reverse chronological order + early exit
       const allRecords = await base44.entities.Attendance.filter({ 
         class_name: filters.class, 
         section: filters.section, 
         academic_year: academicYear 
       }, '-date'); // Sort by date DESC to get most recent first

       // ✅ Filter by date range + enforce 2000 record hard limit
       const filtered = allRecords.filter(a => a.date >= filters.fromDate && a.date <= filters.toDate);
       setRecordsLimitHit(filtered.length > 2000);
       return filtered.slice(0, 2000);
     },
     enabled: hasGenerated && !!filters.class && !!filters.section && !!filters.fromDate && !!filters.toDate,
     staleTime: 10 * 60 * 1000 // ✅ Cache results for 10 minutes (range rarely changes)
   });

  // Fetch holiday overrides for summary report
  const { data: overrideData = [] } = useQuery({
    queryKey: ['holiday-overrides-summary', filters.class, filters.section, academicYear],
    queryFn: () => base44.entities.HolidayOverride.filter({ class_name: filters.class, section: filters.section, academic_year: academicYear }),
    enabled: hasGenerated && !!filters.class && !!filters.section
  });

  const overrides = overrideData;

  const reportData = useMemo(() => {
    if (!hasGenerated || students.length === 0) return [];
    const daysBetween = [];
    const current = new Date(filters.fromDate);
    const end = new Date(filters.toDate);
    while (current <= end) { daysBetween.push(format(current, 'yyyy-MM-dd')); current.setDate(current.getDate() + 1); }
    // Holiday override precedence: filter overrides for SELECTED class/section only
    const overrideSetForClass = new Set(overrides.filter(o => o.class_name === filters.class && o.section === filters.section).map(o => o.date));
    const holidaySet = new Set(holidays.map(h => h.date).filter(d => !overrideSetForClass.has(d)));
    const sundaySet = new Set(daysBetween.filter(d => new Date(d + 'T00:00:00').getDay() === 0 && !overrideSetForClass.has(d)));
    const workingDays = daysBetween.filter(d => !holidaySet.has(d) && !sundaySet.has(d)).length;
    // CANONICAL DEDUPLICATION: deduplicate before processing
    const dedupedAttendance = deduplicateAttendanceRecords(attendanceRecords);
    return students.map(student => {
      const sa = dedupedAttendance.filter(a => a.student_id === student.student_id || a.student_id === student.id);
      const dateMap = {};
      sa.forEach(a => { if (!holidaySet.has(a.date) && !sundaySet.has(a.date) && !dateMap[a.date]) dateMap[a.date] = a.attendance_type; });
      const fullDays = Object.values(dateMap).filter(t => t === 'full_day').length;
      const halfDays = Object.values(dateMap).filter(t => t === 'half_day').length;
      const totalPresent = fullDays + halfDays * 0.5;
      // Absent = working days - present (accounts for half-days)
      const absentDays = Math.max(0, workingDays - totalPresent);
      // Use shared calculation for consistent rounding across all views
      const attendancePercent = getAttendancePercentage(totalPresent, workingDays);
      return {
        id: student.id, student_id: student.student_id, name: student.name,
        rollNo: student.roll_no || '-', class: student.class_name, section: student.section,
        totalWorkingDays: workingDays, totalHolidays: daysBetween.length - workingDays,
        presentDays: Math.round(totalPresent * 100) / 100, absentDays,
        attendancePercent
      };
    });
    }, [students, attendanceRecords, holidays, overrides, filters.fromDate, filters.toDate, hasGenerated]);

  const filteredData = useMemo(() => {
    let data = reportData.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
    if (sortBy === 'attendance-asc') data.sort((a, b) => a.attendancePercent - b.attendancePercent);
    else if (sortBy === 'attendance-desc') data.sort((a, b) => b.attendancePercent - a.attendancePercent);
    else data.sort((a, b) => a.name.localeCompare(b.name));
    return data;
  }, [reportData, searchTerm, sortBy]);

  const avgAttendance = filteredData.length > 0 ? (filteredData.reduce((sum, s) => sum + s.attendancePercent, 0) / filteredData.length).toFixed(2) : 0;

  return (
    <div className="space-y-6">
      <FilterSection filters={filters} setFilters={setFilters} onGenerate={() => setHasGenerated(true)} classes={availableClasses} sections={availableSections} />
      {hasGenerated && (
        <>
          {recordsLimitHit && (
            <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/20">
              <CardContent className="p-4 flex gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800 dark:text-amber-300">Warning: Only showing first 1000 attendance records. Please narrow your date range for complete data.</p>
              </CardContent>
            </Card>
          )}
          <SummaryCards totalStudents={students.length} avgAttendance={avgAttendance} workingDays={reportData[0]?.totalWorkingDays || 0} />
          <ReportTable data={filteredData} searchTerm={searchTerm} setSearchTerm={setSearchTerm} sortBy={sortBy} setSortBy={setSortBy} fromDate={filters.fromDate} toDate={filters.toDate} />
        </>
      )}
      {hasGenerated && students.length === 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-16 text-center">
            <BarChart3 className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-700">No students found</h3>
            <p className="text-slate-500 mt-2">Try selecting a different class or section</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Holidays Tab ─────────────────────────────────────────────────────────────
function HolidaysTab({ academicYear, user, isAdmin }) {
   const [showForm, setShowForm] = useState(false);
   const [editingHoliday, setEditingHoliday] = useState(null);
   const [formData, setFormData] = useState({ date: '', title: '', reason: '' });
   const queryClient = useQueryClient();

   // Phase 5: Permission check using can() helper
   const userWithPerms = { ...user, effective_permissions: getEffectivePermissions(user || {}) };
   const canManage = can(userWithPerms, 'attendance_manage_holidays');

   // ✅ FIX #6: ACADEMIC YEAR CACHING - Cache for 1 hour since it rarely changes
   const { data: academicYearData = [] } = useQuery({
      queryKey: ['academic-year', academicYear],
      queryFn: () => base44.entities.AcademicYear.filter({ year: academicYear }),
      enabled: !!academicYear,
      staleTime: 60 * 60 * 1000 // Cache for 1 hour
    });

   const yearLocked = academicYearData.length > 0 && (
     academicYearData[0].is_locked === true ||
     academicYearData[0].status === 'Closed' ||
     academicYearData[0].status === 'Archived'
   );

   // ✅ FIX #6: HOLIDAY CACHING - Cache for 5 minutes
   const { data: holidays = [] } = useQuery({
     queryKey: ['holidays', academicYear],
     queryFn: () => base44.entities.Holiday.filter({ academic_year: academicYear, status: 'Active' }),
     staleTime: 5 * 60 * 1000 // Cache for 5 minutes
   });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Holiday.create({ ...data, marked_by: user?.email, academic_year: academicYear, status: 'Active' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      const performedBy = user?.email || user?.username || user?.name || 'system';
      if (performedBy && performedBy !== 'system') {
        base44.entities.AuditLog.create({ action: 'holiday_marked', module: 'Holiday', date: formData.date, performed_by: performedBy, details: `Marked ${formData.title}`, academic_year: academicYear });
      }
      toast.success('Holiday added');
      setShowForm(false); setFormData({ date: '', title: '', reason: '' });
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Holiday.update(editingHoliday.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      toast.success('Holiday updated');
      setEditingHoliday(null); setShowForm(false); setFormData({ date: '', title: '', reason: '' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Holiday.update(id, { status: 'Cancelled' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      const performedBy = user?.email || user?.username || user?.name || 'system';
      if (performedBy && performedBy !== 'system') {
        base44.entities.AuditLog.create({ action: 'holiday_removed', module: 'Holiday', performed_by: performedBy, details: 'Removed holiday', academic_year: academicYear });
      }
      toast.success('Holiday removed');
    }
  });

  const handleSubmit = () => {
    if (!formData.date || !formData.title) { toast.error('Date and title are required'); return; }
    if (yearLocked) { toast.error('This academic year is locked. No mutations allowed.'); return; }
    editingHoliday ? updateMutation.mutate(formData) : createMutation.mutate(formData);
  };

  const sortedHolidays = [...holidays].sort((a, b) => new Date(a.date) - new Date(b.date));

  if (!canManage) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-4 flex gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">You don't have permission to manage holidays. Contact your admin.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
         <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Active Holidays — {academicYear}</h2>
         <Button onClick={() => { setEditingHoliday(null); setFormData({ date: '', title: '', reason: '' }); setShowForm(true); }} disabled={yearLocked}>
           <Plus className="h-4 w-4 mr-2" />Add Holiday
         </Button>
       </div>
       {yearLocked && (
          <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
            <CardContent className="p-4 flex gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800 dark:text-red-300">This academic year is locked. Holiday mutations are disabled.</p>
            </CardContent>
          </Card>
        )}

      {showForm && (
        <Card className="border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-gray-300">Date</label>
                <input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm w-full mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 dark:text-gray-300">Holiday Name</label>
                <input type="text" placeholder="e.g., Diwali" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm w-full mt-1" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-gray-300">Reason (optional)</label>
              <input type="text" value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} className="border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm w-full mt-1" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSubmit}>{editingHoliday ? 'Update' : 'Add'} Holiday</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {sortedHolidays.length === 0 ? (
        <Card className="border-0 shadow-sm dark:bg-gray-800"><CardContent className="py-12 text-center text-slate-400 dark:text-gray-500"><Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>No holidays marked yet</p></CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {sortedHolidays.map((holiday) => (
            <Card key={holiday.id} className="border-0 shadow-sm dark:bg-gray-800">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
                    <Calendar className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 dark:text-white">{holiday.title}</p>
                    <p className="text-sm text-slate-500 dark:text-gray-400">{format(parseISO(holiday.date), 'MMM dd, yyyy')} {holiday.reason && `· ${holiday.reason}`}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="icon" variant="ghost" onClick={() => { if (yearLocked) { toast.error('This academic year is locked. No mutations allowed.'); return; } setEditingHoliday(holiday); setFormData({ date: holiday.date, title: holiday.title, reason: holiday.reason || '' }); setShowForm(true); }} disabled={yearLocked}>
                    <Edit2 className="h-4 w-4 text-slate-400" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (yearLocked) { toast.error('This academic year is locked. No mutations allowed.'); return; } deleteMutation.mutate(holiday.id); }} disabled={yearLocked}>
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Attendance() {
  const { academicYear } = useAcademicYear();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('mark');
  const [selectedClass, setSelectedClass] = useState(''); // ✅ Parent state for class

  useEffect(() => {
    setUser(getStaffSession());
  }, []);

  // Helper to get performer name for audit logs
  const getPerformedBy = () => {
    if (user?.email) return user.email;
    if (user?.username) return user.username;
    if (user?.name) return user.name;
    return 'system';
  };

  // ✅ FIX #1: SHARED PARENT QUERIES - Load once and pass to all tabs
  const { data: classSectionData } = useQuery({
    queryKey: ['classes-for-year', academicYear],
    queryFn: () => getClassesForYear(academicYear),
    enabled: !!academicYear,
    staleTime: 5 * 60 * 1000,
  });

  const { data: sectionData } = useQuery({
    queryKey: ['sections-for-class', academicYear, selectedClass],
    queryFn: () => getSectionsForClass(academicYear, selectedClass),
    enabled: !!academicYear && !!selectedClass,
    staleTime: 5 * 60 * 1000,
  });

  // Single holidays query shared by all tabs (with proper caching)
  const { data: holidays = [] } = useQuery({
    queryKey: ['holidays', academicYear],
    queryFn: () => base44.entities.Holiday.filter({ status: 'Active', academic_year: academicYear }),
    enabled: !!academicYear,
    staleTime: 10 * 60 * 1000 // Cache for 10 mins
  });

  const isAdmin = ['admin', 'principal'].includes((user?.role || '').toLowerCase());
  const isExamStaff = (user?.role || '').toLowerCase() === 'exam_staff';
  // exam_staff can access snapshot + summary but NOT holidays management
  const canViewReports = isAdmin || isExamStaff;

  // Block roles from tabs they cannot access
  const handleTabChange = (tab) => {
    if (tab === 'holidays' && !isAdmin) return;
    if ((tab === 'snapshot' || tab === 'summary') && !canViewReports) return;
    setActiveTab(tab);
  };

  const tabCount = isAdmin ? 4 : canViewReports ? 3 : 1;
  const queryClient = useQueryClient();

  const handleRefresh = async () => {
    queryClient.invalidateQueries({ queryKey: ['holidays'] });
  };

  return (
    <LoginRequired allowedRoles={['admin', 'principal', 'teacher', 'staff', 'exam_staff']} pageName="Attendance">
      <div className="min-h-screen bg-slate-50 dark:bg-gray-900 w-full overflow-x-hidden">
        <PageHeader title="Attendance" subtitle="Mark attendance, view reports, and manage holidays" />

        <PullToRefresh onRefresh={handleRefresh}>
        <div className="px-3 sm:px-4 lg:px-8 py-4 max-w-full">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="mb-6 flex flex-wrap h-auto gap-1 p-1">
              <TabsTrigger value="mark">Mark Attendance</TabsTrigger>
              {canViewReports && <TabsTrigger value="snapshot">Daily Snapshot</TabsTrigger>}
              {canViewReports && <TabsTrigger value="summary">Summary Report</TabsTrigger>}
              {isAdmin && <TabsTrigger value="holidays">Holidays</TabsTrigger>}
              {isAdmin && <TabsTrigger value="absent-notif">Absent Notify</TabsTrigger>}
            </TabsList>

            <TabsContent value="mark">
              <MarkAttendanceTab 
                user={user} 
                academicYear={academicYear} 
                isAdmin={isAdmin} 
                holidays={holidays}
                classSectionData={classSectionData}
                sectionData={sectionData}
                selectedClass={selectedClass}
                onClassChange={setSelectedClass}
              />
            </TabsContent>

            {canViewReports && (
              <TabsContent value="snapshot">
                <Suspense fallback={<TabLoadingSpinner />}>
                  <DailySnapshotTabLazy />
                </Suspense>
              </TabsContent>
            )}

            {canViewReports && (
              <TabsContent value="summary">
                <AttendanceSummaryTab 
                  academicYear={academicYear} 
                  user={user} 
                  holidays={holidays}
                  classSectionData={classSectionData}
                  sectionData={sectionData}
                />
              </TabsContent>
            )}

            {isAdmin && (
              <TabsContent value="holidays">
                <HolidaysTab academicYear={academicYear} user={user} isAdmin={isAdmin} />
              </TabsContent>
            )}

            {isAdmin && (
              <TabsContent value="absent-notif">
                <AbsentNotificationTab academicYear={academicYear} user={user} />
              </TabsContent>
            )}

            {/* Block roles landing on tabs they cannot access via state or bookmark */}
            {!isAdmin && activeTab === 'holidays' && (
              <TabsContent value="holidays">
                <Card className="border-red-200 bg-red-50">
                  <CardContent className="p-6 text-center">
                    <Lock className="h-10 w-10 text-red-400 mx-auto mb-3" />
                    <p className="font-semibold text-red-800">Not Authorized</p>
                    <p className="text-sm text-red-600 mt-1">Only admins and principals can manage holidays.</p>
                    <Button className="mt-4" size="sm" onClick={() => setActiveTab('mark')}>Go to Mark Attendance</Button>
                  </CardContent>
                </Card>
              </TabsContent>
            )}
            {!canViewReports && (activeTab === 'snapshot' || activeTab === 'summary') && (
              <TabsContent value={activeTab}>
                <Card className="border-red-200 bg-red-50">
                  <CardContent className="p-6 text-center">
                    <Lock className="h-10 w-10 text-red-400 mx-auto mb-3" />
                    <p className="font-semibold text-red-800">Not Authorized</p>
                    <p className="text-sm text-red-600 mt-1">Only admins, principals, and exam staff can access this section.</p>
                    <Button className="mt-4" size="sm" onClick={() => setActiveTab('mark')}>Go to Mark Attendance</Button>
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </div>
        </PullToRefresh>
      </div>
    </LoginRequired>
  );
}