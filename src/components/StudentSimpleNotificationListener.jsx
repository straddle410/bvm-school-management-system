import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function StudentSimpleNotificationListener({ studentSession }) {
  useEffect(() => {
    if (!studentSession?.student_id) return;

    let unsubscribe1, unsubscribe2, unsubscribe3;

    const setup = async () => {
      try {
        // Subscribe to Notices
        unsubscribe1 = base44.entities.Notification.subscribe((event) => {
          if (event.type === 'create' && event.data?.type === 'notice_posted') {
            if (event.data?.recipient_student_id === studentSession.student_id) {
              toast.info(event.data.title, { description: event.data.message });
            }
          }
        });

        // Subscribe to Quizzes
        unsubscribe2 = base44.entities.Quiz.subscribe((event) => {
          if (event.type === 'update' && event.data?.status === 'Published') {
            if (event.data?.class_name === studentSession.class_name) {
              toast.info(`New Quiz: ${event.data.title}`, { 
                description: event.data.subject 
              });
            }
          }
        });

        // Subscribe to Messages
        unsubscribe3 = base44.entities.Message.subscribe((event) => {
          if (event.type === 'create') {
            const msg = event.data;
            if (msg.recipient_id === studentSession.student_id || msg.recipient_type === 'class') {
              toast.info(`Message from ${msg.sender_name}`, {
                description: msg.subject || msg.body.substring(0, 50)
              });
            }
          }
        });
      } catch (err) {
        console.error('Listener setup error:', err);
      }
    };

    setup();

    return () => {
      if (unsubscribe1) unsubscribe1();
      if (unsubscribe2) unsubscribe2();
      if (unsubscribe3) unsubscribe3();
    };
  }, [studentSession?.student_id, studentSession?.class_name]);

  return null;
}