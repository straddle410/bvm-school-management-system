import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import LoginRequired from '@/components/LoginRequired';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle 
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Edit } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAcademicYear } from '@/components/AcademicYearContext';
import { 
  AlertDialog, AlertDialogAction, AlertDialogCancel, 
  AlertDialogContent, AlertDialogDescription, AlertDialogTitle 
} from '@/components/ui/alert-dialog';

const STATUS_COLORS = {
  PendingApproval: 'bg-amber-100 text-amber-800',
  Published: 'bg-green-100 text-green-800',
  Draft: 'bg-gray-100 text-gray-800'
};

export default function Approvals() {
  const { academicYear } = useAcademicYear();
  const [user, setUser] = useState(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingItem, setRejectingItem] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [staffRejectDialog, setStaffRejectDialog] = useState(null);
  const [staffActionLoading, setStaffActionLoading] = useState(null);
  const [editingStaff, setEditingStaff] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const queryClient = useQueryClient();

  useEffect(() => {
    const staffData = localStorage.getItem('staff_session');
    if (staffData) {
      try {
        setUser(JSON.parse(staffData));
      } catch {}
    }
  }, []);

  const { data: pendingNotices = [] } = useQuery({
    queryKey: ['pending-notices', academicYear],
    queryFn: () => base44.entities.Notice.filter({ status: 'PendingApproval', academic_year: academicYear }, '-created_date'),
    enabled: !!academicYear
  });

  const { data: pendingQuizzes = [] } = useQuery({
    queryKey: ['pending-quizzes', academicYear],
    queryFn: () => base44.entities.Quiz.filter({ status: 'PendingApproval', academic_year: academicYear }, '-created_date'),
    enabled: !!academicYear
  });

  const { data: pendingPhotos = [] } = useQuery({
    queryKey: ['pending-photos', academicYear],
    queryFn: () => base44.entities.GalleryPhoto.filter({ status: 'PendingApproval', academic_year: academicYear }, '-created_date'),
    enabled: !!academicYear
  });

  const { data: pendingStaff = [] } = useQuery({
    queryKey: ['pending-staff'],
    queryFn: () => base44.entities.StaffAccount.filter({ status: 'pending' }, '-created_date')
  });

  const approveMutation = useMutation({
    mutationFn: async (item) => {
      const res = await base44.functions.invoke(`approve${item.type}`, { 
        [item.idField]: item.id,
        staffInfo: user
      });
      if (res.status !== 200) throw new Error(res.data?.error || 'Failed to approve');
      return res.data;
    },
    onSuccess: (data, item) => {
      queryClient.invalidateQueries([`pending-${item.type.toLowerCase()}s`]);
      toast.success(`${item.type} approved!`);
    },
    onError: (err) => {
      toast.error(err.message);
    }
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!rejectingItem) return;
      const res = await base44.functions.invoke(`reject${rejectingItem.type}`, {
        [rejectingItem.idField]: rejectingItem.id,
        reason: rejectReason,
        staffInfo: user
      });
      if (res.status !== 200) throw new Error(res.data?.error || 'Failed to reject');
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries([`pending-${rejectingItem.type.toLowerCase()}s`]);
      toast.success(`${rejectingItem.type} rejected`);
      setShowRejectModal(false);
      setRejectingItem(null);
      setRejectReason('');
    },
    onError: (err) => {
      toast.error(err.message);
    }
  });

  const openRejectModal = (item) => {
    setRejectingItem(item);
    setRejectReason('');
    setShowRejectModal(true);
  };

  const handleStaffApprove = async (record) => {
    try {
      setStaffActionLoading(record.id);
      
      const response = await base44.functions.invoke('createStaffWithAutoId', {
        staff_data: {
          name: record.name,
          role: record.role,
          designation: record.designation,
          mobile: record.mobile,
          email: record.email,
          qualification: record.qualification,
          username: record.username,
          password_hash: record.password_hash,
          is_active: true,
          status: 'active',
        }
      });

      if (response.data?.success && response.data?.staff_code) {
        await base44.entities.StaffAccount.update(record.id, {
          staff_code: response.data.staff_code,
          status: 'active',
        });
        
        toast.success(`Staff approved! Staff ID: ${response.data.staff_code}`);
        queryClient.invalidateQueries(['pending-staff']);
      } else {
        toast.error('Failed to generate Staff ID');
      }
    } catch (error) {
      console.error('Staff approval failed:', error);
      toast.error(error.response?.data?.error || 'Failed to approve staff');
    } finally {
      setStaffActionLoading(null);
    }
  };

  const handleStaffReject = async () => {
    if (!staffRejectDialog) return;
    
    try {
      setStaffActionLoading(staffRejectDialog.id);
      await base44.entities.StaffAccount.update(staffRejectDialog.id, {
        status: 'rejected',
      });
      toast.success('Staff application rejected');
      setStaffRejectDialog(null);
      queryClient.invalidateQueries(['pending-staff']);
    } catch (error) {
      console.error('Staff rejection failed:', error);
      toast.error('Failed to reject application');
    } finally {
      setStaffActionLoading(null);
    }
  };

  const openEditDialog = (record) => {
    setEditingStaff(record);
    setEditFormData({
      name: record.name,
      mobile: record.mobile,
      role: record.role,
      designation: record.designation,
      qualification: record.qualification,
      email: record.email || ''
    });
  };

  const handleSaveEdit = async () => {
    if (!editingStaff) return;
    
    try {
      setStaffActionLoading(editingStaff.id);
      await base44.entities.StaffAccount.update(editingStaff.id, editFormData);
      toast.success('Staff details updated');
      queryClient.invalidateQueries(['pending-staff']);
      setEditingStaff(null);
    } catch (error) {
      console.error('Update failed:', error);
      toast.error('Failed to update staff details');
    } finally {
      setStaffActionLoading(null);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <LoginRequired allowedRoles={['admin', 'principal']} pageName="Approvals">
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 sm:p-6">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Pending Approvals</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">Review and approve pending content</p>
          </div>

          <Tabs defaultValue="notices" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="notices">Notices <Badge className="ml-2">{pendingNotices.length}</Badge></TabsTrigger>
              <TabsTrigger value="quizzes">Quizzes <Badge className="ml-2">{pendingQuizzes.length}</Badge></TabsTrigger>
              <TabsTrigger value="photos">Gallery <Badge className="ml-2">{pendingPhotos.length}</Badge></TabsTrigger>
              <TabsTrigger value="staff">Staff Approvals <Badge className="ml-2">{pendingStaff.length}</Badge></TabsTrigger>
            </TabsList>

            {/* NOTICES TAB */}
            <TabsContent value="notices">
              <div className="space-y-4">
                {pendingNotices.length === 0 ? (
                  <Card className="border-0 shadow-sm dark:bg-gray-800">
                    <CardContent className="py-12 text-center">
                      <p className="text-gray-500 dark:text-gray-400">No pending notices</p>
                    </CardContent>
                  </Card>
                ) : (
                  pendingNotices.map(notice => (
                    <Card key={notice.id} className="border-0 shadow-sm dark:bg-gray-800 hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg text-gray-900 dark:text-white">{notice.title}</h3>
                            <div className="mt-2 flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                              <span>By {notice.created_by_name || 'Unknown'}</span>
                              <span>•</span>
                              <span>{notice.notice_type}</span>
                              <span>•</span>
                              <span>{format(new Date(notice.created_date), 'MMM d, yyyy HH:mm')}</span>
                            </div>
                            <p className="mt-3 text-sm text-gray-600 dark:text-gray-300 line-clamp-2">{notice.content}</p>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 gap-2"
                              disabled={approveMutation.isPending}
                              onClick={() => approveMutation.mutate({
                                type: 'Notice',
                                id: notice.id,
                                idField: 'noticeId'
                              })}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => openRejectModal({
                                type: 'Notice',
                                id: notice.id,
                                idField: 'noticeId'
                              })}
                            >
                              <XCircle className="h-4 w-4" />
                              Reject
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>

            {/* QUIZZES TAB */}
            <TabsContent value="quizzes">
              <div className="space-y-4">
                {pendingQuizzes.length === 0 ? (
                  <Card className="border-0 shadow-sm dark:bg-gray-800">
                    <CardContent className="py-12 text-center">
                      <p className="text-gray-500 dark:text-gray-400">No pending quizzes</p>
                    </CardContent>
                  </Card>
                ) : (
                  pendingQuizzes.map(quiz => (
                    <Card key={quiz.id} className="border-0 shadow-sm dark:bg-gray-800 hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg text-gray-900 dark:text-white">{quiz.title}</h3>
                            <div className="mt-2 flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                              <span>Class {quiz.class_name || 'All'}</span>
                              <span>•</span>
                              <span>{quiz.subject}</span>
                              <span>•</span>
                              <span>{quiz.questions?.length || 0} questions</span>
                              <span>•</span>
                              <span>{format(new Date(quiz.created_date), 'MMM d, yyyy HH:mm')}</span>
                            </div>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 gap-2"
                              disabled={approveMutation.isPending}
                              onClick={() => approveMutation.mutate({
                                type: 'Quiz',
                                id: quiz.id,
                                idField: 'quizId'
                              })}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => openRejectModal({
                                type: 'Quiz',
                                id: quiz.id,
                                idField: 'quizId'
                              })}
                            >
                              <XCircle className="h-4 w-4" />
                              Reject
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>

            {/* GALLERY TAB */}
            <TabsContent value="photos">
              <div className="space-y-4">
                {pendingPhotos.length === 0 ? (
                  <Card className="border-0 shadow-sm dark:bg-gray-800">
                    <CardContent className="py-12 text-center">
                      <p className="text-gray-500 dark:text-gray-400">No pending photos</p>
                    </CardContent>
                  </Card>
                ) : (
                  pendingPhotos.map(photo => (
                    <Card key={photo.id} className="border-0 shadow-sm dark:bg-gray-800 hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-4 flex-1">
                            {photo.photo_url && (
                              <img 
                                src={photo.photo_url} 
                                alt={photo.caption} 
                                className="h-20 w-20 object-cover rounded"
                              />
                            )}
                            <div className="flex-1">
                              <h3 className="font-semibold text-gray-900 dark:text-white">{photo.caption || 'Untitled'}</h3>
                              <div className="mt-2 flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                                <span>By {photo.uploaded_by}</span>
                                <span>•</span>
                                <span>{format(new Date(photo.created_date), 'MMM d, yyyy HH:mm')}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 gap-2"
                              disabled={approveMutation.isPending}
                              onClick={() => approveMutation.mutate({
                                type: 'Gallery',
                                id: photo.id,
                                idField: 'photoId'
                              })}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => openRejectModal({
                                type: 'Gallery',
                                id: photo.id,
                                idField: 'photoId'
                              })}
                            >
                              <XCircle className="h-4 w-4" />
                              Reject
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>

            {/* STAFF APPROVALS TAB */}
            <TabsContent value="staff">
              <div className="space-y-4">
                {pendingStaff.length === 0 ? (
                  <Card className="border-0 shadow-sm dark:bg-gray-800">
                    <CardContent className="py-12 text-center">
                      <p className="text-gray-500 dark:text-gray-400">No pending staff applications</p>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-0 shadow-sm dark:bg-gray-800">
                    <CardContent className="p-4">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b dark:border-gray-700">
                              <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Full Name</th>
                              <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Role</th>
                              <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Department</th>
                              <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Phone</th>
                              <th className="text-left py-3 px-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Applied Date</th>
                              <th className="text-right py-3 px-2 text-sm font-semibold text-gray-700 dark:text-gray-300">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pendingStaff.map((record) => (
                              <tr key={record.id} className="border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700">
                                <td className="py-3 px-2 text-sm text-gray-900 dark:text-white">{record.name}</td>
                                <td className="py-3 px-2 text-sm">
                                  <Badge variant="outline">{record.role || 'N/A'}</Badge>
                                </td>
                                <td className="py-3 px-2 text-sm text-gray-600 dark:text-gray-400">{record.designation || '-'}</td>
                                <td className="py-3 px-2 text-sm text-gray-600 dark:text-gray-400">{record.mobile || '-'}</td>
                                <td className="py-3 px-2 text-sm text-gray-500 dark:text-gray-400">
                                  {format(new Date(record.created_date), 'MMM d, yyyy')}
                                </td>
                                <td className="py-3 px-2 text-right">
                                  <div className="flex gap-2 justify-end">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => openEditDialog(record)}
                                      disabled={staffActionLoading === record.id}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      className="bg-green-600 hover:bg-green-700"
                                      onClick={() => handleStaffApprove(record)}
                                      disabled={staffActionLoading === record.id}
                                    >
                                      {staffActionLoading === record.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <>
                                          <CheckCircle2 className="h-4 w-4 mr-1" />
                                          Approve
                                        </>
                                      )}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => setStaffRejectDialog(record)}
                                      disabled={staffActionLoading === record.id}
                                    >
                                      <XCircle className="h-4 w-4 mr-1" />
                                      Reject
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* REJECT MODAL */}
        <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject {rejectingItem?.type}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Textarea
                placeholder="Enter reason for rejection..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="min-h-24"
              />
              <div className="flex gap-3 justify-end">
                <Button variant="outline" onClick={() => setShowRejectModal(false)}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  disabled={!rejectReason.trim() || rejectMutation.isPending}
                  onClick={() => rejectMutation.mutate()}
                >
                  {rejectMutation.isPending ? 'Rejecting...' : 'Confirm Rejection'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* STAFF EDIT DIALOG */}
        <Dialog open={!!editingStaff} onOpenChange={() => setEditingStaff(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Staff Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Full Name</Label>
                <Input
                  id="edit-name"
                  value={editFormData.name || ''}
                  onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-mobile">Phone Number</Label>
                <Input
                  id="edit-mobile"
                  value={editFormData.mobile || ''}
                  onChange={(e) => setEditFormData({...editFormData, mobile: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  type="email"
                  value={editFormData.email || ''}
                  onChange={(e) => setEditFormData({...editFormData, email: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-role">Role</Label>
                <Select value={editFormData.role || ''} onValueChange={(value) => setEditFormData({...editFormData, role: value})}>
                  <SelectTrigger id="edit-role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="teacher">Teacher</SelectItem>
                    <SelectItem value="exam_staff">Exam Staff</SelectItem>
                    <SelectItem value="librarian">Librarian</SelectItem>
                    <SelectItem value="staff">Support Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-designation">Department</Label>
                <Input
                  id="edit-designation"
                  value={editFormData.designation || ''}
                  onChange={(e) => setEditFormData({...editFormData, designation: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-qualification">Qualification</Label>
                <Input
                  id="edit-qualification"
                  value={editFormData.qualification || ''}
                  onChange={(e) => setEditFormData({...editFormData, qualification: e.target.value})}
                />
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <Button variant="outline" onClick={() => setEditingStaff(null)}>
                  Cancel
                </Button>
                <Button
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={handleSaveEdit}
                  disabled={staffActionLoading}
                >
                  {staffActionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save Changes
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* STAFF REJECT CONFIRMATION */}
        <AlertDialog open={!!staffRejectDialog} onOpenChange={() => setStaffRejectDialog(null)}>
          <AlertDialogContent>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              Reject Staff Application
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reject the application from <strong>{staffRejectDialog?.name}</strong>?
              This action cannot be undone.
            </AlertDialogDescription>
            <div className="flex justify-end gap-2 mt-4">
              <AlertDialogCancel onClick={() => setStaffRejectDialog(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleStaffReject}
                className="bg-red-600 hover:bg-red-700"
                disabled={staffActionLoading}
              >
                {staffActionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reject'}
              </AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </LoginRequired>
  );
}