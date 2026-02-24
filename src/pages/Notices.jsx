import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { getStaffSession } from '@/components/useStaffSession';
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
import { Bell, Pin, Plus, Megaphone, Calendar, Users } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from "sonner";
import TableBuilder from '@/components/TableBuilder';

const TYPE_COLORS = {
  General: 'bg-blue-100 text-blue-700',
  Exam: 'bg-purple-100 text-purple-700',
  Holiday: 'bg-red-100 text-red-700',
  PTM: 'bg-green-100 text-green-700',
  Fee: 'bg-amber-100 text-amber-700',
  Urgent: 'bg-red-500 text-white',
  Event: 'bg-pink-100 text-pink-700',
};

export default function Notices() {
  const [user, setUser] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [form, setForm] = useState({
    title: '',
    content: '',
    notice_type: 'General',
    target_audience: 'All',
    publish_date: format(new Date(), 'yyyy-MM-dd'),
    expiry_date: '',
    is_pinned: false
  });
  const [showTableBuilder, setShowTableBuilder] = useState(false);
  const [editingNotice, setEditingNotice] = useState(null);

  const queryClient = useQueryClient();

  useEffect(() => {
    setUser(getStaffSession());
    
    // Mark notice notifications as read if student
    const studentSession = localStorage.getItem('student_session');
    if (studentSession) {
      try {
        const studentData = JSON.parse(studentSession);
        markNoticeNotificationsAsRead(studentData.student_id);
      } catch {}
    }
  }, []);

  const markNoticeNotificationsAsRead = async (studentId) => {
    try {
      const unreadNotifications = await base44.entities.Notification.filter({
        recipient_student_id: studentId,
        type: 'notice_posted',
        is_read: false
      });
      
      for (const notif of unreadNotifications) {
        await base44.entities.Notification.update(notif.id, { is_read: true });
      }
    } catch (error) {
      console.debug('Error marking notifications as read:', error);
    }
  };

  const isStaff = user && ['Admin', 'Principal', 'Teacher', 'Staff'].includes(user.role);
  const isAdmin = user && ['Admin', 'Principal'].includes(user.role);

  const { data: notices = [], isLoading } = useQuery({
    queryKey: ['notices'],
    queryFn: () => base44.entities.Notice.list('-created_date')
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Notice.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['notices']);
      setShowDialog(false);
      resetForm();
      toast.success('Notice created');
    }
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Notice.update(editingNotice.id, data),
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
      publish_date: format(new Date(), 'yyyy-MM-dd'), expiry_date: '', is_pinned: false
    });
  };

  const openEditForm = (notice) => {
    setEditingNotice(notice);
    setForm({
      title: notice.title,
      content: notice.content,
      notice_type: notice.notice_type,
      target_audience: notice.target_audience,
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

  return (
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
          {isStaff && (
            <Button
              onClick={() => setShowDialog(true)}
              className="bg-yellow-400 text-gray-900 hover:bg-yellow-300 font-bold text-sm"
            >
              <Plus className="h-4 w-4 mr-1" /> Post
            </Button>
          )}
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
                <NoticeCard key={notice.id} notice={notice} isAdmin={isAdmin} user={user} onPublish={publishMutation.mutate} onDelete={deleteMutation.mutate} onEdit={openEditForm} />
              ))}
            </div>
          </div>
        )}

        {/* Regular Notices */}
        <div className="space-y-3">
          {regular.map(notice => (
            <NoticeCard key={notice.id} notice={notice} isAdmin={isAdmin} user={user} onPublish={publishMutation.mutate} onDelete={deleteMutation.mutate} onEdit={openEditForm} />
          ))}
        </div>

        {visibleNotices.length === 0 && !isLoading && (
          <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
            <Megaphone className="h-10 w-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">No notices available</p>
          </div>
        )}
      </div>

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
                status: isAdmin ? 'Published' : 'Draft',
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
                <Select value={form.target_audience} onValueChange={v => setForm({...form, target_audience: v})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['All', 'Students', 'Parents', 'Staff', 'Teachers'].map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
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
  );
}

function NoticeCard({ notice, isAdmin, user, onPublish, onDelete, onEdit }) {
  const [expanded, setExpanded] = useState(false);
  const typeColor = TYPE_COLORS[notice.notice_type] || 'bg-slate-100 text-slate-700';
  const canEdit = isAdmin || (user && notice.created_by_name === (user.full_name || user.name));

  return (
    <div className={`bg-white rounded-2xl shadow-sm overflow-hidden ${notice.is_pinned ? 'border-l-4 border-yellow-400' : ''}`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge className={`text-xs ${typeColor} border-0`}>{notice.notice_type}</Badge>
              {notice.status !== 'Published' && isAdmin && (
                <Badge className="text-xs bg-amber-100 text-amber-700 border-0">{notice.status}</Badge>
              )}
              {notice.is_pinned && <Pin className="h-3 w-3 text-yellow-500" />}
            </div>
            <h3 className="font-bold text-gray-900 text-sm">{notice.title}</h3>
            <div className={`text-gray-600 text-sm mt-1 ${!expanded ? 'line-clamp-2' : ''}`} dangerouslySetInnerHTML={{ __html: notice.content }}>
            </div>
            {notice.content.length > 100 && (
              <button onClick={() => setExpanded(!expanded)} className="text-blue-600 text-xs mt-1">
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
                </span>
              )}
            </div>
          </div>
        </div>
        {(isAdmin || canEdit) && (
          <div className="flex gap-2 mt-3">
            {canEdit && (
              <Button size="sm" className="flex-1 bg-blue-600 hover:bg-blue-700 text-xs" onClick={() => onEdit(notice)}>
                Edit
              </Button>
            )}
            {isAdmin && notice.status !== 'Published' && (
              <Button size="sm" className="flex-1 bg-green-600 hover:bg-green-700 text-xs" onClick={() => onPublish(notice.id)}>
                Publish
              </Button>
            )}
            {isAdmin && (
              <Button size="sm" variant="destructive" className={!canEdit ? 'w-full' : 'flex-1'} onClick={() => {
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