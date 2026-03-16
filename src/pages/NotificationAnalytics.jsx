import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Bell, BarChart3, Calendar } from 'lucide-react';
import LoginRequired from '@/components/LoginRequired';
import { format, subDays } from 'date-fns';

const TYPE_LABELS = {
  absent_notification: 'Absent Notification',
  fee_payment: 'Fee Payment',
  fee_reminder: 'Fee Reminder',
  marks_publish: 'Marks Published',
  hall_ticket_published: 'Hall Ticket',
  notice_posted: 'Notice',
  homework_published: 'Homework',
  diary_published: 'Diary',
};

const TYPE_COLORS = {
  absent_notification: 'bg-red-100 text-red-700',
  fee_payment: 'bg-green-100 text-green-700',
  fee_reminder: 'bg-amber-100 text-amber-700',
  marks_publish: 'bg-purple-100 text-purple-700',
  hall_ticket_published: 'bg-blue-100 text-blue-700',
  notice_posted: 'bg-indigo-100 text-indigo-700',
  homework_published: 'bg-pink-100 text-pink-700',
  diary_published: 'bg-teal-100 text-teal-700',
};

export default function NotificationAnalytics() {
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 29), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [queryDates, setQueryDates] = useState({ startDate: format(subDays(new Date(), 29), 'yyyy-MM-dd'), endDate: format(new Date(), 'yyyy-MM-dd') });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['push-analytics', queryDates.startDate, queryDates.endDate],
    queryFn: async () => {
      const staffRaw = localStorage.getItem('staff_session');
      const res = await base44.functions.invoke('getPushNotificationAnalytics', {
        startDate: queryDates.startDate,
        endDate: queryDates.endDate,
        _staffSession: staffRaw ? JSON.parse(staffRaw) : undefined,
      });
      return res.data;
    },
  });

  const pushByTypeEntries = data?.pushByType
    ? Object.entries(data.pushByType).sort((a, b) => b[1] - a[1])
    : [];

  const dailyChartData = data?.pushPerDay || [];

  return (
    <LoginRequired allowedRoles={['admin', 'principal']}>
      <div className="min-h-screen bg-gray-50 pb-8">
        {/* Header */}
        <div className="bg-[#1a237e] text-white px-4 py-6">
          <div className="flex items-center gap-3">
            <Bell className="h-6 w-6 text-yellow-400" />
            <div>
              <h1 className="text-xl font-bold">Push Notification Analytics</h1>
              <p className="text-blue-200 text-xs">Track push notification usage by date range</p>
            </div>
          </div>
        </div>

        <div className="px-4 py-5 space-y-5 max-w-4xl mx-auto">
          {/* Date Range Picker */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex-1">
                  <Label className="text-xs font-semibold text-gray-600 mb-1">From Date</Label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} max={endDate} />
                </div>
                <div className="flex-1">
                  <Label className="text-xs font-semibold text-gray-600 mb-1">To Date</Label>
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate} max={format(new Date(), 'yyyy-MM-dd')} />
                </div>
                <Button
                  onClick={() => setQueryDates({ startDate, endDate })}
                  disabled={isFetching}
                  className="bg-[#1a237e] hover:bg-[#283593] text-white min-w-[100px]"
                >
                  {isFetching ? 'Loading...' : 'Apply'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            </div>
          ) : data ? (
            <>
              {/* Total Push Sent */}
              <Card className="bg-gradient-to-r from-[#1a237e] to-[#3949ab] text-white">
                <CardContent className="p-5 flex items-center gap-4">
                  <div className="h-14 w-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
                    <Bell className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <p className="text-blue-200 text-sm">Total Push Notifications Sent</p>
                    <p className="text-4xl font-bold">{data.totalPushSent.toLocaleString()}</p>
                    <p className="text-blue-200 text-xs mt-1">
                      {queryDates.startDate} → {queryDates.endDate}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Breakdown by Type */}
              {pushByTypeEntries.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <BarChart3 className="h-4 w-4 text-[#1a237e]" />
                      <h2 className="text-sm font-bold text-gray-800">Push Notifications by Type</h2>
                    </div>
                    <div className="space-y-3">
                      {pushByTypeEntries.map(([type, count]) => {
                        const pct = data.totalPushSent > 0 ? Math.round((count / data.totalPushSent) * 100) : 0;
                        const colorClass = TYPE_COLORS[type] || 'bg-gray-100 text-gray-700';
                        const label = TYPE_LABELS[type] || type;
                        return (
                          <div key={type}>
                            <div className="flex items-center justify-between mb-1">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colorClass}`}>{label}</span>
                              <span className="text-sm font-bold text-gray-800">{count.toLocaleString()} <span className="text-gray-400 font-normal text-xs">({pct}%)</span></span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2">
                              <div className="bg-[#1a237e] h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Daily Push Chart */}
              {dailyChartData.length > 1 && (
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Calendar className="h-4 w-4 text-[#1a237e]" />
                      <h2 className="text-sm font-bold text-gray-800">Daily Push Trend</h2>
                    </div>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={dailyChartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => format(new Date(d), 'MMM d')} />
                        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                        <Tooltip labelFormatter={d => format(new Date(d), 'MMM d, yyyy')} />
                        <Bar dataKey="count" name="Push Sent" fill="#1a237e" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {data.totalPushSent === 0 && (
                <div className="bg-white rounded-2xl p-10 text-center shadow-sm">
                  <Bell className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">No push notifications sent in this date range.</p>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </LoginRequired>
  );
}