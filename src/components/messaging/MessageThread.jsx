import React from 'react';
import { format } from 'date-fns';
import { ArrowLeft, Reply } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function MessageThread({ messages, currentUserId, onBack, onReply }) {
  if (!messages || messages.length === 0) return null;
  const first = messages[0];

  return (
    <div className="flex flex-col h-full">
      <div className="bg-[#1a237e] text-white px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onBack}><ArrowLeft className="h-5 w-5" /></button>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{first.subject || '(No subject)'}</p>
          <p className="text-blue-200 text-xs">{messages.length} message{messages.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={onReply} size="sm" variant="outline" className="border-white text-white hover:bg-white/10 gap-1 text-xs">
          <Reply className="h-3 w-3" /> Reply
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map((msg) => {
          const isMe = msg.sender_id === currentUserId;
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${isMe ? 'bg-[#1a237e] text-white' : 'bg-white text-gray-800'}`}>
                <p className={`text-xs font-semibold mb-1 ${isMe ? 'text-blue-200' : 'text-blue-700'}`}>
                  {isMe ? 'You' : msg.sender_name}
                </p>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.body}</p>
                {msg.subject_area && (
                  <span className={`inline-block mt-1 text-[10px] px-2 py-0.5 rounded-full ${isMe ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-600'}`}>
                    {msg.subject_area}
                  </span>
                )}
                <p className={`text-[10px] mt-1.5 ${isMe ? 'text-blue-300' : 'text-gray-400'}`}>
                  {format(new Date(msg.created_date), 'dd MMM, hh:mm a')}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}