import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { PenSquare, Inbox, Send, RefreshCw, MessageSquare, ArrowLeft, CheckCheck } from 'lucide-react';
import ComposeMessage from '@/components/messaging/ComposeMessage';
import MessageList from '@/components/messaging/MessageList';
import MessageThread from '@/components/messaging/MessageThread';
import StudentMinimalFooterNav from '@/components/StudentMinimalFooterNav';

function getStudentSession() {
  try { return JSON.parse(localStorage.getItem('student_session')); } catch { return null; }
}

export default function StudentMessaging() {
  const [student, setStudent] = useState(null);
  const [tab, setTab] = useState('inbox');
  const [showCompose, setShowCompose] = useState(false);
  const [selectedThread, setSelectedThread] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [pendingMessageId, setPendingMessageId] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
     const session = getStudentSession();
     if (!session) { window.location.href = createPageUrl('StudentLogin'); return; }
     setStudent(session);

     // Check for deep-link messageId from push notification
     const urlParams = new URLSearchParams(window.location.search);
     const messageId = urlParams.get('messageId');
     if (messageId) setPendingMessageId(messageId);

     // Mark class_message notifications as read on page open
     if (session?.student_id) {
       base44.entities.Notification.filter({
         recipient_student_id: session.student_id,
         type: 'class_message',
         is_read: false,
       }).then(notifs => {
         if (!notifs.length) return;
         return Promise.all(notifs.map(n => base44.entities.Notification.update(n.id, { is_read: true })))
           .then(() => window.dispatchEvent(new CustomEvent('student-notifications-read')));
       }).catch(() => {});
     }
   }, []);

  const sender = student ? {
    id: student.student_id,
    name: student.name,
    role: 'student',
    academic_year: student.academic_year || '2024-25',
  } : null;

  const { data: inbox = [], isLoading: loadingInbox } = useQuery({
    queryKey: ['student-messages-inbox', student?.student_id],
    queryFn: async () => {
      const res = await base44.functions.invoke('listMyMessages', {
        folder: 'inbox', limit: 100,
        _studentId: student.student_id,
      });
      return res.data?.messages || [];
    },
    enabled: !!student,
    refetchInterval: 15000,
  });

  const { data: sent = [], isLoading: loadingSent } = useQuery({
    queryKey: ['student-messages-sent', student?.student_id],
    queryFn: async () => {
      const res = await base44.functions.invoke('listMyMessages', {
        folder: 'sent', limit: 100,
        _studentId: student.student_id,
      });
      return res.data?.messages || [];
    },
    enabled: !!student,
  });

  const unreadCount = inbox.filter(m => !m.is_read).length;

  // Auto-open message when deep-linked from push notification
  useEffect(() => {
    if (pendingMessageId && !loadingInbox && inbox.length > 0) {
      const target = inbox.find(m => m.id === pendingMessageId);
      if (target) {
        setPendingMessageId(null);
        handleSelectMessage(target);
      }
    }
  }, [pendingMessageId, inbox, loadingInbox]);

  const markAllInboxRead = async () => {
    const unreadMsgs = inbox.filter(m => !m.is_read && m.recipient_id === student?.student_id);

    if (unreadMsgs.length === 0) return;

    try {
      await base44.functions.invoke('markStudentNotificationsRead', {
        notification_ids: [],
        message_ids: unreadMsgs.map(m => m.id),
      });
    } catch {}

    queryClient.invalidateQueries({ queryKey: ['student-messages-inbox'] });
    queryClient.invalidateQueries({ queryKey: ['unread-message-count'] });
  };

  const handleSelectMessage = async (msg) => {
    const threadId = msg.thread_id || msg.id;
    // Use server-side thread fetch for correct access control and full thread history
    try {
      const res = await base44.functions.invoke('getMessageThread', {
        thread_id: threadId,
      });
      const threadMessages = res.status === 200 ? (res.data.messages || []) : [msg];
      setSelectedThread(threadMessages);
    } catch (err) {
      // If thread fetch fails, just show the single message
      setSelectedThread([msg]);
    }

    if (!msg.is_read && msg.recipient_id === student?.student_id) {
      try {
        await base44.functions.invoke('markStudentNotificationsRead', {
          notification_ids: [],
          message_ids: [msg.id],
        });
        queryClient.invalidateQueries({ queryKey: ['student-messages-inbox'] });
        queryClient.invalidateQueries({ queryKey: ['unread-message-count'] });
      } catch {}
    }
    };

  if (!student) return null;

  if (selectedThread) {
    return (
      <div className="min-h-screen bg-[#f0f4ff] flex flex-col max-w-md sm:max-w-xl mx-auto pb-24">
        <MessageThread
          messages={selectedThread}
          currentUserId={student.student_id}
          onBack={() => setSelectedThread(null)}
          onReply={() => { setReplyTo(selectedThread[0]); setShowCompose(true); }}
        />
        {showCompose && (
          <ComposeMessage
            sender={sender}
            replyTo={replyTo}
            onClose={() => { setShowCompose(false); setReplyTo(null); }}
            onSent={() => {
              queryClient.invalidateQueries({ queryKey: ['student-messages-inbox'] });
              queryClient.invalidateQueries({ queryKey: ['student-messages-sent'] });
              setSelectedThread(null);
            }}
          />
        )}
        <StudentMinimalFooterNav />
      </div>
    );
  }

  const activeMessages = tab === 'inbox'
    ? [...inbox].sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
    : [...sent].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

  return (
    <div className="min-h-screen bg-[#f0f4ff] flex flex-col max-w-md sm:max-w-xl mx-auto pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white px-4 pt-4 pb-6 sticky top-0 z-40 shadow-xl border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to={createPageUrl('StudentDashboard')} className="p-2 bg-slate-700/50 hover:bg-slate-600 rounded-lg transition min-h-[44px] min-w-[44px] flex items-center justify-center">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="font-bold text-base md:text-lg">Messages</h1>
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 inline-block mt-0.5">{unreadCount}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && tab === 'inbox' && (
              <button
                onClick={markAllInboxRead}
                className="flex items-center gap-1 bg-white/20 hover:bg-white/30 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all"
              >
                <CheckCheck className="h-3.5 w-3.5" /> All Read
              </button>
            )}
            <button
              onClick={() => queryClient.invalidateQueries({ queryKey: ['student-messages-inbox'] })}
              className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={() => setShowCompose(true)}
              className="flex items-center gap-1.5 bg-white text-[#1a237e] hover:bg-blue-50 px-3 py-2 rounded-xl text-xs font-bold shadow-sm transition-all"
            >
              <PenSquare className="h-3.5 w-3.5" /> New Message
            </button>
          </div>
        </div>
      </div>

      {/* Tabs — pill style */}
      <div className="px-4 -mt-3 z-30 relative">
        <div className="bg-white rounded-2xl shadow-sm p-1 flex gap-1">
          {[
            { key: 'inbox', label: 'Inbox', icon: Inbox },
            { key: 'sent',  label: 'Sent',  icon: Send },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-sm font-semibold transition-all ${
                tab === t.key
                  ? 'bg-gradient-to-r from-[#1a237e] to-[#3949ab] text-white shadow-md'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
              {t.key === 'inbox' && unreadCount > 0 && (
                <span className={`text-[10px] font-bold rounded-full px-1.5 py-0.5 ${tab === 'inbox' ? 'bg-white/20 text-white' : 'bg-red-500 text-white'}`}>
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Message list */}
      <div className="mt-3 mx-4 bg-white rounded-2xl shadow-sm overflow-hidden flex-1">
        {(tab === 'inbox' ? loadingInbox : loadingSent) ? (
          <div className="space-y-3 p-4">
            {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
          </div>
        ) : activeMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <MessageSquare className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">{tab === 'inbox' ? 'No messages yet' : 'No sent messages'}</p>
            {tab === 'inbox' && <p className="text-xs mt-1 text-gray-300">Messages from teachers will appear here</p>}
          </div>
        ) : (
          <MessageList
            messages={activeMessages}
            currentUserId={student.student_id}
            onSelect={handleSelectMessage}
            emptyText=""
          />
        )}
      </div>

      {showCompose && (
        <ComposeMessage
          sender={sender}
          onClose={() => setShowCompose(false)}
          onSent={() => {
            queryClient.invalidateQueries({ queryKey: ['student-messages-inbox'] });
            queryClient.invalidateQueries({ queryKey: ['student-messages-sent'] });
          }}
        />
      )}

      {/* Minimal HOME Footer Nav */}
      <nav className="fixed bottom-0 left-0 right-0 w-full z-50">
        <div className="mx-3 md:mx-4 mb-3 md:mb-4 bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.2)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] border border-white/60 dark:border-gray-700/60">
          <div className="flex items-center justify-center px-4 py-3">
            <Link
              to={createPageUrl('StudentDashboard')}
              className="flex flex-col items-center gap-1 px-6 py-3 transition-all min-h-[60px] justify-center"
            >
              <div className="bg-gradient-to-br from-[#1a237e] to-[#3949ab] shadow-md p-2.5 rounded-xl">
                <Home className="h-6 w-6 text-white" />
              </div>
              <span className="text-sm font-bold text-[#1a237e] dark:text-indigo-400">Home</span>
            </Link>
          </div>
        </div>
      </nav>
    </div>
  );
}