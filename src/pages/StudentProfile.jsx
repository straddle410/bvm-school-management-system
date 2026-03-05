import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, User, Phone, Award, TrendingUp, Clock, ShieldCheck, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import StudentAuditHistory from '@/components/students/StudentAuditHistory';
import StudentChangePassword from '@/components/StudentChangePassword';
import { Button } from '@/components/ui/button';

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex justify-between items-start py-3 border-b border-gray-100 last:border-0">
      <span className="text-xs text-gray-500 font-medium w-32 flex-shrink-0">{label}</span>
      <span className="text-sm text-gray-800 font-semibold text-right flex-1">{value}</span>
    </div>
  );
}

const STATUS_COLORS = {
  Pending: 'bg-yellow-100 text-yellow-700',
  Verified: 'bg-blue-100 text-blue-700',
  Approved: 'bg-indigo-100 text-indigo-700',
  Published: 'bg-green-100 text-green-700',
  'Passed Out': 'bg-gray-100 text-gray-600',
  Transferred: 'bg-orange-100 text-orange-700',
};

function ProfileContent({ student, attendance, marks }) {
  const presentDays = attendance.filter(a => a.is_present && !a.is_holiday).length;
  const totalDays = attendance.filter(a => !a.is_holiday).length;
  const attendancePercentage = totalDays > 0 ? ((presentDays / totalDays) * 100).toFixed(1) : 0;
  const avgMarks = marks.length > 0
    ? (marks.reduce((sum, m) => sum + (m.marks_obtained || 0), 0) / marks.length).toFixed(1)
    : null;

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-medium">Attendance</p>
                <p className="text-2xl font-bold text-gray-900">{attendancePercentage}%</p>
              </div>
              <Clock className="h-8 w-8 text-blue-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-medium">Avg Marks</p>
                <p className="text-2xl font-bold text-gray-900">{avgMarks || '—'}</p>
              </div>
              <Award className="h-8 w-8 text-green-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-xs font-medium">Marks Records</p>
                <p className="text-2xl font-bold text-gray-900">{marks.length}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Academic Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-5 w-5 text-indigo-600" />
            Academic Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <InfoRow label="Student ID" value={student.student_id} />
          <InfoRow label="Username" value={student.username} />
          <InfoRow label="Class" value={`${student.class_name}-${student.section}`} />
          <InfoRow label="Roll No" value={student.roll_no?.toString()} />
          <InfoRow label="Academic Year" value={student.academic_year} />
          <InfoRow label="Admission Date" value={student.admission_date ? format(new Date(student.admission_date), 'dd MMM yyyy') : null} />
        </CardContent>
      </Card>

      {/* Personal Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-5 w-5 text-indigo-600" />
            Personal Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <InfoRow label="Full Name" value={student.name} />
          <InfoRow label="Gender" value={student.gender} />
          <InfoRow label="Date of Birth" value={student.dob ? format(new Date(student.dob), 'dd MMM yyyy') : null} />
          <InfoRow label="Blood Group" value={student.blood_group} />
          <InfoRow label="Address" value={student.address} />
        </CardContent>
      </Card>

      {/* Parent Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Phone className="h-5 w-5 text-indigo-600" />
            Parent / Guardian
          </CardTitle>
        </CardHeader>
        <CardContent>
          <InfoRow label="Name" value={student.parent_name} />
          <InfoRow label="Phone" value={student.parent_phone} />
          <InfoRow label="Email" value={student.parent_email} />
        </CardContent>
      </Card>

      {/* Attendance History */}
      {attendance.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Attendance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {attendance.slice(0, 10).map((record, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm text-gray-600">{format(new Date(record.date), 'dd MMM yyyy')}</span>
                  <span className={`text-xs font-semibold px-2 py-1 rounded ${
                    record.is_holiday ? 'bg-gray-100 text-gray-600' :
                    record.is_present ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {record.is_holiday ? 'Holiday' : record.is_present ? 'Present' : 'Absent'}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Marks History */}
      {marks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Marks History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {marks.map((record, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{record.subject}</p>
                    <p className="text-xs text-gray-500">{record.exam_type} • {record.academic_year}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">{record.marks_obtained}/{record.max_marks}</p>
                    {record.grade && <p className="text-xs text-gray-500">{record.grade}</p>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function StudentProfile() {
  const [searchParams] = useSearchParams();
  const studentId = searchParams.get('id');
  const [isAdmin, setIsAdmin] = useState(false);
  const [sessionStudent, setSessionStudent] = useState(null);
  const [showChangePassword, setShowChangePassword] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem('student_session') || sessionStorage.getItem('student_session');
    if (raw) {
      try {
        setSessionStudent(JSON.parse(raw));
      } catch {}
    }
    setIsAdmin(false);
  }, []);

  const { data: student, isLoading: studentLoading } = useQuery({
    queryKey: ['student-detail', studentId, sessionStudent?.id],
    queryFn: async () => {
      // If viewing own profile from session, fetch full data by id
      const idToFetch = studentId || sessionStudent?.id;
      if (!idToFetch) return null;
      const results = await base44.entities.Student.filter({ id: idToFetch });
      return results[0] || null;
    },
    enabled: !!(studentId || sessionStudent?.id),
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ['student-attendance', studentId],
    queryFn: () => base44.entities.Attendance.filter({ student_id: student?.student_id }, '-date', 100),
    enabled: !!student?.student_id,
  });

  const { data: marks = [] } = useQuery({
    queryKey: ['student-marks', studentId],
    queryFn: () => base44.entities.Marks.filter({ student_id: student?.student_id }, '-academic_year', 100),
    enabled: !!student?.student_id,
  });

  if (!studentId && !sessionStudent?.id) {
    return <div className="min-h-screen bg-[#f0f4ff] flex items-center justify-center"><p className="text-gray-400">Student not found</p></div>;
  }

  if (studentLoading) {
    return <div className="min-h-screen bg-[#f0f4ff] flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1a237e]" /></div>;
  }

  if (!student) {
    return <div className="min-h-screen bg-[#f0f4ff] flex items-center justify-center"><p className="text-gray-400">Student not found</p></div>;
  }

  const initials = student.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="min-h-screen bg-[#f0f4ff] pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1a237e] via-[#283593] to-[#3949ab] text-white sticky top-0 z-40">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <button onClick={() => window.history.back()} className="flex items-center gap-2 text-blue-200 hover:text-white mb-4 font-semibold">
            <ArrowLeft className="h-5 w-5" /> Back
          </button>
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20 border-4 border-white/30 shadow-lg">
              <AvatarImage src={student.photo_url} />
              <AvatarFallback className="bg-indigo-400 text-white font-bold text-2xl">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-3xl font-bold">{student.name}</h1>
              <p className="text-blue-200 text-sm">{student.student_id} • Class {student.class_name}-{student.section} • Roll #{student.roll_no}</p>
              <span className={`inline-block text-xs font-bold px-3 py-1 rounded-full mt-2 ${STATUS_COLORS[student.status]}`}>
                {student.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {isAdmin ? (
          <Tabs defaultValue="profile">
            <TabsList className="bg-white border shadow-sm mb-6">
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="audit">
                <ShieldCheck className="h-4 w-4 mr-1.5" />Audit History
              </TabsTrigger>
              {sessionStudent && <TabsTrigger value="password"><Lock className="h-4 w-4 mr-1.5" />Change Password</TabsTrigger>}
            </TabsList>

            <TabsContent value="profile">
              <ProfileContent student={student} attendance={attendance} marks={marks} />
            </TabsContent>

            <TabsContent value="audit">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-indigo-600" />
                    Audit History
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <StudentAuditHistory studentId={student.student_id} academicYear={student.academic_year} />
                </CardContent>
              </Card>
            </TabsContent>
            {sessionStudent && (
              <TabsContent value="password">
                <StudentChangePassword 
                  student={student} 
                  onClose={() => {}} 
                  onSuccess={() => {}} 
                />
              </TabsContent>
            )}
            </Tabs>
            ) : (
            <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">My Profile</h2>
              {sessionStudent && (
                <Button 
                  onClick={() => setShowChangePassword(true)}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <Lock className="h-4 w-4" />
                  Change Password
                </Button>
              )}
            </div>
            <ProfileContent student={student} attendance={attendance} marks={marks} />
            </div>
            )}
            </div>

            {/* Change Password Modal */}
            {showChangePassword && (
            <StudentChangePassword 
            student={student} 
            onClose={() => setShowChangePassword(false)} 
            onSuccess={() => setShowChangePassword(false)}
            />
            )}
            </div>
  );
}