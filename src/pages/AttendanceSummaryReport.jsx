import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getStaffSession } from '@/components/useStaffSession';
import { useAcademicYear } from '@/components/AcademicYearContext';
import LoginRequired from '@/components/LoginRequired';
import PageHeader from '@/components/ui/PageHeader';
import FilterSection from '@/components/attendanceSummary/FilterSection';
import SummaryCards from '@/components/attendanceSummary/SummaryCards';
import ReportTable from '@/components/attendanceSummary/ReportTable';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from 'lucide-react';
import { format } from 'date-fns';

const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

export default function AttendanceSummaryReport() {
  const { academicYear } = useAcademicYear();
  const [user, setUser] = useState(null);
  const [filters, setFilters] = useState({
    class: '',
    section: 'A',
    fromDate: '',
    toDate: ''
  });
  const [hasGenerated, setHasGenerated] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name'); // 'name', 'attendance-asc', 'attendance-desc'

  React.useEffect(() => {
    setUser(getStaffSession());
  }, []);

  // Fetch staff account for teacher class restrictions
  const { data: staffAccount } = useQuery({
    queryKey: ['staff-account', user?.email],
    queryFn: () => base44.entities.StaffAccount.filter({ email: user?.email }),
    enabled: !!user?.email
  });

  // Fetch students
  const { data: students = [] } = useQuery({
    queryKey: ['students-published', filters.class, filters.section, academicYear],
    queryFn: () => base44.entities.Student.filter({
      status: 'Published',
      class_name: filters.class,
      section: filters.section,
      academic_year: academicYear
    }),
    enabled: hasGenerated && !!filters.class && !!filters.section
  });

  // Fetch attendance records
  const { data: attendanceRecords = [] } = useQuery({
    queryKey: ['attendance-range', filters.class, filters.section, filters.fromDate, filters.toDate, academicYear],
    queryFn: () => base44.entities.Attendance.filter({
      class_name: filters.class,
      section: filters.section,
      academic_year: academicYear
    }).then(all => all.filter(a => {
      if (!filters.fromDate || !filters.toDate) return false;
      return a.date >= filters.fromDate && a.date <= filters.toDate;
    })),
    enabled: hasGenerated && !!filters.class && !!filters.fromDate && !!filters.toDate
  });

  // Fetch holidays
  const { data: holidays = [] } = useQuery({
    queryKey: ['holidays-range', filters.fromDate, filters.toDate, academicYear],
    queryFn: () => base44.entities.Holiday.filter({
      status: 'Active',
      academic_year: academicYear
    }).then(all => all.filter(h => {
      if (!filters.fromDate || !filters.toDate) return false;
      return h.date >= filters.fromDate && h.date <= filters.toDate;
    })),
    enabled: hasGenerated && !!filters.fromDate && !!filters.toDate
  });

  const isAdmin = user?.role === 'admin' || user?.role === 'Admin';
  const canAccessClass = isAdmin || staffAccount?.[0]?.classes_assigned?.includes(filters.class);

  // Check permissions
  if (hasGenerated && !isAdmin && !canAccessClass) {
    return (
      <LoginRequired allowedRoles={['admin', 'principal', 'teacher']} pageName="AttendanceSummaryReport">
        <div className="min-h-screen bg-slate-50">
          <PageHeader title="Attendance Summary Report" subtitle="View and analyze student attendance" />
          <div className="p-4 lg:p-8">
            <Card className="border-l-4 border-l-red-500 bg-red-50">
              <CardContent className="p-4">
                <p className="text-sm text-red-900 font-medium">You don't have permission to view reports for this class.</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </LoginRequired>
    );
  }

  // Calculate report data
  const reportData = useMemo(() => {
    if (!hasGenerated || students.length === 0) return [];

    const daysBetween = [];
    const current = new Date(filters.fromDate);
    const end = new Date(filters.toDate);
    while (current <= end) {
      daysBetween.push(format(current, 'yyyy-MM-dd'));
      current.setDate(current.getDate() + 1);
    }

    const holidaySet = new Set(holidays.map(h => h.date));
    const sundaySet = new Set();
    daysBetween.forEach(d => {
      if (new Date(d + 'T00:00:00').getDay() === 0) sundaySet.add(d);
    });

    const workingDays = daysBetween.filter(d => !holidaySet.has(d) && !sundaySet.has(d)).length;

    return students.map(student => {
      const studentAttendance = attendanceRecords.filter(a => a.student_id === student.student_id || a.student_id === student.id);
      const presentDays = studentAttendance.filter(a => a.is_present && !a.is_holiday).length;
      const absentDays = studentAttendance.filter(a => !a.is_present && !a.is_holiday).length;
      const attendancePercent = workingDays > 0 ? ((presentDays / workingDays) * 100).toFixed(2) : 0;

      return {
        id: student.id,
        student_id: student.student_id,
        name: student.name,
        rollNo: student.roll_no || '-',
        class: student.class_name,
        section: student.section,
        totalWorkingDays: workingDays,
        totalHolidays: daysBetween.filter(d => holidaySet.has(d)).length,
        presentDays,
        absentDays,
        attendancePercent: parseFloat(attendancePercent)
      };
    });
  }, [students, attendanceRecords, holidays, filters.fromDate, filters.toDate, hasGenerated]);

  // Filter and sort
  const filteredData = useMemo(() => {
    let data = reportData.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (sortBy === 'attendance-asc') {
      data.sort((a, b) => a.attendancePercent - b.attendancePercent);
    } else if (sortBy === 'attendance-desc') {
      data.sort((a, b) => b.attendancePercent - a.attendancePercent);
    } else {
      data.sort((a, b) => a.name.localeCompare(b.name));
    }
    
    return data;
  }, [reportData, searchTerm, sortBy]);

  const avgAttendance = filteredData.length > 0
    ? (filteredData.reduce((sum, s) => sum + s.attendancePercent, 0) / filteredData.length).toFixed(2)
    : 0;

  return (
    <LoginRequired allowedRoles={['admin', 'principal', 'teacher']} pageName="AttendanceSummaryReport">
      <div className="min-h-screen bg-slate-50">
        <PageHeader 
          title="Attendance Summary Report"
          subtitle="View and analyze student attendance for a date range"
        />

        <div className="p-4 lg:p-8 space-y-6">
          <FilterSection 
            filters={filters} 
            setFilters={setFilters} 
            onGenerate={() => setHasGenerated(true)}
            classes={CLASSES}
          />

          {hasGenerated && (
            <>
              <SummaryCards 
                totalStudents={students.length}
                avgAttendance={avgAttendance}
                workingDays={reportData[0]?.totalWorkingDays || 0}
              />

              <ReportTable 
                data={filteredData}
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                sortBy={sortBy}
                setSortBy={setSortBy}
                fromDate={filters.fromDate}
                toDate={filters.toDate}
              />
            </>
          )}

          {hasGenerated && students.length === 0 && (
            <Card className="border-0 shadow-sm">
              <CardContent className="py-16 text-center">
                <Calendar className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-700">No students found</h3>
                <p className="text-slate-500 mt-2">Try selecting a different class or section</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </LoginRequired>
  );
}