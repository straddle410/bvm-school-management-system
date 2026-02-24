import React from 'react';
import { format } from 'date-fns';
import { Users, User, ChevronRight } from 'lucide-react';

export default function MessageList({ messages, currentUserId, onSelect, emptyText = 'No messages' }) {
  if (messages.length === 0) {
    return <div className="text-center py-12 text-gray-400 text-sm">{emptyText}</div>;
  }

  return (
    <div className="divide-y divide-gray-100">
      {messages.map((msg) => {
        const isMe = msg.sender_id === currentUserId;
        const isBroadcast = msg.recipient_type !== 'individual';
        return (
          <button
            key={msg.id}
            onClick={() => onSelect(msg)}
            className={`w-full flex items-start gap-3 px-4 py-4 hover:bg-gray-50 text-left transition-colors ${!msg.is_read && !isMe ? 'bg-blue-50/60' : ''}`}
          >
            <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 ${
              isMe ? 'bg-gray-400' : msg.sender_role === 'teacher' ? 'bg-green-500' : msg.sender_role === 'admin' ? 'bg-purple-500' : 'bg-blue-500'
            }`}>
              {isBroadcast ? <Users className="h-5 w-5" /> : (isMe ? msg.recipient_name?.[0] : msg.sender_name?.[0]) || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className={`text-sm truncate ${!msg.is_read && !isMe ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>
                  {isMe ? `To: ${msg.recipient_name || (isBroadcast ? `Class ${msg.recipient_class}` : '')}` : msg.sender_name}
                </p>
                <span className="text-[10px] text-gray-400 flex-shrink-0">
                  {format(new Date(msg.created_date), 'dd MMM')}
                </span>
              </div>
              {msg.subject && <p className="text-xs text-gray-600 truncate mt-0.5">{msg.subject}</p>}
              <p className="text-xs text-gray-400 truncate mt-0.5">{msg.body}</p>
            </div>
            {!msg.is_read && !isMe && <div className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0 mt-1" />}
          </button>
        );
      })}
    </div>
  );
}