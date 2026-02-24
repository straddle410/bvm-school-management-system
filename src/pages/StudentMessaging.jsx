import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createPageUrl } from '@/utils';
import { PenSquare, Inbox, Send, RefreshCw, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  const queryClient = useQueryClient();

  useEffect(() => {
    const session = getStudentSession();
    if (!session) { window.location.href = createPageUrl('StudentLogin'); return; }
    setStudent(session);
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

  const handleSelectMessage = async (msg) => {
    const allMessages = [...inbox, ...sent];
    const threadId = msg.thread_id || msg.id;
    const threadMessages = allMessages
      .filter(m => m.thread_id === threadId || m.id === threadId)
      .sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
    setSelectedThread(threadMessages.length > 0 ? threadMessages : [msg]);

    if (!msg.is_read && msg.recipient_id === student?.student_id) {
      await base44.entities.Message.update(msg.id, { is_read: true });
      queryClient.invalidateQueries({ queryKey: ['student-messages-inbox'] });
    }
  };

  if (!student) return null;

  if (selectedThread) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto">
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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-md mx-auto pb-20">
      <div className="bg-[#1a237e] text-white px-4 py-4 flex items-center justify-between sticky top-0 z-40 shadow-md">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-6 w-6" />
          <h1 className="font-bold text-lg">Messages</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => queryClient.invalidateQueries({ queryKey: ['student-messages-inbox'] })}>
            <RefreshCw className="h-5 w-5 text-blue-200 hover:text-white" />
          </button>
          <Button onClick={() => setShowCompose(true)} size="sm" className="bg-white text-[#1a237e] hover:bg-blue-50 gap-1 text-xs">
            <PenSquare className="h-3.5 w-3.5" /> New
          </Button>
        </div>
      </div>

      <div className="flex border-b border-gray-200 bg-white sticky top-[60px] z-30">
        <button
          onClick={() => setTab('inbox')}
          className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 ${
            tab === 'inbox' ? 'text-[#1a237e] border-b-2 border-[#1a237e]' : 'text-gray-500'
          }`}
        >
          <Inbox className="h-4 w-4" /> Inbox
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">{unreadCount}</span>
          )}
        </button>
        <button
          onClick={() => setTab('sent')}
          className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 ${
            tab === 'sent' ? 'text-[#1a237e] border-b-2 border-[#1a237e]' : 'text-gray-500'
          }`}
        >
          <Send className="h-4 w-4" /> Sent
        </button>
      </div>

      <div className="bg-white flex-1">
        {tab === 'inbox' ? (
          loadingInbox ? <div className="text-center py-12 text-gray-400 text-sm">Loading...</div> : (
            <MessageList
              messages={[...inbox].sort((a, b) => new Date(b.created_date) - new Date(a.created_date))}
              currentUserId={student.student_id}
              onSelect={handleSelectMessage}
              emptyText="No messages yet"
            />
          )
        ) : (
          loadingSent ? <div className="text-center py-12 text-gray-400 text-sm">Loading...</div> : (
            <MessageList
              messages={[...sent].sort((a, b) => new Date(b.created_date) - new Date(a.created_date))}
              currentUserId={student.student_id}
              onSelect={handleSelectMessage}
              emptyText="No sent messages"
            />
          )
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