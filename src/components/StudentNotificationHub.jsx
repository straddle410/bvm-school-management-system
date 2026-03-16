/**
 * StudentNotificationHub
 * Single unified listener — replaces all individual notification listeners.
 * Handles: Messages, Notices, Quiz, Homework, Diary, Marks, Hall Tickets, Timetable.
 * Deduplicates toasts via seenRef. Respects all student notification preferences.
 */
import { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

// Map notification type → { prefKey, label }
const NOTIF_TYPE_MAP = {
  notice_posted:        { pref: 'notice_notifications',   label: '📢 New Notice' },
  diary_published:      { pref: null,                     label: '📓 Diary Updated' },
  marks_published:      { pref: 'marks_notifications',    label: '📊 Marks Published' },
  results_posted:       { pref: 'marks_notifications',    label: '🏆 Results Published' },
  hall_ticket_published:{ pref: null,                     label: '🎫 Hall Ticket Ready' },
  homework_published:   { pref: 'homework_notifications', label: '📝 New Homework' },
  timetable_updated:    { pref: null,                     label: '🗓️ Timetable Updated' },
  class_message:        { pref: 'message_notifications',  label: '💬 New Message' },
  fee_payment_received: { pref: null,                     label: '💰 Fee Payment Received', color: 'green' },
};

function playSound(prefs) {
  if (!prefs?.sound_enabled) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 800;
    osc.type = 'sine';
    const vol = prefs.sound_volume ?? 0.7;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch {}
}

function sendBrowserPush(title, body, prefs, notifType) {
  // Only send browser push for critical notifications: marks, hall tickets, fee payments
  const criticalTypes = ['marks_published', 'results_posted', 'hall_ticket_published', 'fee_payment_received'];
  if (!criticalTypes.includes(notifType)) return;
  
  if (!prefs?.browser_push_enabled) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try { new Notification(title, { body, icon: '/logo.png' }); } catch {}
}

function shouldShow(prefs, prefKey) {
  if (!prefs?.notifications_enabled) return false;
  if (prefKey && prefs[prefKey] === false) return false;
  return true;
}

export default function StudentNotificationHub({ studentSession }) {
  const seenRef = useRef(new Set());

  useEffect(() => {
    if (!studentSession?.student_id) return;

    const unsubscribers = [];
    let prefs = null;

    const setup = async () => {
      // Load preferences once
      try {
        const records = await base44.entities.StudentNotificationPreference.filter({
          student_id: studentSession.student_id,
        });
        prefs = records[0] || { notifications_enabled: true, sound_enabled: true };
      } catch {
        prefs = { notifications_enabled: true, sound_enabled: true };
      }

      if (!prefs.notifications_enabled) return;

      // ── 1. Notification entity (covers diary, notices, hall tickets, homework, timetable, class_message) ──
      // NOTE: marks_published notifications are ignored here — exam-level notifications
      // are now sent via Message entities by sendExamMarksPublishedNotification.
      unsubscribers.push(
        base44.entities.Notification.subscribe((event) => {
          if (event.type !== 'create') return;
          const n = event.data;
          if (!n || n.recipient_student_id !== studentSession.student_id) return;

          // Ignore per-subject marks notifications — handled by exam-level Message notifications
          if (n.type === 'marks_published') return;

          const dedupeKey = `notif-${n.id}`;
          if (seenRef.current.has(dedupeKey)) return;
          seenRef.current.add(dedupeKey);

          const config = NOTIF_TYPE_MAP[n.type];
          if (!config) return;
          if (!shouldShow(prefs, config.pref)) return;

          toast.info(n.title || config.label, { description: n.message });
          playSound(prefs);
          sendBrowserPush(n.title || config.label, n.message, prefs, n.type);
        })
      );

      // ── 2. Message entity (direct + class + section broadcasts) ──
      if (prefs.message_notifications !== false) {
        unsubscribers.push(
          base44.entities.Message.subscribe((event) => {
            if (event.type !== 'create') return;
            const msg = event.data;
            if (!msg) return;

            const dedupeKey = `msg-${msg.id}`;
            if (seenRef.current.has(dedupeKey)) return;

            const isForMe =
              (msg.recipient_type === 'individual' && msg.recipient_id === studentSession.student_id) ||
              (msg.recipient_type === 'class' && msg.recipient_class === studentSession.class_name) ||
              (msg.recipient_type === 'section' &&
                msg.recipient_class === studentSession.class_name &&
                msg.recipient_section === studentSession.section);

            if (!isForMe) return;
            seenRef.current.add(dedupeKey);

            const title = `Message from ${msg.sender_name}`;
            const desc = msg.subject || msg.body?.substring(0, 80);
            toast.info(title, { description: desc });
            playSound(prefs);
            // Push removed for messages to optimize credit usage
          })
        );
      }

      // ── 3. Quiz entity (published for this class — in case Notification record isn't created) ──
      if (prefs.quiz_notifications !== false) {
        unsubscribers.push(
          base44.entities.Quiz.subscribe((event) => {
            if (event.type !== 'update') return;
            const quiz = event.data;
            if (!quiz || quiz.class_name !== studentSession.class_name || quiz.status !== 'Published') return;

            const dedupeKey = `quiz-${quiz.id}`;
            if (seenRef.current.has(dedupeKey)) return;
            seenRef.current.add(dedupeKey);

            const title = `📝 New Quiz: ${quiz.title}`;
            const desc = quiz.subject;
            toast.info(title, { description: desc });
            playSound(prefs);
            // Push removed for quiz to optimize credit usage
          })
        );
      }

      // ── 4. Homework entity (published for this class/section) ──
      if (prefs.homework_notifications !== false) {
        unsubscribers.push(
          base44.entities.Homework.subscribe((event) => {
            if (event.type !== 'update') return;
            const hw = event.data;
            if (!hw || hw.status !== 'Published') return;
            if (hw.class_name !== studentSession.class_name) return;
            if (hw.section && hw.section !== 'All' && hw.section !== studentSession.section) return;

            const dedupeKey = `hw-${hw.id}`;
            if (seenRef.current.has(dedupeKey)) return;
            seenRef.current.add(dedupeKey);

            const title = `📝 New Homework: ${hw.title}`;
            const desc = `${hw.subject} — Due ${hw.due_date || 'TBD'}`;
            toast.info(title, { description: desc });
            playSound(prefs);
            // Push removed for homework to optimize credit usage
          })
        );
      }
    };

    setup();

    return () => unsubscribers.forEach(fn => fn?.());
  }, [studentSession?.student_id, studentSession?.class_name, studentSession?.section]);

  return null;
}