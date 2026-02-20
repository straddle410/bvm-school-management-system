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
  Calendar, CheckCircle2, XCircle, Users, Save
} from 'lucide-react';
import { format } from 'date-fns';
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
  
  const queryClient = useQueryClient();

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
    } else {
      setAttendanceData({});
    }
  }, [existingAttendance]);

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
          is_present: existing?.is_present !== false,
          marked_by: user?.email,
          academic_year: academicYear,
          status: 'Taken'
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
      toast.success('Attendance saved successfully');
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
          <CardContent className="p-4">
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
                </CardTitle>
                <Button variant="outline" size="sm" onClick={markAllPresent}>
                  Mark All Present
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {filteredStudents.length === 0 ? (
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
            {filteredStudents.length > 0 && (
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