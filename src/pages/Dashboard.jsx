import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import PageHeader from '@/components/ui/PageHeader';
import StatsCard from '@/components/ui/StatsCard';
import StatusBadge from '@/components/ui/StatusBadge';
import DataTable from '@/components/ui/DataTable';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  GraduationCap, Users, ClipboardCheck, BookOpen, 
  Clock, CheckCircle2, AlertCircle, Calendar,
  TrendingUp, ArrowRight, UserPlus
} from 'lucide-react';
import { format } from 'date-fns';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export default function Dashboard() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser);
  }, []);

  const { data: students = [] } = useQuery({
    queryKey: ['students'],
    queryFn: () => base44.entities.Student.list()
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ['teachers'],
    queryFn: () => base44.entities.Teacher.list()
  });

  const { data: attendance = [] } = useQuery({
    queryKey: ['attendance-today'],
    queryFn: () => base44.entities.Attendance.filter({ 
      date: format(new Date(), 'yyyy-MM-dd') 
    })
  });

  const { data: admissions = [] } = useQuery({
    queryKey: ['admissions'],
    queryFn: () => base44.entities.Admission.list()
  });

  const { data: events = [] } = useQuery({
    queryKey: ['upcoming-events'],
    queryFn: () => base44.entities.CalendarEvent.filter({ status: 'Published' })
  });

  const publishedStudents = students.filter(s => s.status === 'Published');
  const pendingApprovals = [
    ...students.filter(s => ['Pending', 'Verified'].includes(s.status)),
    ...admissions.filter(a => ['Submitted', 'Under Review', 'Verified'].includes(a.status)),
  ];

  const todayAttendance = attendance.filter(a => a.status === 'Published');
  const presentCount = todayAttendance.filter(a => a.is_present).length;
  const absentCount = todayAttendance.filter(a => !a.is_present).length;

  const classDistribution = publishedStudents.reduce((acc, s) => {
    const cls = s.class_name || 'Unknown';
    acc[cls] = (acc[cls] || 0) + 1;
    return acc;
  }, {});

  const pieData = Object.entries(classDistribution).map(([name, value]) => ({ name, value }));

  const upcomingEvents = events
    .filter(e => new Date(e.start_date) >= new Date())
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader 
        title={`Welcome back, ${user?.full_name?.split(' ')[0] || 'Admin'}!`}
        subtitle={format(new Date(), 'EEEE, MMMM d, yyyy')}
      />

      <div className="p-4 lg:p-8 space-y-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Link to={createPageUrl('Students')}>
            <StatsCard
              title="Total Students"
              value={publishedStudents.length}
              subtitle="Published & Active"
              icon={GraduationCap}
              color="blue"
            />
          </Link>
          <Link to={createPageUrl('Teachers')}>
            <StatsCard
              title="Total Teachers"
              value={teachers.filter(t => t.status === 'Active').length}
              subtitle="Active faculty"
              icon={Users}
              color="purple"
            />
          </Link>
          <Link to={createPageUrl('Attendance')}>
            <StatsCard
              title="Today's Attendance"
              value={todayAttendance.length > 0 ? `${Math.round((presentCount / (presentCount + absentCount)) * 100)}%` : '--'}
              subtitle={`${presentCount} present, ${absentCount} absent`}
              icon={ClipboardCheck}
              color="green"
            />
          </Link>
          <Link to={createPageUrl('Approvals')}>
            <StatsCard
              title="Pending Approvals"
              value={pendingApprovals.length}
              subtitle="Requires action"
              icon={Clock}
              color="amber"
            />
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Class Distribution */}
          <Card className="border-0 shadow-sm lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold">Class Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {pieData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[200px] flex items-center justify-center text-slate-400">
                  No data available
                </div>
              )}
              <div className="flex flex-wrap gap-2 mt-4 justify-center">
                {pieData.slice(0, 5).map((item, i) => (
                  <div key={item.name} className="flex items-center gap-2 text-xs">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}
                    />
                    <span className="text-slate-600">Class {item.name}: {item.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Upcoming Events */}
          <Card className="border-0 shadow-sm lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-semibold">Upcoming Events</CardTitle>
              <Link to={createPageUrl('Calendar')}>
                <Button variant="ghost" size="sm" className="text-blue-600">
                  View All <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {upcomingEvents.length > 0 ? (
                <div className="space-y-3">
                  {upcomingEvents.map((event) => (
                    <div key={event.id} className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl">
                      <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center">
                        <Calendar className="h-5 w-5 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 truncate">{event.title}</p>
                        <p className="text-sm text-slate-500">
                          {format(new Date(event.start_date), 'MMM d, yyyy')}
                        </p>
                      </div>
                      <StatusBadge status={event.event_type} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center text-slate-400">
                  No upcoming events
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Admissions */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold">Recent Admission Applications</CardTitle>
            <Link to={createPageUrl('Admissions')}>
              <Button variant="ghost" size="sm" className="text-blue-600">
                View All <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {admissions.slice(0, 5).map((admission) => (
                <div key={admission.id} className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl">
                  <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                    <UserPlus className="h-5 w-5 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">{admission.student_name}</p>
                    <p className="text-sm text-slate-500">
                      Applying for Class {admission.applying_for_class}
                    </p>
                  </div>
                  <StatusBadge status={admission.status} />
                </div>
              ))}
              {admissions.length === 0 && (
                <div className="py-8 text-center text-slate-400">
                  No admission applications yet
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Link to={createPageUrl('Students') + '?action=add'}>
            <Card className="border-0 shadow-sm p-4 hover:shadow-md transition-all cursor-pointer group">
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                  <GraduationCap className="h-6 w-6 text-blue-600" />
                </div>
                <span className="text-sm font-medium text-slate-700">Add Student</span>
              </div>
            </Card>
          </Link>
          <Link to={createPageUrl('Attendance')}>
            <Card className="border-0 shadow-sm p-4 hover:shadow-md transition-all cursor-pointer group">
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="h-12 w-12 rounded-xl bg-green-50 flex items-center justify-center group-hover:bg-green-100 transition-colors">
                  <ClipboardCheck className="h-6 w-6 text-green-600" />
                </div>
                <span className="text-sm font-medium text-slate-700">Mark Attendance</span>
              </div>
            </Card>
          </Link>
          <Link to={createPageUrl('Marks')}>
            <Card className="border-0 shadow-sm p-4 hover:shadow-md transition-all cursor-pointer group">
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="h-12 w-12 rounded-xl bg-purple-50 flex items-center justify-center group-hover:bg-purple-100 transition-colors">
                  <BookOpen className="h-6 w-6 text-purple-600" />
                </div>
                <span className="text-sm font-medium text-slate-700">Enter Marks</span>
              </div>
            </Card>
          </Link>
          <Link to={createPageUrl('Quiz')}>
            <Card className="border-0 shadow-sm p-4 hover:shadow-md transition-all cursor-pointer group">
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="h-12 w-12 rounded-xl bg-amber-50 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
                  <AlertCircle className="h-6 w-6 text-amber-600" />
                </div>
                <span className="text-sm font-medium text-slate-700">Create Quiz</span>
              </div>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}