import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bell, Users, TrendingUp, AlertCircle, RefreshCw, MessageCircle, CheckCircle2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

const COLORS_STATUS = ['#22c55e', '#ef4444'];
const COLORS_USE_CASE = ['#3b82f6', '#f59e0b', '#8b5cf6', '#22c55e'];

export default function NotificationAnalytics() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterUseCase, setFilterUseCase] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [waAvailability, setWaAvailability] = useState({ available: 0, unavailable: 0 });

  const loadData = async () => {
    setLoading(true);
    try {
      const [allLogs, students] = await Promise.all([
        base44.entities.WhatsAppMessageLog.list('-timestamp_sent', 500),
        base44.entities.Student.filter({ status: 'Published', is_deleted: false, is_active: true }),
      ]);
      setLogs(allLogs || []);

      // is_whatsapp_available is never populated in this system.
      // Use parent_phone as the real indicator of WhatsApp reachability.
      const available = students.filter(s => s.parent_phone && s.parent_phone.trim() !== '').length;
      setWaAvailability({ available, unavailable: students.length - available });
    } catch (err) {
      console.error('Failed to load WhatsApp analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  // Apply filters
  const filteredLogs = logs.filter(log => {
    if (filterUseCase && log.use_case !== filterUseCase) return false;
    if (filterDateFrom && log.timestamp_sent < filterDateFrom) return false;
    if (filterDateTo && log.timestamp_sent > filterDateTo + 'T23:59:59') return false;
    return true;
  });

  // Metrics
  const totalSent = filteredLogs.length;
  const delivered = filteredLogs.filter(l => l.status === 'delivered').length;
  const failed = filteredLogs.filter(l => l.status === 'failed').length;
  const successRate = totalSent > 0 ? Math.round((delivered / totalSent) * 100) : 0;

  // Chart: Status breakdown
  const statusData = [
    { name: 'Delivered', count: delivered },
    { name: 'Failed', count: failed },
  ];

  // Chart: Daily trend (last 7 days)
  const dailyData = filteredLogs.reduce((acc, log) => {
    const date = new Date(log.timestamp_sent).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
    const existing = acc.find(d => d.date === date);
    if (existing) existing.count += 1;
    else acc.push({ date, count: 1 });
    return acc;
  }, []).slice(-7);

  // Chart: Use case split
  const useCaseData = ['FeeReminder', 'FeePayment', 'Absent', 'Notice'].map(uc => ({
    name: uc,
    count: filteredLogs.filter(l => l.use_case === uc).length,
  }));

  // WhatsApp availability chart
  const availabilityData = [
    { name: 'Available', count: waAvailability.available },
    { name: 'Unavailable', count: waAvailability.unavailable },
  ];

  const failedLogs = filteredLogs.filter(l => l.status === 'failed');

  if (loading) {
    return <div className="p-4 text-center">Loading WhatsApp analytics...</div>;
  }

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2">WhatsApp Notification Analytics</h1>
          <p className="text-gray-600">Track all WhatsApp messages sent to parents</p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Select value={filterUseCase || '__all__'} onValueChange={v => setFilterUseCase(v === '__all__' ? '' : v)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All Use Cases" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">All Use Cases</SelectItem>
            <SelectItem value="FeeReminder">Fee Reminder</SelectItem>
            <SelectItem value="FeePayment">Fee Payment</SelectItem>
            <SelectItem value="Absent">Absent</SelectItem>
            <SelectItem value="Notice">Notice</SelectItem>
          </SelectContent>
        </Select>
        <input
          type="date"
          value={filterDateFrom}
          onChange={e => setFilterDateFrom(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
          placeholder="From"
        />
        <input
          type="date"
          value={filterDateTo}
          onChange={e => setFilterDateTo(e.target.value)}
          className="border rounded-lg px-3 py-2 text-sm"
          placeholder="To"
        />
        {(filterUseCase || filterDateFrom || filterDateTo) && (
          <button
            onClick={() => { setFilterUseCase(''); setFilterDateFrom(''); setFilterDateTo(''); }}
            className="text-sm text-red-600 hover:underline px-2"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-600">Total Sent</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{totalSent}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-600">Delivered</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-green-600">{delivered}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-600">Failed</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-red-600">{failed}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-gray-600">Success Rate</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-blue-600">{successRate}%</div></CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Daily Trend */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Daily Messages (Last 7)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Status Breakdown */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Delivered vs Failed</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={statusData} cx="50%" cy="50%" outerRadius={60} dataKey="count"
                  label={({ name, count }) => `${name}: ${count}`} labelLine={false}>
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS_STATUS[i]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Use Case Split */}
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Use Case Split</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={useCaseData} cx="50%" cy="50%" outerRadius={60} dataKey="count"
                  label={({ name, count }) => count > 0 ? `${name}: ${count}` : ''} labelLine={false}>
                  {useCaseData.map((_, i) => <Cell key={i} fill={COLORS_USE_CASE[i]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="summary" className="flex items-center gap-2">
            <Bell className="h-4 w-4" /> Summary
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4" /> All Logs
          </TabsTrigger>
          <TabsTrigger value="availability" className="flex items-center gap-2">
            <Users className="h-4 w-4" /> WA Availability
          </TabsTrigger>
          <TabsTrigger value="failed" className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" /> Failed
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Summary */}
        <TabsContent value="summary">
          <Card>
            <CardHeader><CardTitle>Recent Messages</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left py-2 px-2">Date</th>
                      <th className="text-left py-2 px-2">Student ID</th>
                      <th className="text-left py-2 px-2">Phone</th>
                      <th className="text-left py-2 px-2">Use Case</th>
                      <th className="text-left py-2 px-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.slice(0, 15).map(log => (
                      <tr key={log.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-2">{new Date(log.timestamp_sent).toLocaleDateString('en-IN')}</td>
                        <td className="py-2 px-2 font-mono text-xs">{log.student_id}</td>
                        <td className="py-2 px-2">{log.phone_number_used}</td>
                        <td className="py-2 px-2">
                          <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs">{log.use_case}</span>
                        </td>
                        <td className="py-2 px-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            log.status === 'delivered' ? 'bg-green-100 text-green-800' :
                            log.status === 'failed' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>{log.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredLogs.length === 0 && <p className="text-center py-4 text-gray-500">No messages found</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: All Logs */}
        <TabsContent value="logs">
          <Card>
            <CardHeader><CardTitle>All WhatsApp Logs ({filteredLogs.length})</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left py-2 px-2">Date</th>
                      <th className="text-left py-2 px-2">Student ID</th>
                      <th className="text-left py-2 px-2">Phone</th>
                      <th className="text-left py-2 px-2">Use Case</th>
                      <th className="text-left py-2 px-2">Template ID</th>
                      <th className="text-left py-2 px-2">Status</th>
                      <th className="text-left py-2 px-2">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map(log => (
                      <tr key={log.id} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-2">{new Date(log.timestamp_sent).toLocaleDateString('en-IN')}</td>
                        <td className="py-2 px-2 font-mono text-xs">{log.student_id}</td>
                        <td className="py-2 px-2">{log.phone_number_used}</td>
                        <td className="py-2 px-2">
                          <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs">{log.use_case}</span>
                        </td>
                        <td className="py-2 px-2 text-xs text-gray-500">{log.template_id}</td>
                        <td className="py-2 px-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            log.status === 'delivered' ? 'bg-green-100 text-green-800' :
                            log.status === 'failed' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>{log.status}</span>
                        </td>
                        <td className="py-2 px-2 text-xs text-red-500">{log.error_reason || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredLogs.length === 0 && <p className="text-center py-4 text-gray-500">No logs found</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: WA Availability */}
        <TabsContent value="availability">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle>WhatsApp Availability</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-3xl font-bold text-green-600">{waAvailability.available}</p>
                    <p className="text-sm text-gray-600 mt-1">WhatsApp Available</p>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-3xl font-bold text-red-600">{waAvailability.unavailable}</p>
                    <p className="text-sm text-gray-600 mt-1">Not Available</p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={availabilityData} cx="50%" cy="50%" outerRadius={70} dataKey="count"
                      label={({ name, count }) => `${name}: ${count}`} labelLine={false}>
                      {availabilityData.map((_, i) => <Cell key={i} fill={COLORS_STATUS[i]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Use Case Breakdown</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3 pt-2">
                  {useCaseData.map((uc, i) => (
                    <div key={uc.name} className="flex items-center justify-between p-3 rounded-lg border">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ background: COLORS_USE_CASE[i] }} />
                        <span className="font-medium">{uc.name}</span>
                      </div>
                      <span className="text-xl font-bold">{uc.count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab 4: Failed */}
        <TabsContent value="failed">
          <Card>
            <CardHeader><CardTitle>Failed Messages ({failedLogs.length})</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left py-2 px-2">Date</th>
                      <th className="text-left py-2 px-2">Student ID</th>
                      <th className="text-left py-2 px-2">Phone</th>
                      <th className="text-left py-2 px-2">Use Case</th>
                      <th className="text-left py-2 px-2">Error Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {failedLogs.map(log => (
                      <tr key={log.id} className="border-b hover:bg-red-50">
                        <td className="py-2 px-2">{new Date(log.timestamp_sent).toLocaleDateString('en-IN')}</td>
                        <td className="py-2 px-2 font-mono text-xs">{log.student_id}</td>
                        <td className="py-2 px-2">{log.phone_number_used}</td>
                        <td className="py-2 px-2">
                          <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs">{log.use_case}</span>
                        </td>
                        <td className="py-2 px-2 text-red-600">{log.error_reason || 'Unknown error'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {failedLogs.length === 0 && <p className="text-center py-4 text-gray-500">No failed messages</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}