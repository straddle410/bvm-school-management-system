import { useEffect, useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Hook: returns unread notification counts for a staff member.
 * Also sets up real-time subscription + 30s polling fallback.
 *
 * Usage:
 *   const { badges, refetch } = useStaffNotificationBadges(staffEmail);
 *   // badges = { Messages: 2, Quiz: 1, Notices: 0, total: 3 }
 */
export function useStaffNotificationBadges(staffEmail) {
  const [badges, setBadges] = useState({ Messages: 0, Quiz: 0, Notices: 0, total: 0 });

  const fetchBadges = useCallback(async () => {
    if (!staffEmail) return;
    try {
      const [notifs, unreadMsgs] = await Promise.all([
        base44.entities.Notification.filter({ recipient_staff_id: staffEmail, is_read: false }),
        base44.entities.Message.filter({ recipient_id: staffEmail, is_read: false }),
      ]);

      const counts = { Messages: 0, Quiz: 0, Notices: 0 };
      for (const n of notifs) {
        if (n.type === 'student_message') counts.Messages++;
        else if (n.type === 'quiz_submitted') counts.Quiz++;
        else if (n.type === 'notice_posted_staff') counts.Notices++;
      }
      counts.Messages += unreadMsgs.length;
      counts.total = counts.Messages + counts.Quiz + counts.Notices;
      setBadges(counts);
    } catch {}
  }, [staffEmail]);

  useEffect(() => {
    if (!staffEmail) return;

    fetchBadges();
    const interval = setInterval(fetchBadges, 30000);

    const unsub1 = base44.entities.Notification.subscribe((event) => {
      if (
        (event.type === 'create' || event.type === 'update') &&
        event.data?.recipient_staff_id === staffEmail
      ) {
        fetchBadges();
      }
    });

    const unsub2 = base44.entities.Message.subscribe((event) => {
      if (
        (event.type === 'create' || event.type === 'update') &&
        event.data?.recipient_id === staffEmail
      ) {
        fetchBadges();
      }
    });

    return () => {
      clearInterval(interval);
      unsub1();
      unsub2();
    };
  }, [staffEmail, fetchBadges]);

  return { badges, refetch: fetchBadges };
}

/**
 * Marks all staff notifications of a given type as read.
 */
export async function markStaffNotificationsRead(staffEmail, type) {
  if (!staffEmail || !type) return;
  try {
    const unread = await base44.entities.Notification.filter({
      recipient_staff_id: staffEmail,
      type,
      is_read: false,
    });
    await Promise.all(unread.map(n => base44.entities.Notification.update(n.id, { is_read: true })));
  } catch {}
}

export default function StaffNotificationBadges() { return null; }