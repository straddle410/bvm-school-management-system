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
import { CheckCircle2, Clock, AlertCircle, FileText, Check, X, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function Approvals() {
  const [user, setUser] = useState(null);
  const { academicYear } = useAcademicYear();
  const queryClient = useQueryClient();
  const [selectedAdmission, setSelectedAdmission] = useState(null);
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [editData, setEditData] = useState({});

  useEffect(() => {
    setUser(getStaffSession());
  }, []);

  const approveMutation = useMutation({
    mutationFn: async ({ id, type }) => {
      if (type === 'admissions') {
        await base44.entities.AdmissionApplication.update(id, { status: 'Approved', approved_by: user.email, approved_at: new Date().toISOString() });
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
        await base44.entities.AdmissionApplication.update(id, { status: 'Rejected' });
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

  const updateAdmissionMutation = useMutation({
    mutationFn: async (data) => {
      await base44.entities.AdmissionApplication.update(selectedAdmission.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['approvals-admissions']);
      setShowEditSheet(false);
      toast.success('Admission updated');
    }
  });

  const convertToStudentMutation = useMutation({
    mutationFn: async (admission) => {
      const { student_id, roll_no } = await base44.functions.invoke('generateNextStudentId', { class_name: admission.applying_for_class });
      const defaultPassword = 'BVM123';
      
      await base44.entities.Student.create({
        student_id,
        username: student_id,
        password: defaultPassword,
        name: admission.student_name,
        class_name: admission.applying_for_class,
        section: 'A',
        roll_no,
        photo_url: admission.photo_url,
        parent_name: admission.parent_name,
        parent_phone: admission.parent_phone,
        parent_email: admission.parent_email,
        dob: admission.dob,
        gender: admission.gender,
        address: admission.address,
        academic_year: admission.academic_year || '2024-25',
        admission_date: format(new Date(), 'yyyy-MM-dd'),
        status: 'Approved'
      });
      
      await base44.entities.AdmissionApplication.update(admission.id, { status: 'Converted', assigned_student_id: admission.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['approvals-admissions']);
      toast.success('Student record created successfully');
    }
  });

  const handleEditAdmission = (admission) => {
    setSelectedAdmission(admission);
    setEditData({
      student_name: admission.student_name,
      dob: admission.dob,
      gender: admission.gender,
      parent_name: admission.parent_name,
      parent_phone: admission.parent_phone,
      parent_email: admission.parent_email,
      address: admission.address,
      previous_school: admission.previous_school,
      applying_for_class: admission.applying_for_class
    });
    setShowEditSheet(true);
  };

  const handleSaveChanges = () => {
    updateAdmissionMutation.mutate(editData);
  };

  // Fetch verified students (ready for approval)
  const { data: verifiedStudents = [] } = useQuery({
    queryKey: ['approvals-students', academicYear],
    queryFn: async () => {
      try {
        return await base44.entities.Student.filter({ 
          status: 'Verified',
          academic_year: academicYear 
        }, '-created_date');
      } catch { return []; }
    },
    staleTime: 60000,
  });

  // Fetch pending admissions
  const { data: pendingAdmissions = [] } = useQuery({
    queryKey: ['approvals-admissions', academicYear],
    queryFn: async () => {
      try {
        return await base44.entities.AdmissionApplication.filter({ 
          status: 'Verified'
        }, '-created_date');
      } catch { return []; }
    },
    staleTime: 60000,
    refetchInterval: 30000,
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

  const handleApproveStudent = async (studentId) => {
    await base44.entities.Student.update(studentId, { 
      status: 'Approved', 
      approved_by: user.email 
    });
    queryClient.invalidateQueries(['approvals-students']);
    toast.success('Student approved');
  };

  const totalPending = verifiedStudents.length + pendingAdmissions.length + pendingMarks.length + pendingAttendance.length + pendingNotices.length;

  return (
    <LoginRequired allowedRoles={['Admin', 'admin', 'Principal', 'principal']}>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <PageHeader 
          title="Approvals" 
          subtitle={`${totalPending} pending approval${totalPending !== 1 ? 's' : ''}`}
        />

        <main className="flex-1 overflow-y-auto px-4 py-6">
          {totalPending === 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-1">All Caught Up!</h3>
              <p className="text-gray-600">No pending approvals at the moment.</p>
            </div>
          )}
          
          <Tabs defaultValue="students" className="space-y-4">
               <TabsList className="grid grid-cols-5">
                 <TabsTrigger value="students" className="relative">
                   Students
                   {verifiedStudents.length > 0 && (
                     <Badge variant="destructive" className="ml-2 h-5 min-w-[20px] flex items-center justify-center p-0 text-[10px]">
                       {verifiedStudents.length}
                     </Badge>
                   )}
                 </TabsTrigger>
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

              {/* Students Tab */}
              <TabsContent value="students">
                {verifiedStudents.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">No verified students waiting for approval</p>
                ) : (
                  <div className="space-y-3">
                    {verifiedStudents.map((item) => (
                      <Card key={item.id}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <h4 className="font-semibold text-gray-900">{item.name}</h4>
                              <p className="text-xs text-gray-500 mt-1">
                                Class {item.class_name} • {item.academic_year}
                              </p>
                              <p className="text-xs text-gray-600 mt-1">Student ID: {item.student_id} • Parent: {item.parent_name}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="bg-yellow-50 border-yellow-300 text-yellow-700">
                                <Clock className="h-3 w-3 mr-1" /> Verified
                              </Badge>
                              <Button size="sm" onClick={() => handleApproveStudent(item.id)} className="bg-green-600 hover:bg-green-700">
                                <Check className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

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
                              <Button size="sm" onClick={() => handleEditAdmission(item)} variant="outline">
                                <Eye className="h-3 w-3" />
                              </Button>
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
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="bg-yellow-50 border-yellow-300 text-yellow-700">
                                <Clock className="h-3 w-3 mr-1" /> Verified
                              </Badge>
                              <Button size="sm" onClick={() => approveMutation.mutate({ id: item.id, type: 'marks' })} className="bg-green-600 hover:bg-green-700" disabled={approveMutation.isPending}>
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button size="sm" onClick={() => rejectMutation.mutate({ id: item.id, type: 'marks' })} variant="outline" disabled={rejectMutation.isPending}>
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
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="bg-yellow-50 border-yellow-300 text-yellow-700">
                                <Clock className="h-3 w-3 mr-1" /> Verified
                              </Badge>
                              <Button size="sm" onClick={() => approveMutation.mutate({ id: item.id, type: 'attendance' })} className="bg-green-600 hover:bg-green-700" disabled={approveMutation.isPending}>
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button size="sm" onClick={() => rejectMutation.mutate({ id: item.id, type: 'attendance' })} variant="outline" disabled={rejectMutation.isPending}>
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
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="bg-yellow-50 border-yellow-300 text-yellow-700">
                                <Clock className="h-3 w-3 mr-1" /> Pending
                              </Badge>
                              <Button size="sm" onClick={() => approveMutation.mutate({ id: item.id, type: 'notices' })} className="bg-green-600 hover:bg-green-700" disabled={approveMutation.isPending}>
                                <Check className="h-3 w-3" />
                              </Button>
                              <Button size="sm" onClick={() => rejectMutation.mutate({ id: item.id, type: 'notices' })} variant="outline" disabled={rejectMutation.isPending}>
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
            </Tabs>
        </main>

        {/* Edit Admission Sheet */}
        <Sheet open={showEditSheet} onOpenChange={setShowEditSheet}>
          <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Edit Application Details</SheetTitle>
            </SheetHeader>
            
            {selectedAdmission && (
              <div className="mt-6 space-y-4">
                <div>
                  <Label>Student Name</Label>
                  <Input 
                    value={editData.student_name || ''} 
                    onChange={(e) => setEditData({...editData, student_name: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Date of Birth</Label>
                    <Input 
                      type="date"
                      value={editData.dob || ''} 
                      onChange={(e) => setEditData({...editData, dob: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label>Gender</Label>
                    <Select value={editData.gender || ''} onValueChange={(value) => setEditData({...editData, gender: value})}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Applying For Class</Label>
                  <Select value={editData.applying_for_class || ''} onValueChange={(value) => setEditData({...editData, applying_for_class: value})}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select class" />
                    </SelectTrigger>
                    <SelectContent>
                      {['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].map(cls => (
                        <SelectItem key={cls} value={cls}>Class {cls}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Parent/Guardian Name</Label>
                  <Input 
                    value={editData.parent_name || ''} 
                    onChange={(e) => setEditData({...editData, parent_name: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Parent Phone</Label>
                    <Input 
                      value={editData.parent_phone || ''} 
                      onChange={(e) => setEditData({...editData, parent_phone: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label>Parent Email</Label>
                    <Input 
                      type="email"
                      value={editData.parent_email || ''} 
                      onChange={(e) => setEditData({...editData, parent_email: e.target.value})}
                    />
                  </div>
                </div>

                <div>
                  <Label>Address</Label>
                  <Textarea 
                    value={editData.address || ''} 
                    onChange={(e) => setEditData({...editData, address: e.target.value})}
                    rows={2}
                  />
                </div>

                <div>
                  <Label>Previous School</Label>
                  <Input 
                    value={editData.previous_school || ''} 
                    onChange={(e) => setEditData({...editData, previous_school: e.target.value})}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button 
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowEditSheet(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    className="flex-1"
                    onClick={handleSaveChanges}
                    disabled={updateAdmissionMutation.isPending}
                  >
                    {updateAdmissionMutation.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </LoginRequired>
  );
}