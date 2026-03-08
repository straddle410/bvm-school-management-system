import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import LoginRequired from '@/components/LoginRequired';
import { getStaffSession } from '@/components/useStaffSession';
import { useAcademicYear } from '@/components/AcademicYearContext';
import PastYearWarning, { isPastAcademicYear } from '@/components/PastYearWarning';
import { getAttendancePercentage, deduplicateAttendanceRecords } from '@/components/attendanceCalculations';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import HolidayStatusDisplay from '@/components/HolidayStatusDisplay';
import HolidayOverrideToggle from '@/components/HolidayOverrideToggle';
import HalfDayModal from '@/components/attendance/HalfDayModal';
import DailySnapshotTab from '@/components/attendance/DailySnapshotTab';
import FilterSection from '@/components/attendanceSummary/FilterSection';
import SummaryCards from '@/components/attendanceSummary/SummaryCards';
import ReportTable from '@/components/attendanceSummary/ReportTable';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Calendar, CheckCircle2, XCircle, Users, Save, Palmtree, CalendarRange,
  AlertCircle, Lock, BarChart3, Plus, Trash2, Edit2
} from 'lucide-react';
import { format, getDay, eachDayOfInterval, parseISO } from 'date-fns';
import { toast } from "sonner";
import { getClassesForYear, getSectionsForClass } from '@/components/classSectionHelper';

// ─── Mark Attendance Tab ──────────────────────────────────────────────────────
function MarkAttendanceTab({ user, academicYear, isAdmin }) {
  const todayDate = format(new Date(), 'yyyy-MM-dd');
  const [selectedDate, setSelectedDate] = useState(isAdmin ? '' : todayDate);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');

  // Dynamic class/section from SectionConfig (with fallback)
  const { data: classSectionData } = useQuery({
    queryKey: ['classes-for-year', academicYear],
    queryFn: () => getClassesForYear(academicYear),
    enabled: !!academicYear,
    staleTime: 5 * 60 * 1000,
  });
  const availableClasses = classSectionData?.classes || [];

  const { data: sectionData } = useQuery({
    queryKey: ['sections-for-class', academicYear, selectedClass],
    queryFn: () => getSectionsForClass(academicYear, selectedClass),
    enabled: !!academicYear && !!selectedClass,
    staleTime: 5 * 60 * 1000,
  });
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

  const { data: students = [] } = useQuery({
    queryKey: ['students-published', academicYear],
    queryFn: () => base44.entities.Student.filter({ status: 'Published', academic_year: academicYear, is_deleted: false })
  });

  const { data: existingAttendance = [] } = useQuery({
    queryKey: ['attendance', workingDate, selectedClass, selectedSection, academicYear],
    queryFn: () => base44.entities.Attendance.filter({
      date: workingDate, class_name: selectedClass, section: selectedSection, academic_year: academicYear
    }),
    enabled: !!selectedClass && !!selectedSection && !!workingDate
  });

  const isRecordLocked = existingAttendance.length > 0 && existingAttendance[0]?.is_locked;
  const lockedAtTime = existingAttendance[0]?.locked_at ? new Date(existingAttendance[0].locked_at).toLocaleString() : null;

  const { data: staffAccount } = useQuery({
    queryKey: ['staff-account', user?.email],
    queryFn: () => base44.entities.StaffAccount.filter({ email: user?.email }),
    enabled: !!user?.email
  });

  const { data: holidays = [] } = useQuery({
    queryKey: ['holidays', workingDate, academicYear],
    queryFn: () => base44.entities.Holiday.filter({ status: 'Active', academic_year: academicYear, date: workingDate }),
    enabled: !!academicYear && !!workingDate
  });

  const { data: overrides = [] } = useQuery({
    queryKey: ['holiday-override', workingDate, selectedClass, selectedSection, academicYear],
    queryFn: () => base44.entities.HolidayOverride.filter({ date: workingDate, class_name: selectedClass, section: selectedSection, academic_year: academicYear })
  });

  const canOverrideHoliday = staffAccount?.[0]?.permissions?.override_holidays || isAdmin;
  const isMarkedHoliday = holidays.length > 0;
  const hasOverride = overrides.length > 0;
  const canManageHolidays = isAdmin;
  // Single source of truth for holiday override state
  const effectiveHoliday = hasOverride ? false : (isSunday || isMarkedHoliday);

  useEffect(() => {
    // Override precedence: if override exists, treat as working day even if holiday is marked
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
      if (!manuallyChanged) {
        setIsHoliday(effectiveHoliday);
        setHolidayReason(isMarkedHoliday ? (holidays[0]?.title || 'Holiday') : (isSunday ? 'Sunday' : ''));
      }
    } else {
      setAttendanceData({});
      if (!manuallyChanged) {
        setIsHoliday(effectiveHoliday);
        setHolidayReason(isMarkedHoliday ? (holidays[0]?.title || 'Holiday') : (isSunday ? 'Sunday' : ''));
      }
    }
  }, [existingAttendance, isSunday, manuallyChanged, isMarkedHoliday, holidays, hasOverride, effectiveHoliday]);

  const filteredStudents = students.filter(s =>
    s.class_name === selectedClass && s.section === selectedSection
  ).sort((a, b) => (a.roll_no || 0) - (b.roll_no || 0));

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!academicYear) throw new Error('Academic year not configured');
      if (!selectedClass) throw new Error('Class is required');
      if (!selectedSection) throw new Error('Section is required');
      if (!workingDate) throw new Error('Date is required');
      if (isPastAcademicYear(academicYear)) throw new Error('PAST_YEAR_WARNING');
      const promises = filteredStudents.map(async (student) => {
        const existing = attendanceData[student.student_id];
        const attType = existing?.attendance_type || 'full_day';
        const data = {
          date: workingDate, class_name: selectedClass, section: selectedSection,
          student_id: student.student_id || student.id, student_name: student.name,
          attendance_type: isHoliday ? 'holiday' : attType,
          half_day_period: existing?.half_day_period || null,
          half_day_reason: existing?.half_day_reason || '',
          is_present: isHoliday ? false : (attType !== 'absent'),
          is_holiday: isHoliday, holiday_reason: isHoliday ? (holidayReason || 'Holiday') : '',
          marked_by: user?.email, academic_year: academicYear,
          // Status Convention: 'Taken' = normal attendance record, 'Holiday' = holiday marked
          status: isHoliday ? 'Holiday' : 'Taken'
        };
        if (existing?.id) {
          const response = await base44.functions.invoke('updateAttendanceWithValidation', { attendanceId: existing.id, data });
          return response.data;
        }
        const dedupCheck = await base44.functions.invoke('validateAttendanceCreateDedup', {
          date: workingDate, studentId: student.student_id || student.id,
          classname: selectedClass, section: selectedSection, academicYear
        });
        if (dedupCheck.data?.isDuplicate) {
          const response = await base44.functions.invoke('updateAttendanceWithValidation', { attendanceId: dedupCheck.data.existingRecordId, data });
          return response.data;
        }
        return base44.entities.Attendance.create(data);
      });
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['attendance']);
      queryClient.invalidateQueries(['attendance', workingDate, selectedClass, selectedSection, academicYear]);
      toast.success(isHoliday ? 'Holiday marked successfully' : 'Attendance saved successfully');
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
      const holidaysToCreate = [];
      for (let i = 0; i < days.length; i++) {
        const dateStr = format(days[i], 'yyyy-MM-dd');
        const existing = await base44.entities.Holiday.filter({ date: dateStr, academic_year: academicYear });
        if (existing.length === 0) {
          holidaysToCreate.push({ date: dateStr, title: rangeReason || 'Holiday', reason: rangeReason || 'Holiday', marked_by: user?.email, academic_year: academicYear, status: 'Active' });
        }
        setRangeProgress(Math.round(((i + 1) / days.length) * 100));
      }
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
      const response = await base44.functions.invoke('unlockAttendanceForAdmin', {
        date: workingDate,
        class_name: selectedClass,
        section: selectedSection,
        academic_year: academicYear
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

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-sm">
         <CardContent className="p-3 sm:p-4 space-y-3">
           <div className="flex flex-col gap-3">
             {/* Date: Read-only for Teacher, Editable for Admin */}
             {isAdmin ? (
               <div className="flex items-center gap-2">
                 <label className="text-xs font-medium text-slate-600 whitespace-nowrap">Date:</label>
                 <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="border rounded-lg px-3 py-2 text-sm flex-1" />
               </div>
             ) : (
               <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg border border-slate-200">
                 <Calendar className="h-5 w-5 text-slate-400" />
                 <span className="text-sm font-medium text-slate-700">{format(new Date(todayDate), 'MMM dd, yyyy')} (Today)</span>
               </div>
             )}

             {/* Class Dropdown */}
             <Select value={selectedClass} onValueChange={(v) => { setSelectedClass(v); setSelectedSection(''); }}>
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
            <HolidayStatusDisplay isHoliday={isHoliday} isSunday={isSunday} hasOverride={hasOverride} holidayReason={holidayReason} />
          )}

          {isHoliday && canOverrideHoliday && selectedClass && (
            <HolidayOverrideToggle selectedDate={workingDate} canOverride={canOverrideHoliday} user={user} academicYear={academicYear} />
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
            <div className="pt-2 border-t text-amber-600 text-sm font-medium flex items-center gap-2">
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
                <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-3">
                  <p className="text-xs text-amber-700 font-medium">Marks ALL classes as holiday for the date range.</p>
                  <div className="flex flex-wrap gap-3 items-center">
                    <div className="flex items-center gap-1.5"><label className="text-xs text-slate-600">From</label><input type="date" value={rangeStart} onChange={e => setRangeStart(e.target.value)} className="border rounded-lg px-2 py-1.5 text-sm" /></div>
                    <div className="flex items-center gap-1.5"><label className="text-xs text-slate-600">To</label><input type="date" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} className="border rounded-lg px-2 py-1.5 text-sm" /></div>
                    <input type="text" placeholder="Reason (e.g. Summer Vacation)" value={rangeReason} onChange={e => setRangeReason(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[160px]" />
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
          {isHoliday && !hasHolidayOverride && (
            <Card className="border-l-4 border-l-amber-500 bg-amber-50"><CardContent className="p-4"><p className="text-sm text-amber-900 font-medium">👉 Attendance is disabled due to holiday</p></CardContent></Card>
          )}
          {isRecordLocked && (
            <Card className="border-l-4 border-l-red-500 bg-red-50">
              <CardContent className="p-4 flex items-center justify-between">
                <p className="text-sm text-red-900 font-medium">🔒 Locked after 3:00 PM. Contact admin to unlock.</p>
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
              <Card key={label} className="border-0 shadow-sm p-4">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-xl bg-${color}-50 flex items-center justify-center`}>
                    <Icon className={`h-5 w-5 text-${color}-600`} />
                  </div>
                  <div><p className="text-sm text-slate-500">{label}</p><p className={`text-xl font-bold ${color !== 'blue' ? `text-${color}-600` : ''}`}>{value}</p></div>
                </div>
              </Card>
            ))}
            <Card className="border-0 shadow-sm p-4">
              <div className="flex items-center gap-3"><div className="text-sm text-slate-500">Status</div><StatusBadge status={currentStatus} /></div>
            </Card>
          </div>

          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4">
              <CardTitle className="text-base">Class {selectedClass}-{selectedSection}</CardTitle>
              {!isHoliday && <Button variant="outline" size="sm" onClick={markAllPresent}>Mark All Present</Button>}
            </CardHeader>
            <CardContent className="p-0">
              {isHoliday ? (
                <div className="py-12 text-center text-amber-500">
                  <Palmtree className="h-10 w-10 mx-auto mb-3 opacity-60" />
                  <p className="font-medium text-slate-700">Holiday: {holidayReason || 'Holiday'}</p>
                  <p className="text-sm text-slate-400 mt-1">All {filteredStudents.length} students will be marked as holiday</p>
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="py-12 text-center text-slate-400">No published students in this class</div>
              ) : (
                <div className="divide-y">
                  {filteredStudents.map((student, index) => {
                    const attType = attendanceData[student.student_id || student.id]?.attendance_type || 'full_day';
                    const attendanceDisabled = (isHoliday && !hasHolidayOverride) || isRecordLocked;
                    const bgColor = attType === 'absent' ? 'bg-red-50' : attType === 'half_day' ? 'bg-yellow-50' : 'bg-white';
                    return (
                      <div key={student.id} className={`flex items-center gap-2 sm:gap-4 p-3 sm:p-4 transition-colors ${attendanceDisabled ? 'bg-slate-50 opacity-60' : bgColor}`}>
                        <span className="text-xs text-slate-400 w-6 flex-shrink-0">{student.roll_no || index + 1}</span>
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          <AvatarImage src={student.photo_url} />
                          <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">{student.name?.[0]}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 truncate text-sm">{student.name}</p>
                          <p className="text-xs text-slate-500">{student.student_id}</p>
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

          {(filteredStudents.length > 0 || isHoliday) && (
            <div className="flex justify-end">
              {isHoliday && !hasHolidayOverride ? (
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
        <Card className="border-0 shadow-sm">
          <CardContent className="py-16 text-center">
            <Calendar className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-700">Select Date, Class and Section</h3>
            <p className="text-slate-500 mt-2">{isAdmin ? 'Choose a date, class and section to mark attendance' : 'Choose a class and section to mark attendance for today'}</p>
          </CardContent>
        </Card>
      )}

      {selectedClass && !selectedSection && (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-16 text-center">
            <Calendar className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-700">Select Section</h3>
            <p className="text-slate-500 mt-2">Choose a section to proceed</p>
          </CardContent>
        </Card>
      )}

      {selectedClass && selectedSection && filteredStudents.length === 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-16 text-center">
            <Users className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-700">No students found</h3>
            <p className="text-slate-500 mt-2">No students found for this class and section.</p>
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
function AttendanceSummaryTab({ academicYear, user }) {
  const [filters, setFilters] = useState({ class: '', section: '', fromDate: '', toDate: '' });

  const { data: classSectionData } = useQuery({
    queryKey: ['classes-for-year', academicYear],
    queryFn: () => getClassesForYear(academicYear),
    enabled: !!academicYear,
    staleTime: 5 * 60 * 1000,
  });
  const availableClasses = classSectionData?.classes || [];

  const { data: sectionData } = useQuery({
    queryKey: ['sections-for-class', academicYear, filters.class],
    queryFn: () => getSectionsForClass(academicYear, filters.class),
    enabled: !!academicYear && !!filters.class,
    staleTime: 5 * 60 * 1000,
  });
  const availableSections = sectionData?.sections || [];
  const [hasGenerated, setHasGenerated] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');

  const { data: students = [] } = useQuery({
    queryKey: ['students-published', filters.class, filters.section, academicYear],
    queryFn: () => base44.entities.Student.filter({ status: 'Published', class_name: filters.class, section: filters.section, academic_year: academicYear, is_deleted: false }),
    enabled: hasGenerated && !!filters.class && !!filters.section
  });

  const { data: attendanceRecords = [] } = useQuery({
    queryKey: ['attendance-range', filters.class, filters.section, filters.fromDate, filters.toDate, academicYear],
    queryFn: () => base44.entities.Attendance.filter({ class_name: filters.class, section: filters.section, academic_year: academicYear })
      .then(all => all.filter(a => a.date >= filters.fromDate && a.date <= filters.toDate)),
    enabled: hasGenerated && !!filters.class && !!filters.fromDate && !!filters.toDate
  });

  const { data: holidays = [] } = useQuery({
    queryKey: ['holidays-range', filters.fromDate, filters.toDate, academicYear],
    queryFn: () => base44.entities.Holiday.filter({ status: 'Active', academic_year: academicYear })
      .then(all => all.filter(h => h.date >= filters.fromDate && h.date <= filters.toDate)),
    enabled: hasGenerated && !!filters.fromDate && !!filters.toDate
  });

  const { data: overrides = [] } = useQuery({
    queryKey: ['holiday-overrides-range', filters.fromDate, filters.toDate, filters.class, filters.section, academicYear],
    queryFn: () => base44.entities.HolidayOverride.filter({ class_name: filters.class, section: filters.section, academic_year: academicYear })
      .then(all => all.filter(o => o.date >= filters.fromDate && o.date <= filters.toDate)),
    enabled: hasGenerated && !!filters.class && !!filters.section && !!filters.fromDate && !!filters.toDate
  });

  const reportData = useMemo(() => {
    if (!hasGenerated || students.length === 0) return [];
    const daysBetween = [];
    const current = new Date(filters.fromDate);
    const end = new Date(filters.toDate);
    while (current <= end) { daysBetween.push(format(current, 'yyyy-MM-dd')); current.setDate(current.getDate() + 1); }
    // Holiday override precedence: if override exists, treat as working day
    const overrideSet = new Set(overrides.map(o => o.date));
    const holidaySet = new Set(holidays.map(h => h.date).filter(d => !overrideSet.has(d)));
    const sundaySet = new Set(daysBetween.filter(d => new Date(d + 'T00:00:00').getDay() === 0));
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
      const absentDays = Object.values(dateMap).filter(t => t === 'absent').length;
      // Use shared calculation for consistent rounding across all views
      const attendancePercent = getAttendancePercentage(totalPresent, workingDays);
      return {
        id: student.id, student_id: student.student_id, name: student.name,
        rollNo: student.roll_no || '-', class: student.class_name, section: student.section,
        totalWorkingDays: workingDays, totalHolidays: daysBetween.filter(d => holidaySet.has(d)).length,
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

  const { data: academicYearData = [] } = useQuery({
    queryKey: ['academic-year', academicYear],
    queryFn: () => base44.entities.AcademicYear.filter({ year: academicYear }),
    enabled: !!academicYear
  });

  const yearLocked = academicYearData.length > 0 && (
    academicYearData[0].is_locked === true ||
    academicYearData[0].status === 'Closed' ||
    academicYearData[0].status === 'Archived'
  );

  const { data: holidays = [] } = useQuery({
    queryKey: ['holidays', academicYear],
    queryFn: () => base44.entities.Holiday.filter({ academic_year: academicYear, status: 'Active' })
  });

  const { data: staffAccount } = useQuery({
    queryKey: ['staff-account', user?.email],
    queryFn: () => base44.entities.StaffAccount.filter({ email: user?.email }),
    enabled: !!user?.email
  });

  const canManage = staffAccount?.[0]?.permissions?.manage_holidays || isAdmin;

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Holiday.create({ ...data, marked_by: user?.email, academic_year: academicYear, status: 'Active' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      base44.entities.AuditLog.create({ action: 'holiday_marked', module: 'Holiday', date: formData.date, performed_by: user?.email, details: `Marked ${formData.title}`, academic_year: academicYear });
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
      base44.entities.AuditLog.create({ action: 'holiday_removed', module: 'Holiday', performed_by: user?.email, details: 'Removed holiday', academic_year: academicYear });
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
         <h2 className="text-lg font-semibold text-slate-900">Active Holidays — {academicYear}</h2>
         <Button onClick={() => { setEditingHoliday(null); setFormData({ date: '', title: '', reason: '' }); setShowForm(true); }} disabled={yearLocked}>
           <Plus className="h-4 w-4 mr-2" />Add Holiday
         </Button>
       </div>
       {yearLocked && (
         <Card className="border-red-200 bg-red-50">
           <CardContent className="p-4 flex gap-3">
             <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
             <p className="text-sm text-red-800">This academic year is locked. Holiday mutations are disabled.</p>
           </CardContent>
         </Card>
       )}

      {showForm && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-700">Date</label>
                <input type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} className="border rounded-lg px-3 py-2 text-sm w-full mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Holiday Name</label>
                <input type="text" placeholder="e.g., Diwali" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="border rounded-lg px-3 py-2 text-sm w-full mt-1" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Reason (optional)</label>
              <input type="text" value={formData.reason} onChange={(e) => setFormData({ ...formData, reason: e.target.value })} className="border rounded-lg px-3 py-2 text-sm w-full mt-1" />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSubmit}>{editingHoliday ? 'Update' : 'Add'} Holiday</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {sortedHolidays.length === 0 ? (
        <Card className="border-0 shadow-sm"><CardContent className="py-12 text-center text-slate-400"><Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" /><p>No holidays marked yet</p></CardContent></Card>
      ) : (
        <div className="grid gap-3">
          {sortedHolidays.map((holiday) => (
            <Card key={holiday.id} className="border-0 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                    <Calendar className="h-5 w-5 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900">{holiday.title}</p>
                    <p className="text-sm text-slate-500">{format(parseISO(holiday.date), 'MMM dd, yyyy')} {holiday.reason && `· ${holiday.reason}`}</p>
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

  useEffect(() => {
    setUser(getStaffSession());
  }, []);

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

  return (
    <LoginRequired allowedRoles={['admin', 'principal', 'teacher', 'staff', 'exam_staff']} pageName="Attendance">
      <div className="min-h-screen bg-slate-50 w-full overflow-x-hidden">
        <PageHeader title="Attendance" subtitle="Mark attendance, view reports, and manage holidays" />

        <div className="px-3 sm:px-4 lg:px-8 py-4 max-w-full">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className={`mb-6 grid grid-cols-${tabCount}`}>
              <TabsTrigger value="mark">Mark Attendance</TabsTrigger>
              {canViewReports && <TabsTrigger value="snapshot">Daily Snapshot</TabsTrigger>}
              {canViewReports && <TabsTrigger value="summary">Summary Report</TabsTrigger>}
              {isAdmin && <TabsTrigger value="holidays">Holidays</TabsTrigger>}
            </TabsList>

            <TabsContent value="mark">
              <MarkAttendanceTab user={user} academicYear={academicYear} isAdmin={isAdmin} />
            </TabsContent>

            {canViewReports && (
              <TabsContent value="snapshot">
                <DailySnapshotTab />
              </TabsContent>
            )}

            {canViewReports && (
              <TabsContent value="summary">
                <AttendanceSummaryTab academicYear={academicYear} user={user} />
              </TabsContent>
            )}

            {isAdmin && (
              <TabsContent value="holidays">
                <HolidaysTab academicYear={academicYear} user={user} isAdmin={isAdmin} />
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
      </div>
    </LoginRequired>
  );
}