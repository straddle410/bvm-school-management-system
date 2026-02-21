import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import LoginRequired from '@/components/LoginRequired';
import { getStaffSession } from '@/components/useStaffSession';
import { useAcademicYear } from '@/components/AcademicYearContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
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
  Calendar, CheckCircle2, XCircle, Users, Save, Palmtree, CalendarRange
} from 'lucide-react';
import { format, getDay, eachDayOfInterval, parseISO } from 'date-fns';
import { toast } from "sonner";

const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
const SECTIONS = ['A'];

export default function Attendance() {
  const { academicYear } = useAcademicYear();
  const [user, setUser] = useState(null);
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

  const queryClient = useQueryClient();

  // Auto-detect Sunday
  const isSunday = getDay(new Date(selectedDate + 'T00:00:00')) === 0;

  useEffect(() => {
    setUser(getStaffSession());
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

  useEffect(() => {
    if (existingAttendance.length > 0) {
      const data = {};
      existingAttendance.forEach(a => {
        data[a.student_id] = { is_present: a.is_present, id: a.id, status: a.status };
      });
      setAttendanceData(data);
      // Check if already marked as holiday
      const holidayRecord = existingAttendance.find(a => a.is_holiday);
      if (holidayRecord) {
        setIsHoliday(true);
        setHolidayReason(holidayRecord.holiday_reason || '');
      } else {
        setIsHoliday(isSunday);
        setHolidayReason(isSunday ? 'Sunday' : '');
      }
    } else {
      setAttendanceData({});
      setIsHoliday(isSunday);
      setHolidayReason(isSunday ? 'Sunday' : '');
    }
  }, [existingAttendance, isSunday]);

  const filteredStudents = students.filter(s => 
    s.class_name === selectedClass && s.section === selectedSection
  ).sort((a, b) => (a.roll_no || 0) - (b.roll_no || 0));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const promises = filteredStudents.map(student => {
        const existing = attendanceData[student.student_id];
        const data = {
          date: selectedDate,
          class_name: selectedClass,
          section: selectedSection,
          student_id: student.student_id || student.id,
          student_name: student.name,
          is_present: isHoliday ? false : (existing?.is_present !== false),
          is_holiday: isHoliday,
          holiday_reason: isHoliday ? (holidayReason || 'Holiday') : '',
          marked_by: user?.email,
          academic_year: academicYear,
          status: isHoliday ? 'Holiday' : 'Taken'
        };
        
        if (existing?.id) {
          return base44.entities.Attendance.update(existing.id, data);
        }
        return base44.entities.Attendance.create(data);
      });
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['attendance']);
      toast.success(isHoliday ? 'Holiday marked successfully' : 'Attendance saved successfully');
    }
  });



  const saveRangeMutation = useMutation({
    mutationFn: async () => {
      if (!rangeStart || !rangeEnd) throw new Error('Select start and end dates');
      const days = eachDayOfInterval({ start: parseISO(rangeStart), end: parseISO(rangeEnd) });
      const total = days.length;
      
      // Batch by day to avoid rate limiting
      for (let i = 0; i < days.length; i++) {
        const day = days[i];
        const dateStr = format(day, 'yyyy-MM-dd');
        
        // Create/update a single holiday marker record instead of per-student
        const holidayMarker = await base44.entities.Attendance.filter({ 
          date: dateStr, 
          is_holiday: true,
          academic_year: academicYear 
        });
        
        if (holidayMarker.length === 0) {
          // Create one marker record for the day
          await base44.entities.Attendance.create({
            date: dateStr,
            class_name: 'All',
            section: 'A',
            student_id: 'HOLIDAY_MARKER',
            student_name: 'Holiday',
            is_present: false,
            is_holiday: true,
            holiday_reason: rangeReason || 'Holiday',
            marked_by: user?.email,
            academic_year: academicYear,
            status: 'Holiday'
          });
        }
        setRangeProgress(Math.round(((i + 1) / total) * 100));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['attendance']);
      queryClient.invalidateQueries(['attendance-holidays']);
      toast.success(`Holiday marked from ${rangeStart} to ${rangeEnd}`);
      setShowRangeMode(false);
      setRangeStart(''); setRangeEnd(''); setRangeReason(''); setRangeProgress(0);
    },
    onError: (err) => {
      toast.error('Failed to mark holiday: ' + (err?.message || 'Unknown error'));
      setRangeProgress(0);
    }
  });

  const toggleAttendance = (studentId, isPresent) => {
    setAttendanceData(prev => ({
      ...prev,
      [studentId]: { ...prev[studentId], is_present: isPresent }
    }));
  };

  const markAllPresent = () => {
    const data = {};
    filteredStudents.forEach(s => {
      data[s.student_id || s.id] = { ...attendanceData[s.student_id || s.id], is_present: true };
    });
    setAttendanceData(data);
  };

  const presentCount = filteredStudents.filter(s => 
    attendanceData[s.student_id || s.id]?.is_present !== false
  ).length;
  const absentCount = filteredStudents.length - presentCount;

  const currentStatus = existingAttendance[0]?.status || 'Not Taken';

  return (
    <LoginRequired allowedRoles={['admin', 'principal', 'teacher', 'staff']} pageName="Attendance">
      <div className="min-h-screen bg-slate-50">
      <PageHeader 
        title="Attendance"
        subtitle="Mark and manage daily attendance"
      />

      <div className="p-4 lg:p-8 space-y-6">
        {/* Filters */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-4">
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

            {/* Holiday Toggle - single day */}
            <div className={`flex flex-wrap items-center gap-3 pt-2 border-t ${isHoliday ? 'text-amber-600' : 'text-slate-500'}`}>
              <Palmtree className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm font-medium flex-1">
                {isSunday ? '🔴 Sunday — Auto Holiday' : 'Mark as Holiday'}
              </span>
              {isHoliday && (
                <input
                  type="text"
                  placeholder="Holiday reason (e.g. Diwali)"
                  value={holidayReason}
                  onChange={e => setHolidayReason(e.target.value)}
                  className="border rounded-lg px-3 py-1.5 text-sm flex-1 min-w-[160px]"
                />
              )}
              <button
                onClick={() => { 
                  setIsHoliday(!isHoliday); 
                  if (isHoliday) setHolidayReason(''); 
                  else setHolidayReason(isSunday ? 'Sunday' : ''); 
                }}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${isHoliday ? 'bg-amber-500' : 'bg-gray-300'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isHoliday ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>

            {/* Holiday Range - multiple days */}
            <div className="pt-2 border-t">
              <button
                onClick={() => setShowRangeMode(!showRangeMode)}
                className="flex items-center gap-2 text-sm text-slate-500 hover:text-amber-600 transition-colors"
              >
                <CalendarRange className="h-4 w-4" />
                <span>Mark Holiday Range (multiple days)</span>
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full ml-1">New</span>
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
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="bg-amber-500 hover:bg-amber-600 text-white"
                      onClick={() => saveRangeMutation.mutate()}
                      disabled={!rangeStart || !rangeEnd || saveRangeMutation.isPending}
                    >
                      <Palmtree className="h-4 w-4 mr-1" />
                      {saveRangeMutation.isPending ? 'Marking...' : 'Mark Holiday Range'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowRangeMode(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {selectedClass && selectedSection && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
                    <p className="text-xl font-bold text-green-600">{presentCount}</p>
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
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <CardTitle className="text-lg">
                  Class {selectedClass}-{selectedSection}
                  {isHoliday && <span className="ml-2 text-sm font-normal text-amber-600">🌴 Holiday</span>}
                </CardTitle>
                {!isHoliday && (
                  <Button variant="outline" size="sm" onClick={markAllPresent}>
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
                      const isPresent = attendanceData[student.student_id || student.id]?.is_present !== false;
                      return (
                        <div 
                          key={student.id}
                          className={`flex items-center gap-4 p-4 transition-colors ${
                            isPresent ? 'bg-white' : 'bg-red-50'
                          }`}
                        >
                          <span className="text-sm text-slate-400 w-8">
                            {student.roll_no || index + 1}
                          </span>
                          <Avatar className="h-10 w-10">
                            <AvatarImage src={student.photo_url} />
                            <AvatarFallback className="bg-blue-100 text-blue-700">
                              {student.name?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 truncate">{student.name}</p>
                            <p className="text-sm text-slate-500">{student.student_id}</p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant={isPresent ? 'default' : 'outline'}
                              className={isPresent ? 'bg-green-600 hover:bg-green-700' : ''}
                              onClick={() => toggleAttendance(student.student_id || student.id, true)}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant={!isPresent ? 'default' : 'outline'}
                              className={!isPresent ? 'bg-red-600 hover:bg-red-700' : ''}
                              onClick={() => toggleAttendance(student.student_id || student.id, false)}
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
              <div className="flex justify-end">
                <Button 
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {saveMutation.isPending ? 'Saving...' : 'Save Attendance'}
                </Button>
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
    </div>
    </LoginRequired>
  );
}