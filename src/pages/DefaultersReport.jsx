import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Eye, Phone, MessageCircle, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import LoginRequired from '@/components/LoginRequired';
import { useAcademicYear } from '@/components/AcademicYearContext';
import DefaulterDetailDrawer from '@/components/fees/DefaulterDetailDrawer';

export default function DefaultersReportPage() {
  const { academicYear } = useAcademicYear();
  console.log('useAcademicYear returned:', academicYear);
  
  const [filters, setFilters] = useState({
    className: '',
    section: '',
    minDue: '',
    daysSinceLastPaymentMin: '',
    status: '',
    search: ''
  });

  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: () => base44.entities.Student.list()
  });
  const [page, setPage] = useState(1);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const queryClient = useQueryClient();
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [sendingReminders, setSendingReminders] = useState(false);
  const [reminderTitle, setReminderTitle] = useState("Fee Payment Reminder 💰");
  const [reminderMessage, setReminderMessage] = useState("Dear {name}, You have an outstanding fee of ₹{amount}. Please clear your dues at the earliest to avoid any inconvenience. Thank you.");

  // Fetch defaulters
  const { data, isLoading, error } = useQuery({
    queryKey: ['defaultersReport', academicYear, page, filters.className, filters.section, filters.minDue, filters.status, filters.search, filters.daysSinceLastPaymentMin],
    queryFn: async () => {
      const params = new URLSearchParams({
        academicYear: academicYear,
        page: page.toString(),
        pageSize: '50',
        ...(filters.minDue && { minDue: filters.minDue.toString() }),
        ...(filters.className && { className: filters.className }),
        ...(filters.section && { section: filters.section }),
        ...(filters.daysSinceLastPaymentMin !== undefined && filters.daysSinceLastPaymentMin !== '' && { daysSinceLastPaymentMin: filters.daysSinceLastPaymentMin }),
        ...(filters.status && { status: filters.status }),
        ...(filters.search && { search: filters.search })
      });

      console.log('Filter params being sent:', {
        academicYear: academicYear,
        className: filters.className,
        section: filters.section,
        minDue: filters.minDue,
        status: filters.status,
        search: filters.search,
        page: page
      });

      console.log('DefaultersReport sending academicYear:', academicYear);
      console.log('Type:', typeof academicYear);

      const res = await base44.functions.invoke('getDefaultersReport', { ...Object.fromEntries(params) });
      return res.data;
    }
  });

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        academicYear: academicYear,
        ...(filters.className && { className: filters.className }),
        ...(filters.section && { section: filters.section }),
        ...(filters.minDue && { minDue: filters.minDue.toString() }),
        ...(filters.search && { search: filters.search })
      });

      const res = await base44.functions.invoke('exportDefaultersReport', { ...Object.fromEntries(params) });
      
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `defaulters_${academicYear}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
      
      toast.success('Defaulters report exported');
    } catch (err) {
      toast.error('Failed to export report');
      console.error(err);
    }
  };

  const handleOpenDetail = (row) => {
    setSelectedStudent(row);
    setIsDetailOpen(true);
  };

  const copyPhone = (phone) => {
    if (phone) {
      navigator.clipboard.writeText(phone);
      toast.success('Phone copied to clipboard');
    }
  };

  const openWhatsApp = (phone) => {
    if (phone) {
      window.open(`https://wa.me/${phone.replace(/\D/g, '')}`, '_blank');
    }
  };

  const handleSelectAll = () => {
    if (selectedStudents.length === rows.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(rows.map(row => row.student.id));
    }
  };

  const handleToggleStudent = (studentId) => {
    if (selectedStudents.includes(studentId)) {
      setSelectedStudents(selectedStudents.filter(id => id !== studentId));
    } else {
      setSelectedStudents([...selectedStudents, studentId]);
    }
  };

  const handleSendReminder = async () => {
    if (!confirm(`Send fee reminder to ${selectedStudents.length} students?`)) {
      return;
    }

    setSendingReminders(true);
    try {
      const res = await base44.functions.invoke('sendFeeReminders', {
        student_ids: selectedStudents,
        title: reminderTitle,
        message: reminderMessage
      });
      const result = res.data;
      toast.success(`✅ Sent: ${result.success_count} | ⏭️ Already reminded: ${result.already_reminded_count} | ❌ Failed: ${result.failed_count}`);
      setSelectedStudents([]);
    } catch (error) {
      toast.error('Failed to send reminders: ' + error.message);
    } finally {
      setSendingReminders(false);
    }
  };

  if (isLoading) {
    return (
      <LoginRequired allowedRoles={['admin', 'principal', 'accountant']} pageName="Defaulters Report">
        <div className="flex items-center justify-center min-h-screen">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </LoginRequired>
    );
  }

  const summary = data?.summary || {};
  const rows = data?.rows || [];
  const meta = data?.meta || {};

  return (
    <LoginRequired allowedRoles={['admin', 'principal', 'accountant']} pageName="Defaulters Report">
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Defaulters Report</h1>
            <p className="text-gray-600">Track students with outstanding fees for follow-up</p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Total Due</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-gray-900">₹{(summary.totalDue || 0).toLocaleString()}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Students</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-gray-900">{summary.countStudents || 0}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">Never Paid</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-600">{summary.countNeverPaid || 0}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">No Payment (90+ days)</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-orange-600">{summary.countNoPayment90Days || 0}</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
                <Input
                  placeholder="Search name/phone"
                  value={filters.search}
                  onChange={(e) => { setFilters({ ...filters, search: e.target.value }); setPage(1); }}
                />
                <Select value={filters.className || ""} onValueChange={(v) => { setFilters({ ...filters, className: v === "__all__" ? "" : v, section: "" }); setPage(1); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Classes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Classes</SelectItem>
                    {['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].map(cls => (
                      <SelectItem key={cls} value={cls}>Class {cls}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filters.section || ""} onValueChange={(v) => { setFilters({ ...filters, section: v === "__all__" ? "" : v }); setPage(1); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Sections" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Sections</SelectItem>
                    {['A', 'B', 'C', 'D', 'E'].map(sec => (
                      <SelectItem key={sec} value={sec}>Section {sec}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-3">
                <Input
                  placeholder="Min Due (₹)"
                  type="number"
                  value={filters.minDue}
                  onChange={(e) => { setFilters({ ...filters, minDue: e.target.value }); setPage(1); }}
                />
                <Input
                  placeholder="Days Since Last Payment"
                  type="number"
                  value={filters.daysSinceLastPaymentMin}
                  onChange={(e) => { setFilters({ ...filters, daysSinceLastPaymentMin: e.target.value }); setPage(1); }}
                />
                <Select value={filters.status || ""} onValueChange={(v) => { setFilters({ ...filters, status: v === "__all__" ? "" : v }); setPage(1); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Follow-up Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All</SelectItem>
                    <SelectItem value="NEW">New</SelectItem>
                    <SelectItem value="CALLED">Called</SelectItem>
                    <SelectItem value="FOLLOW_UP">Follow-up</SelectItem>
                    <SelectItem value="PROMISED">Promised</SelectItem>
                    <SelectItem value="DO_NOT_CALL">Do Not Call</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setFilters({ className: '', section: '', minDue: '', daysSinceLastPaymentMin: '', status: '', search: '' }); setSelectedStudents([]); setPage(1); }}>
                  Clear All Filters
                </Button>
                <Button className="bg-green-600 hover:bg-green-700" onClick={handleExport}>
                  <Download className="h-4 w-4 mr-2" /> Export CSV
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 border-b">
                    <tr>
                      <th className="px-4 py-3 w-8">
                        <Checkbox
                          checked={rows.length > 0 && selectedStudents.length === rows.length}
                          onCheckedChange={handleSelectAll}
                        />
                      </th>
                      <th className="px-4 py-3 text-left font-semibold">Student</th>
                      <th className="px-4 py-3 text-left font-semibold">Class</th>
                      <th className="px-4 py-3 text-right font-semibold">Due</th>
                      <th className="px-4 py-3 text-left font-semibold">Last Payment</th>
                      <th className="px-4 py-3 text-center font-semibold">Days Since</th>
                      <th className="px-4 py-3 text-left font-semibold">Phone</th>
                      <th className="px-4 py-3 text-left font-semibold">Follow-up Status</th>
                      <th className="px-4 py-3 text-center font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="px-4 py-6 text-center text-gray-500">
                          No defaulters found
                        </td>
                      </tr>
                    ) : (
                      rows.map((row, idx) => (
                        <tr key={idx} className={`border-b hover:bg-gray-50 ${row.daysSinceLastPayment !== null && row.daysSinceLastPayment >= 90 ? 'bg-orange-50' : ''}`}>
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedStudents.includes(row.student.id)}
                              onCheckedChange={() => handleToggleStudent(row.student.id)}
                            />
                          </td>
                          <td className="px-4 py-3 font-medium">{row.student.name}</td>
                          <td className="px-4 py-3">{row.class.name}</td>
                          <td className="px-4 py-3 text-right font-bold text-red-600">₹{(row.due || 0).toLocaleString()}</td>
                          <td className="px-4 py-3 text-sm">{row.lastPaymentDate || 'Never'}</td>
                          <td className="px-4 py-3 text-center text-sm">{row.daysSinceLastPayment !== null ? row.daysSinceLastPayment : 'N/A'}</td>
                          <td className="px-4 py-3">
                            {row.phone1 ? (
                              <button
                                onClick={() => copyPhone(row.phone1)}
                                className="text-blue-600 hover:underline text-sm"
                              >
                                {row.phone1}
                              </button>
                            ) : (
                              <span className="text-gray-400 text-sm">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm">
                            {row.latestFollowUp ? (
                              <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                                {row.latestFollowUp.status}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">No follow-up</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex gap-2 justify-center">
                              <button
                                onClick={() => handleOpenDetail(row)}
                                className="text-blue-600 hover:bg-blue-50 p-1 rounded"
                                title="View details"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              {row.phone1 && (
                                <button
                                  onClick={() => openWhatsApp(row.phone1)}
                                  className="text-green-600 hover:bg-green-50 p-1 rounded"
                                  title="WhatsApp"
                                >
                                  <MessageCircle className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Pagination */}
          {meta.totalPages > 1 && (
            <div className="mt-4 flex justify-center gap-2">
              <Button
                variant="outline"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <span className="px-4 py-2 text-sm">
                Page {page} of {meta.totalPages}
              </span>
              <Button
                variant="outline"
                disabled={page === meta.totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </div>

        {/* Detail Drawer */}
        {isDetailOpen && (
          <DefaulterDetailDrawer
            row={selectedStudent}
            academicYear={academicYear}
            onClose={() => setIsDetailOpen(false)}
            onFollowUpAdded={() => {
              queryClient.invalidateQueries({ queryKey: ['defaulters'] });
              setIsDetailOpen(false);
            }}
          />
        )}

        {/* Send Reminder Panel */}
        {selectedStudents.length > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-slate-200 dark:border-gray-700 shadow-lg p-4 z-50">
            <div className="max-w-7xl mx-auto space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {selectedStudents.length} students selected
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedStudents([])}
                  className="gap-1"
                >
                  <X className="h-4 w-4" />
                  Clear Selection
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Title</Label>
                  <Input
                    className="mt-1"
                    value={reminderTitle}
                    onChange={(e) => setReminderTitle(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Message</Label>
                  <Textarea
                    className="mt-1"
                    rows={2}
                    value={reminderMessage}
                    onChange={(e) => setReminderMessage(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={handleSendReminder}
                  disabled={sendingReminders}
                  className="gap-2 bg-[#1a237e] hover:bg-[#283593]"
                >
                  <Send className="h-4 w-4" />
                  {sendingReminders ? 'Sending...' : 'Send Reminder 🔔'}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </LoginRequired>
  );
}