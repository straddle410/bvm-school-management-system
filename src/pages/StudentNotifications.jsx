import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Bell, X } from 'lucide-react';
import { format } from 'date-fns';

export default function StudentNotifications() {
  const [studentSession, setStudentSession] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    try {
      const session = JSON.parse(localStorage.getItem('student_session'));
      setStudentSession(session);
    } catch {}
  }, []);

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', studentSession?.username],
    queryFn: () => {
      if (!studentSession?.username) return [];
      return base44.entities.Notification.filter({
        recipient_email: studentSession.username
      }, '-created_date');
    },
    enabled: !!studentSession?.username,
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id) => base44.entities.Notification.update(id, { is_read: true }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const deleteNotificationMutation = useMutation({
    mutationFn: (id) => base44.entities.Notification.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <PageHeader title="Notifications" />

      <div className="max-w-2xl mx-auto space-y-4">
        {notifications.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-gray-500">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No notifications yet</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {unreadCount > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                You have {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
              </div>
            )}
            <div className="space-y-3">
              {notifications.map(notification => (
                <Card
                  key={notification.id}
                  className={!notification.is_read ? 'bg-blue-50 border-blue-200' : ''}
                >
                  <CardContent className="p-4">
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <h3 className="font-semibold text-sm">{notification.title}</h3>
                            <p className="text-sm text-gray-700 mt-1">{notification.message}</p>
                            <p className="text-xs text-gray-500 mt-2">
                              {format(new Date(notification.created_date), 'MMM d, yyyy h:mm a')}
                            </p>
                          </div>
                          {!notification.is_read && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full mt-1 flex-shrink-0" />
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteNotificationMutation.mutate(notification.id)}
                        className="text-gray-400 hover:text-red-600"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    {!notification.is_read && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => markAsReadMutation.mutate(notification.id)}
                        className="mt-3 w-full text-xs"
                      >
                        Mark as Read
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}