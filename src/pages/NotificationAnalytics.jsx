import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, Users, Users2, TrendingUp, AlertCircle } from 'lucide-react';

export default function NotificationAnalytics() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLogs = async () => {
      try {
        const data = await base44.entities.PushNotificationLog.list('-sent_date', 500);
        setLogs(data || []);
      } catch (err) {
        console.error('Failed to load logs:', err);
      } finally {
        setLoading(false);
      }
    };
    loadLogs();
  }, []);

  if (loading) {
    return <div className="p-4 text-center">Loading analytics...</div>;
  }

  const studentLogs = logs.filter(l => l.target_type === 'student');
  const staffLogs = logs.filter(l => l.target_type === 'staff');
  const failedLogs = logs.filter(l => l.status === 'failed');
  const totalRecipients = logs.reduce((sum, l) => sum + (l.recipients_count || 0), 0);

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Notification Analytics</h1>
        <p className="text-gray-600">Track all push notifications sent to students and staff</p>
      </div>

      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="summary" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Summary
          </TabsTrigger>
          <TabsTrigger value="students" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Students
          </TabsTrigger>
          <TabsTrigger value="staff" className="flex items-center gap-2">
            <Users2 className="h-4 w-4" />
            Staff
          </TabsTrigger>
          <TabsTrigger value="delivery" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Delivery
          </TabsTrigger>
          <TabsTrigger value="failed" className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Failed
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Summary */}
        <TabsContent value="summary" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Notifications</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{logs.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Recipients</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{totalRecipients}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Success Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {logs.length > 0
                    ? `${Math.round((logs.filter(l => l.status === 'sent').length / logs.length) * 100)}%`
                    : '0%'}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Notifications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left py-2 px-2">Date</th>
                      <th className="text-left py-2 px-2">Title</th>
                      <th className="text-left py-2 px-2">Type</th>
                      <th className="text-left py-2 px-2">Recipients</th>
                      <th className="text-left py-2 px-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.slice(0, 10).map((log) => (
                      <tr key={log.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-2">
                          {new Date(log.sent_date).toLocaleDateString('en-IN')}
                        </td>
                        <td className="py-2 px-2 font-medium">{log.title}</td>
                        <td className="py-2 px-2">
                          <span className="capitalize bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                            {log.target_type}
                          </span>
                        </td>
                        <td className="py-2 px-2">{log.recipients_count}</td>
                        <td className="py-2 px-2">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              log.status === 'sent'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {log.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Students */}
        <TabsContent value="students">
          <Card>
            <CardHeader>
              <CardTitle>Student Notifications ({studentLogs.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left py-2 px-2">Date</th>
                      <th className="text-left py-2 px-2">Title</th>
                      <th className="text-left py-2 px-2">Recipients</th>
                      <th className="text-left py-2 px-2">Context</th>
                      <th className="text-left py-2 px-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentLogs.map((log) => (
                      <tr key={log.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-2">
                          {new Date(log.sent_date).toLocaleDateString('en-IN')}
                        </td>
                        <td className="py-2 px-2 font-medium">{log.title}</td>
                        <td className="py-2 px-2">{log.recipients_count}</td>
                        <td className="py-2 px-2 text-gray-600">{log.context_type}</td>
                        <td className="py-2 px-2">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              log.status === 'sent'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {log.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {studentLogs.length === 0 && (
                  <p className="text-center py-4 text-gray-500">No student notifications found</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Staff */}
        <TabsContent value="staff">
          <Card>
            <CardHeader>
              <CardTitle>Staff Notifications ({staffLogs.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left py-2 px-2">Date</th>
                      <th className="text-left py-2 px-2">Title</th>
                      <th className="text-left py-2 px-2">Recipients</th>
                      <th className="text-left py-2 px-2">Context</th>
                      <th className="text-left py-2 px-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffLogs.map((log) => (
                      <tr key={log.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-2">
                          {new Date(log.sent_date).toLocaleDateString('en-IN')}
                        </td>
                        <td className="py-2 px-2 font-medium">{log.title}</td>
                        <td className="py-2 px-2">{log.recipients_count}</td>
                        <td className="py-2 px-2 text-gray-600">{log.context_type}</td>
                        <td className="py-2 px-2">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              log.status === 'sent'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {log.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {staffLogs.length === 0 && (
                  <p className="text-center py-4 text-gray-500">No staff notifications found</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Delivery */}
        <TabsContent value="delivery">
          <Card>
            <CardHeader>
              <CardTitle>Delivery Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left py-2 px-2">Title</th>
                      <th className="text-left py-2 px-2">Recipients Count</th>
                      <th className="text-left py-2 px-2">OneSignal ID</th>
                      <th className="text-left py-2 px-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-2 font-medium">{log.title}</td>
                        <td className="py-2 px-2">{log.recipients_count}</td>
                        <td className="py-2 px-2 text-xs font-mono text-gray-600 truncate max-w-xs">
                          {log.one_signal_notification_id || 'N/A'}
                        </td>
                        <td className="py-2 px-2">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              log.status === 'sent'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {log.status.toUpperCase()}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {logs.length === 0 && (
                  <p className="text-center py-4 text-gray-500">No notifications found</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 5: Failed */}
        <TabsContent value="failed">
          <Card>
            <CardHeader>
              <CardTitle>Failed Notifications ({failedLogs.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left py-2 px-2">Date</th>
                      <th className="text-left py-2 px-2">Title</th>
                      <th className="text-left py-2 px-2">Type</th>
                      <th className="text-left py-2 px-2">Error Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {failedLogs.map((log) => (
                      <tr key={log.id} className="border-b hover:bg-red-50">
                        <td className="py-2 px-2 text-gray-600">
                          {new Date(log.sent_date).toLocaleString('en-IN')}
                        </td>
                        <td className="py-2 px-2 font-medium">{log.title}</td>
                        <td className="py-2 px-2">
                          <span className="capitalize bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                            {log.target_type}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-red-600 font-medium">
                          {log.error_message || 'Unknown error'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {failedLogs.length === 0 && (
                  <p className="text-center py-4 text-gray-500">No failed notifications found</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}