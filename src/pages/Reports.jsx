import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import LoginRequired from '@/components/LoginRequired';
import { useQuery } from '@tanstack/react-query';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Download, FileText, Users, BookOpen, TrendingUp, BarChart3
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';

const CLASSES = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export default function Reports() {
  const [selectedClass, setSelectedClass] = useState('all');
  const [selectedExam, setSelectedExam] = useState('all');

  const { data: students = [] } = useQuery({
    queryKey: ['students-published'],
    queryFn: () => base44.entities.Student.filter({ status: 'Published' })
  });

  const { data: marks = [] } = useQuery({
    queryKey: ['marks-published'],
    queryFn: () => base44.entities.Marks.filter({ status: 'Published' })
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ['attendance-published'],
    queryFn: () => base44.entities.Attendance.filter({ status: 'Published' })
  });

  const { data: examTypes = [] } = useQuery({
    queryKey: ['exam-types'],
    queryFn: () => base44.entities.ExamType.list()
  });

  // Class-wise student distribution
  const classDistribution = CLASSES.map(cls => ({
    class: `Class ${cls}`,
    count: students.filter(s => s.class_name === cls).length
  })).filter(c => c.count > 0);

  // Subject-wise average marks
  const subjectAverages = () => {
    const subjects = [...new Set(marks.map(m => m.subject))];
    return subjects.map(subject => {
      const subjectMarks = marks.filter(m => m.subject === subject);
      const avg = subjectMarks.reduce((sum, m) => sum + (m.marks_obtained / m.max_marks * 100), 0) / subjectMarks.length;
      return { subject, average: Math.round(avg) || 0 };
    });
  };

  // Grade distribution
  const gradeDistribution = () => {
    const grades = { 'A+': 0, 'A': 0, 'B+': 0, 'B': 0, 'C': 0, 'D': 0, 'F': 0 };
    marks.forEach(m => {
      if (m.grade && grades[m.grade] !== undefined) {
        grades[m.grade]++;
      }
    });
    return Object.entries(grades).map(([name, value]) => ({ name, value })).filter(g => g.value > 0);
  };

  // Attendance statistics
  const attendanceStats = () => {
    const totalPresent = attendance.filter(a => a.is_present).length;
    const totalAbsent = attendance.filter(a => !a.is_present).length;
    return [
      { name: 'Present', value: totalPresent },
      { name: 'Absent', value: totalAbsent }
    ];
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader 
        title="Reports"
        subtitle="Analytics and insights"
        actions={
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" /> Export PDF
          </Button>
        }
      />

      <div className="p-4 lg:p-8">
        <Tabs defaultValue="overview">
          <TabsList className="bg-white border shadow-sm mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="academics">Academics</TabsTrigger>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="border-0 shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center">
                      <Users className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Total Students</p>
                      <p className="text-2xl font-bold">{students.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-green-100 flex items-center justify-center">
                      <BookOpen className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Exams Conducted</p>
                      <p className="text-2xl font-bold">{examTypes.filter(e => e.status === 'Published').length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-purple-100 flex items-center justify-center">
                      <TrendingUp className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Avg. Performance</p>
                      <p className="text-2xl font-bold">
                        {Math.round(marks.reduce((sum, m) => sum + (m.marks_obtained / m.max_marks * 100), 0) / marks.length) || 0}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-sm">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-amber-100 flex items-center justify-center">
                      <BarChart3 className="h-6 w-6 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Attendance Rate</p>
                      <p className="text-2xl font-bold">
                        {Math.round((attendance.filter(a => a.is_present).length / attendance.length) * 100) || 0}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Class-wise Students</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={classDistribution}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="class" fontSize={12} />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Grade Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={gradeDistribution()}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      >
                        {gradeDistribution().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="academics" className="space-y-6">
            {/* Filters */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <Select value={selectedClass} onValueChange={setSelectedClass}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Select Class" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Classes</SelectItem>
                      {CLASSES.map(c => (
                        <SelectItem key={c} value={c}>Class {c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedExam} onValueChange={setSelectedExam}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Select Exam" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Exams</SelectItem>
                      {examTypes.map(e => (
                        <SelectItem key={e.id} value={e.name}>{e.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg">Subject-wise Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={subjectAverages()} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 100]} />
                    <YAxis dataKey="subject" type="category" width={120} fontSize={12} />
                    <Tooltip />
                    <Bar dataKey="average" fill="#10B981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="attendance" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Overall Attendance</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={attendanceStats()}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      >
                        <Cell fill="#10B981" />
                        <Cell fill="#EF4444" />
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className="border-0 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Attendance Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-green-50 rounded-xl">
                    <span className="font-medium text-green-700">Total Present</span>
                    <span className="text-2xl font-bold text-green-700">
                      {attendance.filter(a => a.is_present).length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-red-50 rounded-xl">
                    <span className="font-medium text-red-700">Total Absent</span>
                    <span className="text-2xl font-bold text-red-700">
                      {attendance.filter(a => !a.is_present).length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl">
                    <span className="font-medium text-blue-700">Total Records</span>
                    <span className="text-2xl font-bold text-blue-700">
                      {attendance.length}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}