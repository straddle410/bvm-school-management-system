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
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAcademicYear } from '@/components/AcademicYearContext';

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

  const approveMutation = useMutation({
    mutationFn: async (item) => {
      const res = await base44.functions.invoke(`approve${item.type}`, { 
        [item.idField]: item.id 
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
        reason: rejectReason
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

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <LoginRequired allowedRoles={['admin', 'principal']} pageName="Approvals">
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Pending Approvals</h1>
            <p className="text-gray-500 mt-1">Review and approve pending content</p>
          </div>

          <Tabs defaultValue="notices" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="notices">Notices <Badge className="ml-2">{pendingNotices.length}</Badge></TabsTrigger>
              <TabsTrigger value="quizzes">Quizzes <Badge className="ml-2">{pendingQuizzes.length}</Badge></TabsTrigger>
              <TabsTrigger value="photos">Gallery <Badge className="ml-2">{pendingPhotos.length}</Badge></TabsTrigger>
            </TabsList>

            {/* NOTICES TAB */}
            <TabsContent value="notices">
              <div className="space-y-4">
                {pendingNotices.length === 0 ? (
                  <Card className="border-0 shadow-sm">
                    <CardContent className="py-12 text-center">
                      <p className="text-gray-500">No pending notices</p>
                    </CardContent>
                  </Card>
                ) : (
                  pendingNotices.map(notice => (
                    <Card key={notice.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg text-gray-900">{notice.title}</h3>
                            <div className="mt-2 flex items-center gap-3 text-sm text-gray-500">
                              <span>By {notice.created_by_name || 'Unknown'}</span>
                              <span>•</span>
                              <span>{notice.notice_type}</span>
                              <span>•</span>
                              <span>{format(new Date(notice.created_date), 'MMM d, yyyy HH:mm')}</span>
                            </div>
                            <p className="mt-3 text-sm text-gray-600 line-clamp-2">{notice.content}</p>
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
                  <Card className="border-0 shadow-sm">
                    <CardContent className="py-12 text-center">
                      <p className="text-gray-500">No pending quizzes</p>
                    </CardContent>
                  </Card>
                ) : (
                  pendingQuizzes.map(quiz => (
                    <Card key={quiz.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <h3 className="font-semibold text-lg text-gray-900">{quiz.title}</h3>
                            <div className="mt-2 flex items-center gap-3 text-sm text-gray-500">
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
                  <Card className="border-0 shadow-sm">
                    <CardContent className="py-12 text-center">
                      <p className="text-gray-500">No pending photos</p>
                    </CardContent>
                  </Card>
                ) : (
                  pendingPhotos.map(photo => (
                    <Card key={photo.id} className="border-0 shadow-sm hover:shadow-md transition-shadow">
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
                              <h3 className="font-semibold text-gray-900">{photo.caption || 'Untitled'}</h3>
                              <div className="mt-2 flex items-center gap-3 text-sm text-gray-500">
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
      </div>
    </LoginRequired>
  );
}