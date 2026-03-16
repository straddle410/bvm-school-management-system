import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { PenSquare, Inbox, Send, RefreshCw, MessageSquare, ArrowLeft, CheckCheck } from 'lucide-react';
import ComposeMessage from '@/components/messaging/ComposeMessage';
import MessageList from '@/components/messaging/MessageList';
import MessageThread from '@/components/messaging/MessageThread';
import StudentBottomNav from '@/components/StudentBottomNav';

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
    queryFn: () => base44.entities.Message.filter({ recipient_id: student.student_id }),
    enabled: !!student,
    refetchInterval: 15000,
  });

  const { data: sent = [], isLoading: loadingSent } = useQuery({
    queryKey: ['student-messages-sent', student?.student_id],
    queryFn: () => base44.entities.Message.filter({ sender_id: student.student_id }),
    enabled: !!student,
  });

  const unreadCount = inbox.filter(m => !m.is_read).length;

  const markAllInboxRead = async () => {
    const unreadMsgs = inbox.filter(m => !m.is_read && m.recipient_id === student?.student_id);
    
    // FIX #3: Update BOTH Message and linked Notification entities
    await Promise.all(unreadMsgs.map(m => base44.entities.Message.update(m.id, { is_read: true })));
    
    // Also mark linked notifications as read so badge updates correctly
    await Promise.all(unreadMsgs.map(async (m) => {
      try {
        const linkedNotif = await base44.entities.Notification.filter({
          type: 'class_message',
          related_entity_id: m.id,
          recipient_student_id: student.student_id,
        });
        if (linkedNotif.length > 0) {
          await base44.entities.Notification.update(linkedNotif[0].id, { is_read: true });
        }
      } catch {}
    }));
    
    queryClient.invalidateQueries({ queryKey: ['student-messages-inbox'] });
    queryClient.invalidateQueries({ queryKey: ['unread-message-count'] });
  };

  const handleSelectMessage = async (msg) => {
    const allMessages = [...inbox, ...sent];
    const threadId = msg.thread_id || msg.id;
    const threadMessages = allMessages
      .filter(m => m.thread_id === threadId || m.id === threadId)
      .sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
    setSelectedThread(threadMessages.length > 0 ? threadMessages : [msg]);

    if (!msg.is_read && msg.recipient_id === student?.student_id) {
      await base44.entities.Message.update(msg.id, { is_read: true });
      
      // FIX #3: Also mark linked notification as read
      try {
        const linkedNotif = await base44.entities.Notification.filter({
          type: 'class_message',
          related_entity_id: msg.id,
          recipient_student_id: student.student_id,
        });
        if (linkedNotif.length > 0) {
          await base44.entities.Notification.update(linkedNotif[0].id, { is_read: true });
        }
      } catch {}
      
      queryClient.invalidateQueries({ queryKey: ['student-messages-inbox'] });
      queryClient.invalidateQueries({ queryKey: ['unread-message-count'] });
    }
  };

  if (!student) return null;

  if (selectedThread) {
    return (
      <div className="min-h-screen bg-[#f0f4ff] flex flex-col max-w-md sm:max-w-xl mx-auto">
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
        <StudentBottomNav currentPage="StudentMessaging" />
      </div>
    );
  }

  const activeMessages = tab === 'inbox'
    ? [...inbox].sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
    : [...sent].sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

  return (
    <div className="min-h-screen bg-[#f0f4ff] flex flex-col max-w-md sm:max-w-xl mx-auto pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#1a237e] to-[#3949ab] text-white px-4 pt-4 pb-6 sticky top-0 z-40 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link to={createPageUrl('StudentDashboard')} className="p-1 hover:bg-white/20 rounded-lg transition mr-1">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <MessageSquare className="h-5 w-5 text-blue-200" />
            <h1 className="font-bold text-lg">Messages</h1>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">{unreadCount}</span>
            )}
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

      <StudentBottomNav currentPage="StudentMessaging" />
    </div>
  );
}