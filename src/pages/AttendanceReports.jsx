import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { getStaffSession } from '@/components/useStaffSession';
import { useAcademicYear } from '@/components/AcademicYearContext';
import { useQuery } from '@tanstack/react-query';
import LoginRequired from '@/components/LoginRequired';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Users, CheckCircle2, AlertCircle } from 'lucide-react';
import { format, parseISO, eachDayOfInterval, getDay } from 'date-fns';
import { getClassesForYear } from '@/components/classSectionHelper';

export default function AttendanceReports() {
  const { academicYear } = useAcademicYear();
  const [user, setUser] = useState(null);
  const [reportData, setReportData] = useState({
    totalDays: 0,
    totalHolidays: 0,
    totalWorkingDays: 0,
    classWiseAttendance: {}
  });

  useEffect(() => {
    setUser(getStaffSession());
  }, []);

  const { data: holidays = [] } = useQuery({
    queryKey: ['holidays-report', academicYear],
    queryFn: () => base44.entities.Holiday.filter({ academic_year: academicYear, status: 'Active' })
  });

  const { data: overrides = [] } = useQuery({
    queryKey: ['overrides', academicYear],
    queryFn: () => base44.entities.HolidayOverride.filter({ academic_year: academicYear })
  });

  const { data: students = [] } = useQuery({
    queryKey: ['students-report', academicYear],
    queryFn: () => base44.entities.Student.filter({ status: 'Published', academic_year: academicYear })
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ['attendance-report', academicYear],
    queryFn: () => base44.entities.Attendance.filter({ academic_year: academicYear })
  });

  // Calculate reports
  useEffect(() => {
    if (!holidays.length || !students.length) return;

    const holidayDates = new Set(holidays.map(h => h.date));
    const overrideDates = new Set(overrides.map(o => o.date));

    // Get academic year dates from AcademicYear entity
    const calculateStats = async () => {
      try {
        const years = await base44.entities.AcademicYear.filter({ year: academicYear });
        if (!years.length) return;

        const year = years[0];
        const startDate = parseISO(year.start_date);
        const endDate = parseISO(year.end_date);

        // Count total days
        const allDays = eachDayOfInterval({ start: startDate, end: endDate });
        let totalHolidayCount = 0;
        let totalWorkingCount = 0;

        allDays.forEach(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const isSunday = getDay(day) === 0;
          const isHoliday = holidayDates.has(dateStr);
          const hasOverride = overrideDates.has(dateStr);

          if ((isHoliday || isSunday) && !hasOverride) {
            totalHolidayCount++;
          } else {
            totalWorkingCount++;
          }
        });

        // Calculate class-wise attendance % — use classes derived from actual student data
        const activeClasses = [...new Set(students.map(s => s.class_name))];
        const classWiseData = {};
        activeClasses.forEach(cls => {
          const classStudents = students.filter(s => s.class_name === cls);
          const classAttendance = attendance.filter(a => a.class_name === cls);

          if (classStudents.length > 0) {
            const totalRecords = classAttendance.length;
            const presentRecords = classAttendance.filter(a => a.is_present).length;
            const percentage = totalRecords > 0 ? Math.round((presentRecords / totalRecords) * 100) : 0;

            classWiseData[cls] = {
              studentCount: classStudents.length,
              attendancePercentage: percentage,
              totalRecords
            };
          }
        });

        setReportData({
          totalDays: allDays.length,
          totalHolidays: totalHolidayCount,
          totalWorkingDays: totalWorkingCount,
          classWiseAttendance: classWiseData
        });
      } catch (err) {
        console.error('Error calculating stats:', err);
      }
    };

    calculateStats();
  }, [holidays, overrides, students, attendance, academicYear]);

  return (
    <LoginRequired allowedRoles={['admin', 'principal']}>
      <div className="min-h-screen bg-slate-50">
        <PageHeader title="Attendance Reports" subtitle="View working days, holidays, and attendance analytics" />
        
        <div className="p-4 lg:p-8 space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <p className="text-sm text-slate-500 mb-1">Total Days</p>
                <p className="text-2xl font-bold text-slate-900">{reportData.totalDays}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <p className="text-sm text-slate-500 mb-1">Working Days</p>
                <p className="text-2xl font-bold text-green-600">{reportData.totalWorkingDays}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <p className="text-sm text-slate-500 mb-1">Holidays</p>
                <p className="text-2xl font-bold text-amber-600">{reportData.totalHolidays}</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <p className="text-sm text-slate-500 mb-1">Total Students</p>
                <p className="text-2xl font-bold text-blue-600">{students.length}</p>
              </CardContent>
            </Card>
          </div>

          {/* Class-wise Attendance */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle>Class-wise Attendance %</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.keys(reportData.classWiseAttendance).map(cls => {
                  const data = reportData.classWiseAttendance[cls];
                  if (!data) return null;

                  return (
                    <div key={cls} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">Class {cls}</p>
                        <p className="text-sm text-slate-500">{data.studentCount} students • {data.totalRecords} records</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-32 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-green-500 h-2 rounded-full"
                            style={{ width: `${data.attendancePercentage}%` }}
                          />
                        </div>
                        <span className="font-bold text-slate-900 text-right w-10">{data.attendancePercentage}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Holiday List */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle>Marked Holidays</CardTitle>
            </CardHeader>
            <CardContent>
              {holidays.length === 0 ? (
                <p className="text-sm text-slate-500">No holidays marked</p>
              ) : (
                <div className="space-y-2">
                  {holidays.map((holiday) => (
                    <div key={holiday.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div>
                        <p className="font-medium text-slate-900">{holiday.title}</p>
                        <p className="text-sm text-slate-500">{format(parseISO(holiday.date), 'MMM dd, yyyy')}</p>
                      </div>
                      <span className="text-sm text-amber-600 font-medium">Holiday</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Overrides */}
          {overrides.length > 0 && (
            <Card className="border-0 shadow-sm border-l-4 border-l-blue-500">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-blue-600" />
                  Holiday Overrides Applied
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {overrides.map((override) => (
                    <div key={override.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <div>
                        <p className="font-medium text-slate-900">Override by {override.user_id}</p>
                        <p className="text-sm text-slate-500">{format(parseISO(override.date), 'MMM dd, yyyy')} • {override.reason}</p>
                      </div>
                      <span className="text-sm text-blue-600 font-medium">Attendance Allowed</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </LoginRequired>
  );
}