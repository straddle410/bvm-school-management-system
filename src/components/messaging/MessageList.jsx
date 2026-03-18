import React from 'react';
import { format } from 'date-fns';
import { Users, User, ChevronRight } from 'lucide-react';
import MessageTick from './MessageTick';

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
            className={`w-full flex items-start gap-3 px-4 py-5 md:py-6 hover:bg-gray-50 active:bg-gray-100 text-left transition-colors min-h-[64px] md:min-h-[72px] ${!msg.is_read && !isMe ? 'bg-blue-50/60' : ''}`}
          >
            <div className={`h-12 w-12 md:h-14 md:w-14 rounded-full flex items-center justify-center text-white text-sm md:text-base font-bold flex-shrink-0 shadow-sm ${
              isMe ? 'bg-gray-400' : msg.sender_role === 'teacher' ? 'bg-green-500' : msg.sender_role === 'admin' ? 'bg-purple-500' : 'bg-blue-500'
            }`}>
              {isBroadcast ? <Users className="h-5 w-5" /> : (isMe ? msg.recipient_name?.[0] : msg.sender_name?.[0]) || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 flex-1">
                <p className={`text-base md:text-lg truncate ${!msg.is_read && !isMe ? 'font-bold text-gray-900' : 'font-semibold text-gray-800'}`}>
                  {isMe ? `To: ${msg.recipient_name || (isBroadcast ? `Class ${msg.recipient_class}` : '')}` : msg.sender_name}
                </p>
                <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                  {isMe && <MessageTick message={msg} size={14} />}
                  <span className="text-xs md:text-sm text-gray-500 whitespace-nowrap">
                    {format(new Date(msg.created_date), 'dd MMM')}
                  </span>
                </div>
              </div>
              {msg.subject && <p className="text-sm md:text-base text-gray-600 truncate mt-1">{msg.subject}</p>}
              <p className="text-sm md:text-base text-gray-500 truncate mt-1">{msg.body}</p>
            </div>
            {!msg.is_read && !isMe && <div className="h-3 w-3 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" />}
          </button>
        );
      })}
    </div>
  );
}