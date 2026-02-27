import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import LoginRequired from '@/components/LoginRequired';
import { getStaffSession } from '@/components/useStaffSession';
import { useAcademicYear } from '@/components/AcademicYearContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '@/components/ui/PageHeader';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { CheckCircle2, Clock, AlertCircle, FileText, Check, X } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function Approvals() {
  const [user, setUser] = useState(null);
  const { academicYear } = useAcademicYear();
  const queryClient = useQueryClient();

  useEffect(() => {
    setUser(getStaffSession());
  }, []);

  const approveMutation = useMutation({
    mutationFn: async ({ id, type }) => {
      if (type === 'admissions') {
        await base44.entities.Admission.update(id, { status: 'Approved', approved_by: user.email });
      } else if (type === 'marks') {
        await base44.entities.Marks.update(id, { status: 'Approved', approved_by: user.email });
      } else if (type === 'attendance') {
        await base44.entities.Attendance.update(id, { status: 'Approved', approved_by: user.email });
      } else if (type === 'notices') {
        await base44.entities.Notice.update(id, { status: 'Approved', approved_by: user.email });
      }
    },
    onSuccess: (_, { type }) => {
      queryClient.invalidateQueries([`approvals-${type}`]);
      toast.success('Approved successfully');
    }
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, type }) => {
      if (type === 'admissions') {
        await base44.entities.Admission.update(id, { status: 'Rejected' });
      } else if (type === 'marks') {
        await base44.entities.Marks.update(id, { status: 'Draft' });
      } else if (type === 'attendance') {
        await base44.entities.Attendance.update(id, { status: 'Taken' });
      } else if (type === 'notices') {
        await base44.entities.Notice.update(id, { status: 'Draft' });
      }
    },
    onSuccess: (_, { type }) => {
      queryClient.invalidateQueries([`approvals-${type}`]);
      toast.success('Rejected');
    }
  });

  // Fetch pending admissions
  const { data: pendingAdmissions = [] } = useQuery({
    queryKey: ['approvals-admissions', academicYear],
    queryFn: async () => {
      try {
        return await base44.entities.Admission.filter({ 
          status: 'Verified',
          academic_year: academicYear 
        }, '-created_date');
      } catch { return []; }
    },
    staleTime: 60000,
  });

  // Fetch pending marks for approval
  const { data: pendingMarks = [] } = useQuery({
    queryKey: ['approvals-marks', academicYear],
    queryFn: async () => {
      try {
        return await base44.entities.Marks.filter({ 
          status: 'Verified',
          academic_year: academicYear 
        }, '-created_date');
      } catch { return []; }
    },
    staleTime: 60000,
  });

  // Fetch pending attendance for approval
  const { data: pendingAttendance = [] } = useQuery({
    queryKey: ['approvals-attendance', academicYear],
    queryFn: async () => {
      try {
        return await base44.entities.Attendance.filter({ 
          status: 'Verified',
          academic_year: academicYear 
        }, '-date');
      } catch { return []; }
    },
    staleTime: 60000,
  });

  // Fetch pending notices for approval
  const { data: pendingNotices = [] } = useQuery({
    queryKey: ['approvals-notices'],
    queryFn: async () => {
      try {
        return await base44.entities.Notice.filter({ 
          status: 'Submitted'
        }, '-created_date');
      } catch { return []; }
    },
    staleTime: 60000,
  });

  const totalPending = pendingAdmissions.length + pendingMarks.length + pendingAttendance.length + pendingNotices.length;

  return (
    <LoginRequired allowedRoles={['Admin', 'admin', 'Principal', 'principal']}>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <PageHeader 
          title="Approvals" 
          subtitle={`${totalPending} pending approval${totalPending !== 1 ? 's' : ''}`}
        />

        <main className="flex-1 overflow-y-auto px-4 py-6">
          {totalPending === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-1">All Caught Up!</h3>
              <p className="text-gray-600">No pending approvals at the moment.</p>
            </div>
          ) : (
            <Tabs defaultValue="admissions" className="space-y-4">
              <TabsList className="grid grid-cols-4">
                <TabsTrigger value="admissions" className="relative">
                  Admissions
                  {pendingAdmissions.length > 0 && (
                    <Badge variant="destructive" className="ml-2 h-5 min-w-[20px] flex items-center justify-center p-0 text-[10px]">
                      {pendingAdmissions.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="marks" className="relative">
                  Marks
                  {pendingMarks.length > 0 && (
                    <Badge variant="destructive" className="ml-2 h-5 min-w-[20px] flex items-center justify-center p-0 text-[10px]">
                      {pendingMarks.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="attendance" className="relative">
                  Attendance
                  {pendingAttendance.length > 0 && (
                    <Badge variant="destructive" className="ml-2 h-5 min-w-[20px] flex items-center justify-center p-0 text-[10px]">
                      {pendingAttendance.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="notices" className="relative">
                  Notices
                  {pendingNotices.length > 0 && (
                    <Badge variant="destructive" className="ml-2 h-5 min-w-[20px] flex items-center justify-center p-0 text-[10px]">
                      {pendingNotices.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* Admissions Tab */}
              <TabsContent value="admissions">
                {pendingAdmissions.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No pending admissions</p>
                ) : (
                  <div className="space-y-3">
                    {pendingAdmissions.map((item) => (
                      <Card key={item.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-900">{item.student_name}</h4>
                              <p className="text-xs text-gray-500 mt-1">
                                Applying for Class {item.applying_for_class} • {item.academic_year}
                              </p>
                              <p className="text-xs text-gray-600 mt-1">Parent: {item.parent_name} • {item.parent_phone}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="bg-yellow-50 border-yellow-300 text-yellow-700">
                                <Clock className="h-3 w-3 mr-1" /> Verified
                              </Badge>
                              <Button size="sm" onClick={() => approveMutation.mutate({ id: item.id, type: 'admissions' })} className="bg-green-600 hover:bg-green-700" disabled={approveMutation.isPending}>
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button size="sm" onClick={() => rejectMutation.mutate({ id: item.id, type: 'admissions' })} variant="outline" disabled={rejectMutation.isPending}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Marks Tab */}
              <TabsContent value="marks">
                {pendingMarks.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No pending marks</p>
                ) : (
                  <div className="space-y-3">
                    {pendingMarks.map((item) => (
                      <Card key={item.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-900">{item.student_name}</h4>
                              <p className="text-xs text-gray-500 mt-1">
                                {item.subject} • {item.exam_type} • Class {item.class_name}-{item.section}
                              </p>
                              <p className="text-xs text-gray-600 mt-1">{item.marks_obtained}/{item.max_marks} marks</p>
                            </div>
                            <Badge variant="outline" className="bg-yellow-50 border-yellow-300 text-yellow-700">
                              <Clock className="h-3 w-3 mr-1" /> Verified
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Attendance Tab */}
              <TabsContent value="attendance">
                {pendingAttendance.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No pending attendance</p>
                ) : (
                  <div className="space-y-3">
                    {pendingAttendance.map((item) => (
                      <Card key={item.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-900">{item.student_name}</h4>
                              <p className="text-xs text-gray-500 mt-1">
                                {format(new Date(item.date + 'T00:00:00'), 'MMM d, yyyy')} • Class {item.class_name}-{item.section}
                              </p>
                              <p className="text-xs text-gray-600 mt-1 capitalize">{item.attendance_type.replace('_', ' ')}</p>
                            </div>
                            <Badge variant="outline" className="bg-yellow-50 border-yellow-300 text-yellow-700">
                              <Clock className="h-3 w-3 mr-1" /> Verified
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Notices Tab */}
              <TabsContent value="notices">
                {pendingNotices.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No pending notices</p>
                ) : (
                  <div className="space-y-3">
                    {pendingNotices.map((item) => (
                      <Card key={item.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-900">{item.title}</h4>
                              <p className="text-xs text-gray-600 mt-1 line-clamp-2">{item.content}</p>
                              <p className="text-xs text-gray-500 mt-2">By: {item.created_by}</p>
                            </div>
                            <Badge variant="outline" className="bg-yellow-50 border-yellow-300 text-yellow-700">
                              <Clock className="h-3 w-3 mr-1" /> Pending
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </main>
      </div>
    </LoginRequired>
  );
}