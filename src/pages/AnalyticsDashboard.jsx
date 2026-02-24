import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Filter } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import AttendanceAnalytics from '@/components/analytics/AttendanceAnalytics.jsx';
import PerformanceAnalytics from '@/components/analytics/PerformanceAnalytics.jsx';
import StudentAnalyticsModal from '@/components/analytics/StudentAnalyticsModal.jsx';

export default function AnalyticsDashboard() {
  const [user, setUser] = useState(null);
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [academicYear, setAcademicYear] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const isAuth = await base44.auth.isAuthenticated();
        if (!isAuth) {
          base44.auth.redirectToLogin(createPageUrl('AnalyticsDashboard'));
          return;
        }
        const u = await base44.auth.me();
        console.log('User:', u, 'Role:', u?.role);
        setUser(u);
      } catch (err) {
        console.log('Auth error:', err);
        base44.auth.redirectToLogin(createPageUrl('AnalyticsDashboard'));
      }
    };
    checkAuth();
  }, []);

  // Get current academic year
  const { data: academicYears } = useQuery({
    queryKey: ['academicYears'],
    queryFn: async () => {
      const years = await base44.entities.AcademicYear.filter({ is_current: true });
      if (years.length === 0) {
        const allYears = await base44.entities.AcademicYear.list();
        return allYears.length > 0 ? allYears[0] : { year: '2024-25' };
      }
      return years[0];
    },
  });

  useEffect(() => {
    if (academicYears?.year) setAcademicYear(academicYears.year);
  }, [academicYears]);

  // Get classes and subjects for filters
  const { data: classes = [] } = useQuery({
    queryKey: ['classes'],
    queryFn: async () => {
      const students = await base44.entities.Student.list();
      return [...new Set(students.map(s => s.class_name))].sort();
    },
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => base44.entities.Subject.list(),
    select: (data) => data.map(s => s.name).sort(),
  });

  const isAdmin = user?.role === 'admin' || user?.role === 'Admin';
  const isTeacher = user?.role === 'teacher' || user?.role === 'Teacher';
  const isPrincipal = user?.role === 'Principal' || user?.role === 'principal';
  const hasAccess = isAdmin || isPrincipal || isTeacher || user?.role === 'Admin' || user?.role === 'Principal';

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-[#f0f4ff] flex items-center justify-center max-w-md mx-auto">
        <div className="text-center">
          <p className="text-gray-600">You don't have access to Analytics</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f4ff] max-w-md mx-auto pb-10">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1a237e] via-[#283593] to-[#3949ab] text-white px-4 py-4 sticky top-0 z-40 shadow">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => window.history.back()} className="hover:opacity-80">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-bold">Analytics Dashboard</h1>
        </div>

        {/* Filters */}
        <div className="space-y-2">
          {isAdmin || isPrincipal ? (
            <>
              <div>
                <label className="text-xs text-white/70 block mb-1">Class</label>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger className="h-8 text-xs bg-white/10 border-white/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Classes</SelectItem>
                    {classes.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-white/70 block mb-1">Subject</label>
                <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                  <SelectTrigger className="h-8 text-xs bg-white/10 border-white/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Subjects</SelectItem>
                    {subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : (
            <p className="text-xs text-white/70">Academic Year: {academicYear}</p>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-6 space-y-6">
        {/* Attendance Analytics */}
        <AttendanceAnalytics 
          classFilter={selectedClass} 
          academicYear={academicYear}
        />

        {/* Performance Analytics */}
        <PerformanceAnalytics 
          classFilter={selectedClass}
          subjectFilter={selectedSubject}
          academicYear={academicYear}
        />

        {/* Student-wise Reports */}
        {(isAdmin || isPrincipal) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Student-wise Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-gray-500 mb-3">Click on a student card to view detailed analytics</p>
              <StudentAnalyticsModal 
                classFilter={selectedClass}
                academicYear={academicYear}
              />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Student Details Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full max-w-md rounded-t-2xl p-4 max-h-[80vh] overflow-y-auto">
            <button 
              onClick={() => setSelectedStudent(null)}
              className="float-right text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
            <h2 className="text-lg font-bold mb-4">{selectedStudent.name}</h2>
            <div className="space-y-3 text-sm">
              <div><span className="text-gray-600">Class:</span> {selectedStudent.class_name}-{selectedStudent.section}</div>
              <div><span className="text-gray-600">Roll No:</span> {selectedStudent.roll_no}</div>
              <div><span className="text-gray-600">Attendance:</span> {selectedStudent.attendance}%</div>
              <div><span className="text-gray-600">Avg Marks:</span> {selectedStudent.avgMarks?.toFixed(2)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}