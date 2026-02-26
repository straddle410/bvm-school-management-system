import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PenSquare, Inbox, Send, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ComposeMessage from '@/components/messaging/ComposeMessage';
import MessageList from '@/components/messaging/MessageList';
import MessageThread from '@/components/messaging/MessageThread';
import { useStaffNotificationBadges, markStaffNotificationsRead } from '@/components/StaffNotificationBadges';

function getCurrentUser() {
  // First check staff_session (custom teacher/staff login)
  try {
    const ss = localStorage.getItem('staff_session');
    if (ss) {
      const staff = JSON.parse(ss);
      if (staff?.email) return { email: staff.email, full_name: staff.full_name, role: staff.role, isStaffSession: true };
    }
  } catch {}
  return null;
}

export default function Messaging() {
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('inbox');
  const [showCompose, setShowCompose] = useState(false);
  const [selectedThread, setSelectedThread] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    // Try staff_session first, then base44 auth
    const staffUser = getCurrentUser();
    if (staffUser) {
      setUser(staffUser);
    } else {
      base44.auth.me().then(u => setUser(u)).catch(() => {});
    }
  }, []);

  const sender = user ? {
    id: user.email,
    name: user.full_name,
    role: (user.role === 'admin' || user.role === 'Admin') ? 'admin' : 'teacher',
    academic_year: user?.academic_year || '2024-25'
  } : null;

  const { data: inbox = [], isLoading: loadingInbox } = useQuery({
    queryKey: ['messages-inbox', user?.email],
    queryFn: () => base44.entities.Message.filter({ recipient_id: user.email }),
    enabled: !!user,
    refetchInterval: 15000,
  });

  const { data: sent = [], isLoading: loadingSent } = useQuery({
    queryKey: ['messages-sent', user?.email],
    queryFn: () => base44.entities.Message.filter({ sender_id: user.email }),
    enabled: !!user,
  });

  // Real-time staff badge hook
  const { badges: staffBadges } = useStaffNotificationBadges(user?.email);

  const directUnread = inbox.filter(m => !m.is_read).length;
  // staffBadges.Messages includes both direct unread + student_message notifs — use whichever is higher
  const unreadCount = Math.max(directUnread, staffBadges.Messages || 0);

  const markAllInboxRead = async () => {
    const unreadMsgs = inbox.filter(m => !m.is_read && m.recipient_id === user?.email);
    await Promise.all(unreadMsgs.map(m => base44.entities.Message.update(m.id, { is_read: true })));
    if (user?.email) await markStaffNotificationsRead(user.email, 'student_message');
    queryClient.invalidateQueries({ queryKey: ['messages-inbox'] });
  };

  const handleSelectMessage = async (msg) => {
    // Group by thread
    const allMessages = [...inbox, ...sent];
    const threadId = msg.thread_id || msg.id;
    const threadMessages = allMessages
      .filter(m => m.thread_id === threadId || m.id === threadId)
      .sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
    setSelectedThread(threadMessages.length > 0 ? threadMessages : [msg]);

    // Mark as read
    if (!msg.is_read && msg.recipient_id === user?.email) {
      await base44.entities.Message.update(msg.id, { is_read: true });
      queryClient.invalidateQueries({ queryKey: ['messages-inbox'] });
    }
  };

  if (selectedThread) {
    return (
      <div className="flex flex-col h-screen bg-gray-50 w-full overflow-x-hidden">
        <MessageThread
          messages={selectedThread}
          currentUserId={user?.email}
          onBack={() => setSelectedThread(null)}
          onReply={() => { setReplyTo(selectedThread[0]); setShowCompose(true); }}
        />
        {showCompose && (
          <ComposeMessage
            sender={sender}
            replyTo={replyTo}
            onClose={() => { setShowCompose(false); setReplyTo(null); }}
            onSent={() => {
              queryClient.invalidateQueries({ queryKey: ['messages-inbox'] });
              queryClient.invalidateQueries({ queryKey: ['messages-sent'] });
              setSelectedThread(null);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 w-full overflow-x-hidden">
      <div className="bg-[#1a237e] text-white px-3 sm:px-4 py-4 flex items-center justify-between sticky top-0 z-40 shadow-md gap-2">
        <h1 className="font-bold text-lg sm:text-xl truncate">Messages</h1>
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <button onClick={() => queryClient.invalidateQueries({ queryKey: ['messages-inbox'] })}>
            <RefreshCw className="h-5 w-5 text-blue-200 hover:text-white" />
          </button>
          <Button onClick={() => setShowCompose(true)} size="sm" className="bg-white text-[#1a237e] hover:bg-blue-50 gap-1 text-xs sm:text-sm">
            <PenSquare className="h-4 w-4" /> <span className="hidden sm:inline">Compose</span>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 bg-white sticky top-[60px] z-30">
        <button
          onClick={() => setTab('inbox')}
          className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
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
          className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
            tab === 'sent' ? 'text-[#1a237e] border-b-2 border-[#1a237e]' : 'text-gray-500'
          }`}
        >
          <Send className="h-4 w-4" /> Sent
        </button>
      </div>

      <div className="bg-white min-h-[calc(100vh-120px)]">
        {tab === 'inbox' ? (
          loadingInbox ? (
            <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>
          ) : (
            <MessageList
              messages={[...inbox].sort((a, b) => new Date(b.created_date) - new Date(a.created_date))}
              currentUserId={user?.email}
              onSelect={handleSelectMessage}
              emptyText="Your inbox is empty"
            />
          )
        ) : (
          loadingSent ? (
            <div className="text-center py-12 text-gray-400 text-sm">Loading...</div>
          ) : (
            <MessageList
              messages={[...sent].sort((a, b) => new Date(b.created_date) - new Date(a.created_date))}
              currentUserId={user?.email}
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
            queryClient.invalidateQueries({ queryKey: ['messages-inbox'] });
            queryClient.invalidateQueries({ queryKey: ['messages-sent'] });
          }}
        />
      )}
    </div>
  );
}