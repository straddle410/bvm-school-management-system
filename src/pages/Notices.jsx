import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { getStaffSession } from '@/components/useStaffSession';
import { markStaffNotificationsRead } from '@/components/StaffNotificationBadges';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Bell, Pin, Plus, Megaphone, Calendar, Users, Check, CheckCheck, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from "sonner";
import TableBuilder from '@/components/TableBuilder';
import LoginRequired from '@/components/LoginRequired';
import AIAssistDrawer from '@/components/AIAssistDrawer';
import { useAcademicYear } from '@/components/AcademicYearContext';

const TYPE_COLORS = {
  General: 'bg-blue-100 text-blue-700',
  Exam: 'bg-purple-100 text-purple-700',
  Holiday: 'bg-red-100 text-red-700',
  PTM: 'bg-green-100 text-green-700',
  Fee: 'bg-amber-100 text-amber-700',
  Urgent: 'bg-red-500 text-white',
  Event: 'bg-pink-100 text-pink-700',
};

function getStudentSession() {
  try {
    const s = localStorage.getItem('student_session');
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

export default function Notices() {
   const { academicYear } = useAcademicYear();
   const [user, setUser] = useState(null);
   const [studentSession, setStudentSession] = useState(null);
   const [showDialog, setShowDialog] = useState(false);
   const [showAIAssist, setShowAIAssist] = useState(false);
   const [filterType, setFilterType] = useState('all');
   const [readNoticeIds, setReadNoticeIds] = useState(() => {
      try { return new Set(JSON.parse(localStorage.getItem('read_notice_ids') || '[]')); } catch { return new Set(); }
   });
   const [unreadNotifMap, setUnreadNotifMap] = useState({}); 
   const [form, setForm] = useState({
      title: '',
      content: '',
      notice_type: 'General',
      target_audience: 'All',
      target_classes: [],
      publish_date: format(new Date(), 'yyyy-MM-dd'),
      expiry_date: '',
      is_pinned: false,
      status: 'Draft'
   });
   const [showTableBuilder, setShowTableBuilder] = useState(false);
   const [editingNotice, setEditingNotice] = useState(null);

  const queryClient = useQueryClient();

  useEffect(() => {
     const staffData = getStaffSession();
     setUser(staffData);

     const ss = getStudentSession();
     setStudentSession(ss);

     // If student, mark notices as read
     if (ss?.student_id) {
       base44.functions.invoke('markStudentNotificationsRead', {
         student_id: ss.student_id,
         event_types: ['NOTICE_PUBLISHED'],
       }).catch(() => {});
     }

     // Load staff unread notice notifs (don't auto-mark all read)
     if (staffData?.email) {
       loadStaffUnreadNoticeNotifs(staffData.email);
     }

     // Load student unread notice notifs (don't auto-mark all read)
     if (ss?.student_id) {
       loadStudentUnreadNoticeNotifs(ss.student_id);
     }
   }, []);

  const loadStaffUnreadNoticeNotifs = async (email) => {
    try {
      const unread = await base44.entities.Notification.filter({ recipient_staff_id: email, type: 'notice_posted_staff', is_read: false });
      const map = {};
      unread.forEach(n => { if (n.related_entity_id) map[n.related_entity_id] = n.id; });
      setUnreadNotifMap(map);
    } catch {}
  };

  const loadStudentUnreadNoticeNotifs = async (studentId) => {
    try {
      const unread = await base44.entities.Notification.filter({ recipient_student_id: studentId, type: 'notice_posted', is_read: false });
      const map = {};
      unread.forEach(n => { if (n.related_entity_id) map[n.related_entity_id] = n.id; });
      setUnreadNotifMap(map);
    } catch {}
  };

  const markNoticeRead = async (noticeId) => {
    const notifId = unreadNotifMap[noticeId];
    // Also track locally for notices without server notif
    if (!readNoticeIds.has(noticeId)) {
      const next = new Set(readNoticeIds).add(noticeId);
      setReadNoticeIds(next);
      localStorage.setItem('read_notice_ids', JSON.stringify([...next]));
    }
    if (!notifId) return;
    try {
      await base44.entities.Notification.update(notifId, { is_read: true });
      setUnreadNotifMap(prev => { const next = { ...prev }; delete next[noticeId]; return next; });
    } catch {}
  };

  const markAllNoticesRead = async () => {
    try {
      await Promise.all(Object.values(unreadNotifMap).map(id => base44.entities.Notification.update(id, { is_read: true })));
      setUnreadNotifMap({});
      // Also mark all visible as locally read
      const next = new Set(readNoticeIds);
      visibleNotices.forEach(n => next.add(n.id));
      setReadNoticeIds(next);
      localStorage.setItem('read_notice_ids', JSON.stringify([...next]));
    } catch {}
  };

  const isStaff = user && ['admin', 'principal', 'teacher', 'staff'].includes((user.role || '').toLowerCase());
  const isAdmin = user && ['admin', 'principal'].includes((user.role || '').toLowerCase());

  const { data: notices = [], isLoading } = useQuery({
    queryKey: ['notices', academicYear],
    queryFn: () => base44.entities.Notice.filter({ academic_year: academicYear }, '-created_date'),
    enabled: !!academicYear
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Notice.create({ ...data, academic_year: academicYear }),
    onSuccess: () => {
      queryClient.invalidateQueries(['notices']);
      setShowDialog(false);
      resetForm();
      toast.success('Notice created');
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Notice.update(editingNotice.id, { ...data, academic_year: academicYear }),
    onSuccess: () => {
      queryClient.invalidateQueries(['notices']);
      setShowDialog(false);
      setEditingNotice(null);
      resetForm();
      toast.success('Notice updated');
    }
  });

  const publishMutation = useMutation({
    mutationFn: (id) => base44.entities.Notice.update(id, { status: 'Published' }),
    onSuccess: () => {
      queryClient.invalidateQueries(['notices']);
      toast.success('Notice published');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Notice.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['notices']);
      toast.success('Notice deleted');
    }
  });

  const resetForm = () => {
    setForm({
      title: '', content: '', notice_type: 'General', target_audience: 'All',
      target_classes: [],
      publish_date: format(new Date(), 'yyyy-MM-dd'), expiry_date: '', is_pinned: false, status: 'Draft'
    });
  };

  const openEditForm = (notice) => {
    setEditingNotice(notice);
    setForm({
      title: notice.title,
      content: notice.content,
      notice_type: notice.notice_type,
      target_audience: notice.target_audience,
      target_classes: notice.target_classes || [],
      publish_date: notice.publish_date,
      expiry_date: notice.expiry_date || '',
      is_pinned: notice.is_pinned
    });
    setShowDialog(true);
  };

  const visibleNotices = notices.filter(n => {
    if (!isStaff && n.status !== 'Published') return false;
    if (filterType !== 'all' && n.notice_type !== filterType) return false;
    return true;
  });

  const pinned = visibleNotices.filter(n => n.is_pinned);
  const regular = visibleNotices.filter(n => !n.is_pinned);
  const totalUnread = Object.keys(unreadNotifMap).length;

  return (
     <LoginRequired allowedRoles={['admin', 'principal', 'teacher']} pageName="Notices">
     <div className="min-h-screen bg-gray-50 pb-6 w-full overflow-x-hidden">
      {/* Header */}
      <div className="bg-[#1a237e] text-white px-3 sm:px-4 py-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Bell className="h-6 w-6 text-yellow-400" />
            <div>
              <h1 className="text-xl font-bold">Notices</h1>
              <p className="text-blue-200 text-xs">School announcements</p>
            </div>
          </div>
          <div className="flex gap-2">
            {totalUnread > 0 && (
              <Button
                onClick={markAllNoticesRead}
                size="sm"
                className="bg-white/20 hover:bg-white/30 text-white border border-white/30 text-xs"
              >
                <CheckCheck className="h-3.5 w-3.5 mr-1" /> Mark All Read
              </Button>
            )}
            {isStaff && (
                <div className="flex gap-2">
                  <Button
                    onClick={() => setShowAIAssist(true)}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-sm"
                  >
                    <Sparkles className="h-4 w-4 mr-1" /> AI Assist
                  </Button>
                  <Button
                    onClick={() => {
                      setEditingNotice(null);
                      resetForm();
                      setShowDialog(true);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm"
                  >
                    <Plus className="h-4 w-4 mr-1" /> {isAdmin ? 'Post Notice' : 'Create Notice'}
                  </Button>
                </div>
              )}
          </div>
        </div>
      </div>

      <div className="w-full px-3 sm:px-4 py-4 space-y-4">
         {/* Filter */}
         <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {['all', 'General', 'Exam', 'Holiday', 'PTM', 'Fee', 'Urgent', 'Event'].map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                filterType === type
                  ? 'bg-[#1a237e] text-white'
                  : 'bg-white text-gray-600 border border-gray-200'
              }`}
            >
              {type === 'all' ? 'All' : type}
            </button>
          ))}
        </div>

        {/* Pinned Notices */}
        {pinned.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Pin className="h-3 w-3" /> Pinned
            </p>
            <div className="space-y-3">
              {pinned.map(notice => (
                <NoticeCard key={notice.id} notice={notice} isAdmin={isAdmin} user={user} onPublish={publishMutation.mutate} onDelete={deleteMutation.mutate} onEdit={openEditForm}
                  isUnread={!!unreadNotifMap[notice.id]} onRead={() => markNoticeRead(notice.id)} />
              ))}
            </div>
          </div>
        )}

        {/* Regular Notices */}
        <div className="space-y-3">
          {regular.map(notice => (
            <NoticeCard key={notice.id} notice={notice} isAdmin={isAdmin} user={user} onPublish={publishMutation.mutate} onDelete={deleteMutation.mutate} onEdit={openEditForm}
              isUnread={!!unreadNotifMap[notice.id]} onRead={() => markNoticeRead(notice.id)} />
          ))}
        </div>

        {visibleNotices.length === 0 && !isLoading && (
          <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
            <Megaphone className="h-10 w-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No notices available</p>
          </div>
        )}
      </div>

      {/* AI Assist Drawer */}
      {showAIAssist && (
        <AIAssistDrawer
          type="notice"
          className={user?.class_name || ''}
          section={user?.section || ''}
          academicYear={academicYear}
          onInsert={(generated) => {
            setForm({
              ...form,
              title: generated.title || form.title,
              content: generated.body || form.content
            });
            toast.success('Content inserted! Review before publishing.');
          }}
          onClose={() => setShowAIAssist(false)}
        />
      )}

      {/* Table Builder Dialog */}
       <Dialog open={showTableBuilder} onOpenChange={setShowTableBuilder}>
         <DialogContent className="max-w-2xl">
           <TableBuilder 
             onInsert={(html) => {
               setForm({...form, content: form.content + '\n' + html});
               setShowTableBuilder(false);
             }}
             onClose={() => setShowTableBuilder(false)}
           />
         </DialogContent>
       </Dialog>

      {/* Create Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg w-[95vw] max-h-[90vh] overflow-y-auto rounded-2xl">
           <DialogHeader>
             <DialogTitle>{editingNotice ? 'Edit Notice' : 'Create Notice'}</DialogTitle>
           </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (editingNotice) {
              updateMutation.mutate(form);
            } else {
              createMutation.mutate({
                   ...form,
                   status: 'Draft',
                   created_by_name: user?.name || user?.full_name
                 });
            }
          }} className="space-y-4">
            <div>
              <Label>Title *</Label>
              <Input value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="Notice title" required />
            </div>
            <div>
              <Label>Content *</Label>
              <div className="flex gap-2 mb-2">
                <Textarea value={form.content} onChange={e => setForm({...form, content: e.target.value})} placeholder="Notice details..." rows={4} required className="flex-1" />
                <Button type="button" variant="outline" onClick={() => setShowTableBuilder(true)} className="self-start">
                  + Table
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
               <div>
                 <Label>Type</Label>
                <Select value={form.notice_type} onValueChange={v => setForm({...form, notice_type: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(TYPE_COLORS).map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Audience</Label>
                <Select value={form.target_audience} onValueChange={v => setForm({...form, target_audience: v, target_classes: []})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['All', 'Students', 'Parents', 'Staff', 'Teachers'].map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {form.target_audience === 'Students' && (
              <div>
                <Label>Target Classes <span className="text-gray-400 font-normal">(leave empty for all classes)</span></Label>
                <div className="mt-1.5 border rounded-xl p-3 bg-gray-50 grid grid-cols-4 sm:grid-cols-5 gap-2">
                  {['Nursery','LKG','UKG','1','2','3','4','5','6','7','8','9','10'].map(cls => {
                    const selected = form.target_classes?.includes(cls);
                    return (
                      <button
                        key={cls}
                        type="button"
                        onClick={() => {
                          const current = form.target_classes || [];
                          setForm({
                            ...form,
                            target_classes: selected
                              ? current.filter(c => c !== cls)
                              : [...current, cls]
                          });
                        }}
                        className={`flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                          selected
                            ? 'bg-[#1a237e] text-white border-[#1a237e]'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-[#1a237e]'
                        }`}
                      >
                        {selected && <Check className="h-3 w-3" />}
                        {cls}
                      </button>
                    );
                  })}
                </div>
                {form.target_classes?.length > 0 && (
                  <p className="text-xs text-indigo-600 mt-1.5 font-medium">
                    Selected: {form.target_classes.join(', ')}
                  </p>
                )}
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label>Publish Date</Label>
                <Input type="date" value={form.publish_date} onChange={e => setForm({...form, publish_date: e.target.value})} />
              </div>
              <div>
                <Label>Expiry Date</Label>
                <Input type="date" value={form.expiry_date} onChange={e => setForm({...form, expiry_date: e.target.value})} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="pinned" checked={form.is_pinned} onChange={e => setForm({...form, is_pinned: e.target.checked})} />
              <Label htmlFor="pinned" className="cursor-pointer">Pin this notice</Label>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => {
                setShowDialog(false);
                setEditingNotice(null);
                resetForm();
              }}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {editingNotice ? (updateMutation.isPending ? 'Updating...' : 'Update Notice') : (createMutation.isPending ? 'Posting...' : 'Post Notice')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
    </LoginRequired>
  );
}

function NoticeCard({ notice, isAdmin, user, onPublish, onDelete, onEdit, isUnread, onRead, onSubmit, onReject }) {
  const [expanded, setExpanded] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const typeColor = TYPE_COLORS[notice.notice_type] || 'bg-slate-100 text-slate-700';
  const isCreator = user && (notice.created_by_name === (user.full_name || user.name) || notice.created_by_name === user.email);
  const canEdit = (isCreator && (notice.status === 'Draft' || notice.status === 'Rejected')) || isAdmin;
  const canSubmit = isCreator && (notice.status === 'Draft' || notice.status === 'Rejected') && !isAdmin;

  const handleExpand = () => {
    setExpanded(true);
    if (isUnread) onRead();
  };

  return (
    <div className={`bg-white rounded-2xl shadow-sm overflow-hidden ${notice.is_pinned ? 'border-l-4 border-yellow-400' : ''} ${isUnread ? 'border-l-4 border-blue-500' : ''}`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          {isUnread && <div className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0 mt-2" />}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
               <Badge className={`text-xs ${typeColor} border-0`}>{notice.notice_type}</Badge>
               <Badge className={`text-xs border-0 ${
                 notice.status === 'Draft' ? 'bg-gray-100 text-gray-700' :
                 notice.status === 'PendingApproval' ? 'bg-amber-100 text-amber-700' :
                 notice.status === 'Published' ? 'bg-green-100 text-green-700' :
                 'bg-red-100 text-red-700'
               }`}>{notice.status}</Badge>
               {notice.is_pinned && <Pin className="h-3 w-3 text-yellow-500" />}
             </div>
            <h3 className={`text-sm ${isUnread ? 'font-extrabold text-gray-900' : 'font-bold text-gray-900'}`}>{notice.title}</h3>
            <div className={`text-gray-600 text-sm mt-1 ${!expanded ? 'line-clamp-2' : ''}`} dangerouslySetInnerHTML={{ __html: notice.content }}>
            </div>
            {notice.content.length > 100 && (
              <button onClick={handleExpand} className="text-blue-600 text-xs mt-1">
                {expanded ? 'Show less' : 'Read more'}
              </button>
            )}
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
               {notice.created_by_name && <span>By {notice.created_by_name}</span>}
               {notice.publish_date && (
                 <span className="flex items-center gap-1">
                   <Calendar className="h-3 w-3" />
                   {format(new Date(notice.publish_date), 'MMM d, yyyy')}
                 </span>
               )}
               {notice.target_audience && (
                 <span className="flex items-center gap-1">
                   <Users className="h-3 w-3" />
                   {notice.target_audience}
                   {notice.target_audience === 'Students' && notice.target_classes?.length > 0
                     ? ` (Class ${notice.target_classes.join(', ')})`
                     : notice.target_audience === 'Students' ? ' (All Classes)' : ''}
                 </span>
               )}
             </div>
             {notice.status === 'Rejected' && notice.rejection_reason && (
               <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                 <p className="font-semibold">Rejected: {notice.rejection_reason}</p>
                 {notice.rejected_at && <p className="text-[10px] text-red-600">at {format(new Date(notice.rejected_at), 'MMM d, HH:mm')}</p>}
               </div>
             )}
          </div>
        </div>
        {(isAdmin || canEdit) && (
          <div className="flex gap-2 mt-3 flex-wrap">
            {canEdit && (
              <Button size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700 text-xs" onClick={() => onEdit(notice)}>
                Edit
              </Button>
            )}
            {canSubmit && (
              <Button size="sm" className="flex-1 bg-amber-600 hover:bg-amber-700 text-xs" disabled={isSubmitting}
                onClick={async () => {
                  setIsSubmitting(true);
                  try {
                    const res = await base44.functions.invoke('submitNoticeForApproval', { noticeId: notice.id });
                    if (res.status === 200) {
                      toast.success('Notice submitted for approval');
                      onSubmit?.(notice.id);
                    } else {
                      toast.error(res.data?.error || 'Failed to submit');
                    }
                  } catch (e) {
                    toast.error('Error submitting notice');
                  } finally {
                    setIsSubmitting(false);
                  }
                }}>
                {isSubmitting ? 'Submitting...' : 'Submit for Approval'}
              </Button>
            )}
            {(isAdmin || canEdit) && (
              <Button size="sm" variant="destructive" className="flex-1" onClick={() => {
                if (confirm('Delete this notice?')) onDelete(notice.id);
              }}>
                Delete
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}