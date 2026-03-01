import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import LoginRequired from '@/components/LoginRequired';
import { getStaffSession } from '@/components/useStaffSession';
import { useAcademicYear } from '@/components/AcademicYearContext';
import PastYearWarning, { isPastAcademicYear } from '@/components/PastYearWarning';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import HolidayStatusDisplay from '@/components/HolidayStatusDisplay';
import HolidayOverrideToggle from '@/components/HolidayOverrideToggle';
import HalfDayModal from '@/components/attendance/HalfDayModal';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar, CheckCircle2, XCircle, Users, Save, Palmtree, CalendarRange, AlertCircle, Lock
} from 'lucide-react';
import { format, getDay, eachDayOfInterval, parseISO } from 'date-fns';
import { toast } from "sonner";

const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
const SECTIONS = ['A'];

export default function Attendance() {
  const { academicYear } = useAcademicYear();
  const [user, setUser] = useState(null);
  const [schoolProfile, setSchoolProfile] = useState(null);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('A');
  const [attendanceData, setAttendanceData] = useState({});
  const [isHoliday, setIsHoliday] = useState(false);
  const [holidayReason, setHolidayReason] = useState('');
  const [showRangeMode, setShowRangeMode] = useState(false);
  const [rangeStart, setRangeStart] = useState('');
  const [rangeEnd, setRangeEnd] = useState('');
  const [rangeReason, setRangeReason] = useState('');
  const [rangeProgress, setRangeProgress] = useState(0);
  const [hasHolidayOverride, setHasHolidayOverride] = useState(false);
  const [halfDayModal, setHalfDayModal] = useState({ isOpen: false, studentId: null, studentName: null });
  const [showPastYearWarning, setShowPastYearWarning] = useState(false);

  const queryClient = useQueryClient();

  // Auto-detect Sunday
  const isSunday = getDay(new Date(selectedDate + 'T00:00:00')) === 0;

  useEffect(() => {
    setUser(getStaffSession());
    base44.entities.SchoolProfile.list().then(profiles => {
      if (profiles.length > 0) setSchoolProfile(profiles[0]);
    }).catch(() => {});
  }, []);

  const { data: students = [] } = useQuery({
    queryKey: ['students-published', academicYear],
    queryFn: () => base44.entities.Student.filter({ status: 'Published', academic_year: academicYear })
  });

  const { data: existingAttendance = [] } = useQuery({
    queryKey: ['attendance', selectedDate, selectedClass, selectedSection, academicYear],
    queryFn: () => base44.entities.Attendance.filter({
      date: selectedDate,
      class_name: selectedClass,
      section: selectedSection,
      academic_year: academicYear
    }),
    enabled: !!selectedClass && !!selectedSection
  });

  // Check if current attendance is locked
  const isRecordLocked = existingAttendance.length > 0 && existingAttendance[0]?.is_locked;
  const lockedAtTime = existingAttendance[0]?.locked_at ? new Date(existingAttendance[0].locked_at).toLocaleString() : null;

  const { data: staffAccount } = useQuery({
    queryKey: ['staff-account', user?.email],
    queryFn: () => base44.entities.StaffAccount.filter({ email: user?.email }),
    enabled: !!user?.email
  });

  const { data: holidays = [] } = useQuery({
    queryKey: ['holidays', selectedDate, academicYear],
    queryFn: () => base44.entities.Holiday.filter({ status: 'Active', academic_year: academicYear, date: selectedDate }),
    enabled: !!selectedDate && !!academicYear
  });

  const canOverrideHoliday = staffAccount?.[0]?.permissions?.override_holidays || user?.role === 'admin';
  const isMarkedHoliday = holidays.length > 0;
  const canManageHolidays = user?.role === 'admin' || user?.role === 'principal';

  // Track if user manually changed holiday toggle
  const [manuallyChanged, setManuallyChanged] = useState(false);

  useEffect(() => {
    const detectedHoliday = isSunday || isMarkedHoliday;

    if (existingAttendance.length > 0) {
      const data = {};
      existingAttendance.forEach(a => {
        data[a.student_id] = { 
          is_present: a.is_present, 
          id: a.id, 
          status: a.status,
          attendance_type: a.attendance_type || 'full_day',
          half_day_period: a.half_day_period || null,
          half_day_reason: a.half_day_reason || ''
        };
      });
      setAttendanceData(data);
      if (!manuallyChanged) {
        setIsHoliday(detectedHoliday);
        setHolidayReason(isMarkedHoliday ? (holidays[0]?.title || 'Holiday') : (isSunday ? 'Sunday' : ''));
      }
    } else {
      setAttendanceData({});
      if (!manuallyChanged) {
        setIsHoliday(detectedHoliday);
        setHolidayReason(isMarkedHoliday ? (holidays[0]?.title || 'Holiday') : (isSunday ? 'Sunday' : ''));
      }
    }
  }, [existingAttendance, isSunday, manuallyChanged, isMarkedHoliday, holidays]);

  const filteredStudents = students.filter(s => 
    s.class_name === selectedClass && s.section === selectedSection
  ).sort((a, b) => (a.roll_no || 0) - (b.roll_no || 0));

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!academicYear) throw new Error('Academic year not configured');
      if (isPastAcademicYear(academicYear) && schoolProfile?.academic_year !== academicYear) {
        throw new Error('PAST_YEAR_WARNING');
      }
      const promises = filteredStudents.map(async (student) => {
        const existing = attendanceData[student.student_id];
        const attType = existing?.attendance_type || 'full_day';

        const data = {
          date: selectedDate,
          class_name: selectedClass,
          section: selectedSection,
          student_id: student.student_id || student.id,
          student_name: student.name,
          attendance_type: isHoliday ? 'holiday' : attType,
          half_day_period: existing?.half_day_period || null,
          half_day_reason: existing?.half_day_reason || '',
          is_present: isHoliday ? false : (attType !== 'absent'),
          is_holiday: isHoliday,
          holiday_reason: isHoliday ? (holidayReason || 'Holiday') : '',
          marked_by: user?.email,
          academic_year: academicYear,
          status: isHoliday ? 'Holiday' : 'Taken'
        };

        if (existing?.id) {
          // Use validation function for updates (enforces lock check + audit logging)
          const response = await base44.functions.invoke('updateAttendanceWithValidation', {
            attendanceId: existing.id,
            data
          });
          return response.data;
        }

        // For CREATE: check for deduplication first
        const dedupCheck = await base44.functions.invoke('validateAttendanceCreateDedup', {
          date: selectedDate,
          studentId: student.student_id || student.id,
          classname: selectedClass,
          section: selectedSection,
          academicYear
        });

        if (dedupCheck.data?.isDuplicate) {
          // Duplicate found - update instead of create
          const response = await base44.functions.invoke('updateAttendanceWithValidation', {
            attendanceId: dedupCheck.data.existingRecordId,
            data
          });
          return response.data;
        }

        // Safe to create new record
        return base44.entities.Attendance.create(data);
      });
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['attendance']);
      toast.success(isHoliday ? 'Holiday marked successfully' : 'Attendance saved successfully');
    },
    onError: (err) => {
      if (err?.message === 'PAST_YEAR_WARNING') {
        setShowPastYearWarning(true);
      } else if (err?.response?.status === 403) {
        toast.error('❌ This record is locked. Only admin can unlock and edit.');
      } else if (err?.response?.status === 409) {
        toast.error('⚠️ Duplicate record detected. Using existing record.');
      } else {
        toast.error('Failed to save: ' + (err?.message || 'Unknown error'));
      }
    }
  });



  const saveRangeMutation = useMutation({
    mutationFn: async () => {
      if (!rangeStart || !rangeEnd) throw new Error('Select start and end dates');
      if (!academicYear) throw new Error('Academic year not configured');
      
      const days = eachDayOfInterval({ start: parseISO(rangeStart), end: parseISO(rangeEnd) });
      const total = days.length;

      // Batch create holidays (check all first, then create in one batch)
      const holidaysToCreate = [];
      for (let i = 0; i < days.length; i++) {
        const day = days[i];
        const dateStr = format(day, 'yyyy-MM-dd');

        // Check if holiday already exists
        const existingHoliday = await base44.entities.Holiday.filter({ 
          date: dateStr, 
          academic_year: academicYear 
        });

        if (existingHoliday.length === 0) {
          holidaysToCreate.push({
            date: dateStr,
            title: rangeReason || 'Holiday',
            reason: rangeReason || 'Holiday',
            marked_by: user?.email,
            academic_year: academicYear,
            status: 'Active'
          });
        }
        setRangeProgress(Math.round(((i + 1) / total) * 50));
      }

      // Batch create all new holidays in one call
      if (holidaysToCreate.length > 0) {
        await base44.entities.Holiday.bulkCreate(holidaysToCreate);
      }
      setRangeProgress(100);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast.success(`Holiday marked from ${rangeStart} to ${rangeEnd}`);
      setShowRangeMode(false);
      setRangeStart(''); setRangeEnd(''); setRangeReason(''); setRangeProgress(0);
    },
    onError: (err) => {
      toast.error('Failed to mark holiday: ' + (err?.message || 'Unknown error'));
      setRangeProgress(0);
    }
  });

  const setAttendanceType = (studentId, type, halfDayData = {}) => {
    setAttendanceData(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        attendance_type: type,
        half_day_period: halfDayData.period || null,
        half_day_reason: halfDayData.reason || '',
        is_present: type !== 'absent'
      }
    }));
  };

  const openHalfDayModal = (studentId, studentName) => {
    setHalfDayModal({ isOpen: true, studentId, studentName });
  };

  const closeHalfDayModal = () => {
    setHalfDayModal({ isOpen: false, studentId: null, studentName: null });
  };

  const handleHalfDayConfirm = (halfDayData) => {
    if (halfDayModal.studentId) {
      setAttendanceType(halfDayModal.studentId, 'half_day', halfDayData);
      closeHalfDayModal();
    }
  };

  const markAllPresent = () => {
    const data = {};
    filteredStudents.forEach(s => {
      data[s.student_id || s.id] = { ...attendanceData[s.student_id || s.id], is_present: true };
    });
    setAttendanceData(data);
  };

  const presentCount = filteredStudents.filter(s => {
    const type = attendanceData[s.student_id || s.id]?.attendance_type || 'full_day';
    return type === 'full_day' || type === 'half_day';
  }).length;
  const halfDayCount = filteredStudents.filter(s => 
    attendanceData[s.student_id || s.id]?.attendance_type === 'half_day'
  ).length;
  const absentCount = filteredStudents.filter(s => 
    attendanceData[s.student_id || s.id]?.attendance_type === 'absent'
  ).length;

  const currentStatus = existingAttendance[0]?.status || 'Not Taken';

  return (
    <LoginRequired allowedRoles={['admin', 'principal', 'teacher', 'staff']} pageName="Attendance">
      <div className="min-h-screen bg-slate-50 w-full overflow-x-hidden">
      <PageHeader 
        title="Attendance"
        subtitle="Mark and manage daily attendance"
      />

      <div className="px-3 sm:px-4 lg:px-8 py-4 space-y-6 max-w-full">
       {/* Filters */}
       <Card className="border-0 shadow-sm">
         <CardContent className="p-3 sm:p-4 space-y-3">
           <div className="flex flex-col gap-3 sm:gap-4">
             <div className="flex items-center gap-2">
               <Calendar className="h-5 w-5 text-slate-400" />
               <input
                 type="date"
                 value={selectedDate}
                 onChange={(e) => setSelectedDate(e.target.value)}
                 className="border rounded-lg px-3 py-2 text-sm"
               />
             </div>
             <Select value={selectedClass} onValueChange={setSelectedClass}>
               <SelectTrigger className="w-full sm:w-40">
                 <SelectValue placeholder="Select Class" />
               </SelectTrigger>
               <SelectContent>
                 {CLASSES.map(c => (
                   <SelectItem key={c} value={c}>Class {c}</SelectItem>
                 ))}
               </SelectContent>
             </Select>
             <Select value={selectedSection} onValueChange={setSelectedSection}>
               <SelectTrigger className="w-full sm:w-40">
                 <SelectValue placeholder="Select Section" />
               </SelectTrigger>
               <SelectContent>
                 {SECTIONS.map(s => (
                   <SelectItem key={s} value={s}>Section {s}</SelectItem>
                 ))}
               </SelectContent>
             </Select>
           </div>

           {/* Holiday Status Display */}
           {selectedClass && selectedSection && (
             <HolidayStatusDisplay 
               isHoliday={isHoliday} 
               isSunday={isSunday} 
               hasOverride={hasHolidayOverride}
               holidayReason={holidayReason}
             />
           )}

           {/* Holiday Override Toggle */}
           {isHoliday && canOverrideHoliday && selectedClass && selectedSection && (
             <HolidayOverrideToggle 
               selectedDate={selectedDate}
               canOverride={canOverrideHoliday}
               user={user}
               academicYear={academicYear}
               onOverrideChange={setHasHolidayOverride}
             />
           )}

            {/* Holiday Toggle - Admin Only */}
            {canManageHolidays && (
              <div className={`flex flex-col sm:flex-row sm:flex-wrap items-start sm:items-center gap-2 sm:gap-3 pt-2 border-t ${isHoliday ? 'text-amber-600' : 'text-slate-500'}`}>
                <Palmtree className="h-4 w-4 flex-shrink-0" />
                <span className="text-sm font-medium flex-1">
                  {isSunday ? '🔴 Sunday — Auto Holiday' : isMarkedHoliday ? `📌 Marked Holiday: ${holidays[0]?.title || 'Holiday'}` : 'Mark as Holiday'}
                </span>
                {isHoliday && !isMarkedHoliday && (
                  <input
                    type="text"
                    placeholder="Holiday reason (e.g. Diwali)"
                    value={holidayReason}
                    onChange={e => setHolidayReason(e.target.value)}
                    className="border rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[160px]"
                  />
                )}
                {!isMarkedHoliday && !isSunday && (
                  <button
                    onClick={() => { 
                      setIsHoliday(!isHoliday); 
                      setManuallyChanged(true);
                      if (isHoliday) setHolidayReason(''); 
                      else setHolidayReason(''); 
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${isHoliday ? 'bg-amber-500' : 'bg-gray-300'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isHoliday ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                )}
              </div>
            )}

            {/* Show Holiday Info for Teachers */}
            {!canManageHolidays && (isHoliday || isSunday) && (
              <div className="pt-2 border-t text-amber-600">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Palmtree className="h-4 w-4" />
                  {isSunday ? '🔴 Sunday — Auto Holiday' : `📌 Marked Holiday: ${holidayReason}`}
                </div>
              </div>
            )}

            {/* Holiday Range - Admin Only */}
            {canManageHolidays && (
              <div className="pt-2 border-t">
                <button
                  onClick={() => setShowRangeMode(!showRangeMode)}
                  className="flex items-center gap-2 text-sm text-slate-500 hover:text-amber-600 transition-colors"
                >
                  <CalendarRange className="h-4 w-4" />
                  <span>Mark Holiday Range (multiple days)</span>
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full ml-1">Admin</span>
                </button>
                {showRangeMode && (
                  <div className="mt-3 p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-3">
                    <p className="text-xs text-amber-700 font-medium">This will mark ALL classes as holiday for the selected date range.</p>
                    <div className="flex flex-wrap gap-3 items-center">
                      <div className="flex items-center gap-1.5">
                        <label className="text-xs text-slate-600">From</label>
                        <input type="date" value={rangeStart} onChange={e => setRangeStart(e.target.value)}
                          className="border rounded-lg px-2 py-1.5 text-sm" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <label className="text-xs text-slate-600">To</label>
                        <input type="date" value={rangeEnd} onChange={e => setRangeEnd(e.target.value)}
                          className="border rounded-lg px-2 py-1.5 text-sm" />
                      </div>
                      <input
                        type="text"
                        placeholder="Reason (e.g. Summer Vacation)"
                        value={rangeReason}
                        onChange={e => setRangeReason(e.target.value)}
                        className="border rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[160px]"
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        size="sm"
                        className="bg-amber-500 hover:bg-amber-600 text-white"
                        onClick={() => saveRangeMutation.mutate()}
                        disabled={!rangeStart || !rangeEnd || saveRangeMutation.isPending}
                      >
                        <Palmtree className="h-4 w-4 mr-1" />
                        {saveRangeMutation.isPending ? `Marking... ${rangeProgress}%` : 'Mark Holiday Range'}
                      </Button>
                      {saveRangeMutation.isPending && (
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-amber-500 h-2 rounded-full transition-all"
                            style={{ width: `${rangeProgress}%` }}
                          />
                        </div>
                      )}
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
            {/* Holiday Block Message */}
            {isHoliday && !hasHolidayOverride && (
              <Card className="border-l-4 border-l-amber-500 bg-amber-50">
                <CardContent className="p-4">
                  <p className="text-sm text-amber-900 font-medium">👉 Attendance is disabled due to holiday</p>
                  <p className="text-xs text-amber-700 mt-1">Contact admin to enable attendance for this day</p>
                </CardContent>
              </Card>
            )}

            {/* Locked Record Message */}
            {isRecordLocked && (
              <Card className="border-l-4 border-l-red-500 bg-red-50">
                <CardContent className="p-4">
                  <p className="text-sm text-red-900 font-medium">🔒 Attendance Locked</p>
                  <p className="text-xs text-red-700 mt-1">This record was auto-locked at {lockedAtTime}. Only admin can unlock and edit.</p>
                </CardContent>
              </Card>
            )}

            {/* Stats */}
             <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-4">
              <Card className="border-0 shadow-sm p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center">
                    <Users className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Total</p>
                    <p className="text-xl font-bold">{filteredStudents.length}</p>
                  </div>
                </div>
              </Card>
              <Card className="border-0 shadow-sm p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-green-50 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Present</p>
                    <p className="text-xl font-bold text-green-600">{presentCount - halfDayCount}</p>
                  </div>
                </div>
              </Card>
              <Card className="border-0 shadow-sm p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-yellow-50 flex items-center justify-center">
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Half Day</p>
                    <p className="text-xl font-bold text-yellow-600">{halfDayCount}</p>
                  </div>
                </div>
              </Card>
              <Card className="border-0 shadow-sm p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center">
                    <XCircle className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Absent</p>
                    <p className="text-xl font-bold text-red-600">{absentCount}</p>
                  </div>
                </div>
              </Card>
              <Card className="border-0 shadow-sm p-4">
                <div className="flex items-center gap-3">
                  <div className="text-sm text-slate-500">Status</div>
                  <StatusBadge status={currentStatus} />
                </div>
              </Card>
            </div>

            {/* Student List */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4">
                <CardTitle className="text-base sm:text-lg">
                  Class {selectedClass}-{selectedSection}
                  {isHoliday && <span className="ml-2 text-xs sm:text-sm font-normal text-amber-600">🌴 Holiday</span>}
                </CardTitle>
                {!isHoliday && (
                  <Button variant="outline" size="sm" onClick={markAllPresent} className="w-full sm:w-auto text-xs sm:text-sm">
                    Mark All Present
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {isHoliday ? (
                  <div className="py-12 text-center text-amber-500">
                    <Palmtree className="h-10 w-10 mx-auto mb-3 opacity-60" />
                    <p className="font-medium text-slate-700">Holiday: {holidayReason || 'Holiday'}</p>
                    <p className="text-sm text-slate-400 mt-1">All {filteredStudents.length} students will be marked as holiday</p>
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <div className="py-12 text-center text-slate-400">
                    No published students found in this class
                  </div>
                ) : (
                  <div className="divide-y">
                        {filteredStudents.map((student, index) => {
                          const attType = attendanceData[student.student_id || student.id]?.attendance_type || 'full_day';
                          const attendanceDisabled = (isHoliday && !hasHolidayOverride) || isRecordLocked;
                          const bgColor = attType === 'absent' ? 'bg-red-50' : attType === 'half_day' ? 'bg-yellow-50' : 'bg-white';

                          return (
                            <div 
                                key={student.id}
                                className={`flex items-center gap-2 sm:gap-4 p-3 sm:p-4 transition-colors ${
                                  attendanceDisabled ? 'bg-slate-50 opacity-60' : bgColor
                                }`}
                              >
                            <span className="text-xs sm:text-sm text-slate-400 w-6 sm:w-8 flex-shrink-0">
                              {student.roll_no || index + 1}
                            </span>
                            <Avatar className="h-8 sm:h-10 w-8 sm:w-10 flex-shrink-0">
                              <AvatarImage src={student.photo_url} />
                              <AvatarFallback className="bg-blue-100 text-blue-700 text-xs sm:text-sm">
                                {student.name?.[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-900 truncate text-sm">{student.name}</p>
                              <p className="text-xs text-slate-500">{student.student_id}</p>
                              {attType === 'half_day' && attendanceData[student.student_id || student.id]?.half_day_period && (
                                <p className="text-xs text-yellow-700 mt-0.5">
                                  🕐 {attendanceData[student.student_id || student.id]?.half_day_period === 'morning' ? 'Absent Afternoon' : 'Absent Morning'}
                                  {attendanceData[student.student_id || student.id]?.half_day_reason && ` - ${attendanceData[student.student_id || student.id]?.half_day_reason}`}
                                </p>
                              )}
                            </div>
                            <div className="flex gap-1 sm:gap-2 flex-shrink-0">
                            <Button
                              size="sm"
                              variant={attType === 'full_day' ? 'default' : 'outline'}
                              className={attType === 'full_day' ? 'bg-green-600 hover:bg-green-700' : ''}
                              onClick={() => setAttendanceType(student.student_id || student.id, 'full_day')}
                              disabled={attendanceDisabled}
                              title="Full Day"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant={attType === 'half_day' ? 'default' : 'outline'}
                              className={attType === 'half_day' ? 'bg-yellow-600 hover:bg-yellow-700' : ''}
                              onClick={() => openHalfDayModal(student.student_id || student.id, student.name)}
                              disabled={attendanceDisabled}
                              title="Half Day"
                            >
                              <AlertCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant={attType === 'absent' ? 'default' : 'outline'}
                              className={attType === 'absent' ? 'bg-red-600 hover:bg-red-700' : ''}
                              onClick={() => setAttendanceType(student.student_id || student.id, 'absent')}
                              disabled={attendanceDisabled}
                              title="Absent"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

              </CardContent>
            </Card>

            {/* Action Buttons */}
            {(filteredStudents.length > 0 || isHoliday) && (
              <div className="flex justify-end gap-2">
                {isHoliday && !hasHolidayOverride ? (
                  <Button disabled className="opacity-50 cursor-not-allowed text-xs sm:text-sm">
                    <Palmtree className="mr-1 sm:mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">Attendance Disabled (Holiday)</span>
                    <span className="sm:hidden">Holiday</span>
                  </Button>
                ) : isRecordLocked ? (
                  <Button disabled className="opacity-50 cursor-not-allowed text-xs sm:text-sm">
                    <Lock className="mr-1 sm:mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">Record Locked (Admin Only)</span>
                    <span className="sm:hidden">Locked</span>
                  </Button>
                ) : (
                  <Button 
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    size="sm"
                    className="text-xs sm:text-sm"
                  >
                    <Save className="mr-1 sm:mr-2 h-4 w-4" />
                    {saveMutation.isPending ? 'Saving...' : <span className="hidden sm:inline">Save Attendance</span> || 'Save'}
                  </Button>
                )}
              </div>
            )}
          </>
        )}

        {!selectedClass || !selectedSection ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="py-16 text-center">
              <Calendar className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-slate-700">Select Class & Section</h3>
              <p className="text-slate-500 mt-2">Choose a class and section to mark attendance</p>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <HalfDayModal
        isOpen={halfDayModal.isOpen}
        onClose={closeHalfDayModal}
        onConfirm={handleHalfDayConfirm}
        studentName={halfDayModal.studentName}
      />

      {/* Past Year Warning */}
      <PastYearWarning
        open={showPastYearWarning}
        academicYear={academicYear}
        onConfirm={() => {
          setShowPastYearWarning(false);
          saveMutation.mutate();
        }}
        onCancel={() => setShowPastYearWarning(false)}
      />
      </div>
      </LoginRequired>
      );
      }