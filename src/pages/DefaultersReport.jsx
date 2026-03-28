import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Eye, Phone, MessageCircle, Send, X, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import LoginRequired from '@/components/LoginRequired';
import { useAcademicYear } from '@/components/AcademicYearContext';
import DefaulterDetailDrawer from '@/components/fees/DefaulterDetailDrawer';


export default function DefaultersReportPage() {
  const { academicYear } = useAcademicYear();

  
  const [userRole, setUserRole] = useState('');
  
  const [filters, setFilters] = useState({
    className: '',
    section: '',
    minDue: '',
    daysSinceLastPaymentMin: '',
    status: '',
    followUpDateFrom: '',
    followUpDateTo: '',
    search: ''
  });

  const [appliedFilters, setAppliedFilters] = useState({
    className: '',
    section: '',
    minDue: '',
    daysSinceLastPaymentMin: '',
    status: '',
    followUpDateFrom: '',
    followUpDateTo: '',
    search: ''
  });


  const [page, setPage] = useState(1);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const queryClient = useQueryClient();
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [sendingReminders, setSendingReminders] = useState(false);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [reminderResult, setReminderResult] = useState(null);
  const [confirmResend, setConfirmResend] = useState(false);
  const [alreadySentStudents, setAlreadySentStudents] = useState([]);
  const [isDueDateModalOpen, setIsDueDateModalOpen] = useState(false);
  const [bulkDueDate, setBulkDueDate] = useState('');
  const [savingDueDate, setSavingDueDate] = useState(false);

  useEffect(() => {
    const staffSession = JSON.parse(localStorage.getItem('staff_session') || '{}');
    setUserRole((staffSession.role || '').toLowerCase());
  }, []);

  // Fetch today's fee reminder WA logs to track who was already sent
  const { data: todayFeeReminderLogs = [], refetch: refetchReminderLogs } = useQuery({
    queryKey: ['fee-reminder-wa-logs', academicYear],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const logs = await base44.entities.WhatsAppMessageLog.filter({ use_case: 'FeeReminder' });
      return logs.filter(l => l.status === 'sent' || l.status === 'delivered');
    },
    staleTime: 0,
  });
  const reminderSentStudentIds = new Set(todayFeeReminderLogs.map(l => l.student_id));

  const handleApplyFilters = () => {
    setAppliedFilters({ ...filters });
    setPage(1);
  };

  const handleFilterChange = (key, value) => {
    setFilters({ ...filters, [key]: value });
  };

  const handleResetFilters = () => {
    const emptyFilters = {
      className: '',
      section: '',
      minDue: '',
      daysSinceLastPaymentMin: '',
      status: '',
      followUpDateFrom: '',
      followUpDateTo: '',
      search: ''
    };
    setFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setSelectedStudents([]);
    setPage(1);
  };

  // Fetch defaulters
  const { data, isLoading, error } = useQuery({
    queryKey: ['defaultersReport', academicYear, page, appliedFilters.className, appliedFilters.section, appliedFilters.minDue, appliedFilters.status, appliedFilters.search, appliedFilters.daysSinceLastPaymentMin, appliedFilters.followUpDateFrom, appliedFilters.followUpDateTo],
    queryFn: async () => {
      const params = new URLSearchParams({
        academicYear: academicYear,
        page: page.toString(),
        pageSize: '50',
        ...(appliedFilters.minDue && { minDue: appliedFilters.minDue.toString() }),
        ...(appliedFilters.className && { className: appliedFilters.className }),
        ...(appliedFilters.section && { section: appliedFilters.section }),
        ...(appliedFilters.daysSinceLastPaymentMin !== undefined && appliedFilters.daysSinceLastPaymentMin !== '' && { daysSinceLastPaymentMin: appliedFilters.daysSinceLastPaymentMin }),
        ...(appliedFilters.status && { status: appliedFilters.status }),
        ...(appliedFilters.followUpDateFrom && { followUpDateFrom: appliedFilters.followUpDateFrom }),
        ...(appliedFilters.followUpDateTo && { followUpDateTo: appliedFilters.followUpDateTo }),
        ...(appliedFilters.search && { search: appliedFilters.search })
      });


      const res = await base44.functions.invoke('getDefaultersReport', { ...Object.fromEntries(params) });
      return res.data;
    }
  });

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        academicYear: academicYear,
        ...(appliedFilters.className && { className: appliedFilters.className }),
        ...(appliedFilters.section && { section: appliedFilters.section }),
        ...(appliedFilters.minDue && { minDue: appliedFilters.minDue.toString() }),
        ...(appliedFilters.search && { search: appliedFilters.search })
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

  const handleSetDueDate = async () => {
    if (!bulkDueDate) {
      toast.error('Please select a due date');
      return;
    }
    setSavingDueDate(true);
    try {
      const res = await base44.functions.invoke('updateDefaulterDueDate', {
        student_ids: selectedStudents,
        due_date: bulkDueDate,
        academic_year: academicYear,
      });
      toast.success(`Due date updated for ${res.data.updated} invoice(s)`);
      setIsDueDateModalOpen(false);
      setBulkDueDate('');
      queryClient.invalidateQueries({ queryKey: ['defaultersReport'] });
    } catch (err) {
      toast.error('Failed to update due date: ' + (err?.message || 'Unknown error'));
    } finally {
      setSavingDueDate(false);
    }
  };

  const doSendReminder = async () => {
    setSendingReminders(true);
    setReminderResult(null);
    setConfirmResend(false);
    try {
      // Fetch full student records to get parent details
      const studentRecords = await Promise.all(
        selectedStudents.map(studentCode =>
          base44.entities.Student.filter({ student_id: studentCode })
        )
      );
      const studentMap = {};
      studentRecords.flat().forEach(s => { studentMap[s.student_id] = s; });

      const schoolProfileList = await base44.entities.SchoolProfile.list();
      const schoolName = schoolProfileList?.[0]?.school_name || 'School';

      const recipients = [];
      for (const row of rows.filter(r => selectedStudents.includes(r.student.id))) {
        const studentRecord = studentMap[row.student.id] || {};
        const rawPhone = row.phone1 || studentRecord.alternate_parent_phone;
        if (!rawPhone) continue;
        const digits = rawPhone.replace(/\D/g, '');
        if (digits.length < 10) continue;
        const phone = digits.startsWith('91') ? digits : `91${digits}`;
        const rawDueDate = row.due_date ? new Date(row.due_date) : null;
        const formatted_due_date = rawDueDate && !isNaN(rawDueDate)
          ? format(rawDueDate, 'dd MMMM yyyy')
          : 'Due Soon';
        const variables = [
            (studentRecord.parent_name || 'Guardian').toString().trim(),                    // {{1}} parent_name
            (row.student.name || 'Student').toString().trim(),                              // {{2}} student_name
            String(row.due || 0),                                                           // {{3}} amount_due
            'School Fee',                                                                   // {{4}} fee_type
            formatted_due_date,                                                             // {{5}} due_date
            (schoolName || 'School').toString().trim(),                                     // {{6}} school_name
          ];
          if (variables.length !== 6 || variables.some(v => !v || v.toString().trim() === '')) {
            console.error('Invalid fee reminder variables', variables);
            continue;
          }
        recipients.push({
          student_id: row.student.id,
          phone,
          variables,
        });
      }

      if (recipients.length === 0) {
        toast.error('No valid phone numbers found for selected students');
        setSendingReminders(false);
        return;
      }

      if (recipients.length > 0) {
        console.log('SAMPLE PAYLOAD:', { phone: recipients[0].phone, variables: recipients[0].variables });
      }
      const res = await base44.functions.invoke('sendWhatsAppBulkMessage', {
        template_id: 'fee_reminder',
        use_case: 'FeeReminder',
        recipients,
      });
      setReminderResult(res.data);
      refetchReminderLogs();
    } catch (err) {
      toast.error('Failed to send reminders: ' + (err?.message || 'Unknown error'));
    } finally {
      setSendingReminders(false);
    }
  };

  const handleSendReminder = () => {
    if (selectedStudents.length === 0) {
      toast.error('Please select at least one student');
      return;
    }
    const alreadySent = selectedStudents.filter(id => reminderSentStudentIds.has(id));
    if (alreadySent.length > 0) {
      setAlreadySentStudents(alreadySent);
      setConfirmResend(true);
      return;
    }
    setIsReminderModalOpen(true);
    setReminderResult(null);
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
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Defaulters Report</h1>
              <p className="text-gray-600">Track students with outstanding fees for follow-up</p>
            </div>
            {(userRole === 'admin' || userRole === 'accountant') && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => { setIsDueDateModalOpen(true); setBulkDueDate(''); }}
                  disabled={selectedStudents.length === 0}
                  className="gap-2 border-orange-400 text-orange-700 hover:bg-orange-50"
                >
                  📅 Set Due Date ({selectedStudents.length} selected)
                </Button>
                <Button
                           onClick={handleSendReminder}
                           disabled={selectedStudents.length === 0}
                           className="gap-2 bg-[#1a237e] hover:bg-[#283593]"
                         >
                  <Send className="h-4 w-4" />
                  Send Reminder ({selectedStudents.length} selected)
                </Button>
              </div>
            )}
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
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <Input
                  placeholder="Search name/phone"
                  value={filters.search}
                  onChange={(e) => handleFilterChange('search', e.target.value)}
                />
                <Select value={filters.className || ""} onValueChange={(v) => handleFilterChange('className', v === "__all__" ? "" : v)}>
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
                <Select value={filters.section || ""} onValueChange={(v) => handleFilterChange('section', v === "__all__" ? "" : v)}>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <Input
                  placeholder="Min Due (₹)"
                  type="number"
                  value={filters.minDue}
                  onChange={(e) => handleFilterChange('minDue', e.target.value)}
                />
                <Input
                  placeholder="Days Since Last Payment"
                  type="number"
                  value={filters.daysSinceLastPaymentMin}
                  onChange={(e) => handleFilterChange('daysSinceLastPaymentMin', e.target.value)}
                />
                <Select value={filters.status || ""} onValueChange={(v) => handleFilterChange('status', v === "__all__" ? "" : v)}>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3">
                  <Input
                    placeholder="Follow-up Date From"
                    type="date"
                    value={filters.followUpDateFrom}
                    onChange={(e) => handleFilterChange('followUpDateFrom', e.target.value)}
                  />
                  <Input
                    placeholder="Follow-up Date To"
                    type="date"
                    value={filters.followUpDateTo}
                    onChange={(e) => handleFilterChange('followUpDateTo', e.target.value)}
                  />
                </div>
              <div className="flex flex-wrap gap-2 justify-end">
                <Button variant="outline" onClick={handleResetFilters}>
                  Reset Filters
                </Button>
                <Button className="bg-[#1a237e] hover:bg-[#283593]" onClick={handleApplyFilters}>
                  Apply Filters
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
                      <th className="px-4 py-3 text-left font-semibold">Due Date</th>
                      <th className="px-4 py-3 text-left font-semibold">Last Payment</th>
                      <th className="px-4 py-3 text-center font-semibold">Days Since</th>
                      <th className="px-4 py-3 text-left font-semibold">Phone</th>
                      <th className="px-4 py-3 text-left font-semibold">Follow-up Status</th>
                      <th className="px-4 py-3 text-center font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      <tr>
                        <td colSpan="9" className="px-4 py-12 text-center">
                          <div className="flex items-center justify-center gap-2 text-gray-500">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span>Loading...</span>
                          </div>
                        </td>
                      </tr>
                    ) : rows.length === 0 ? (
                      <tr>
                        <td colSpan="9" className="px-4 py-6 text-center text-gray-500">
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
                          <td className="px-4 py-3 text-sm">
                            {row.due_date ? format(new Date(row.due_date), 'dd MMM yyyy') : 'N/A'}
                          </td>
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
                              <button
                                onClick={() => handleOpenDetail(row)}
                                className="inline-block px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium hover:bg-blue-200 cursor-pointer"
                                title="Click to view follow-up details"
                              >
                                {row.latestFollowUp.status}
                              </button>
                            ) : (
                              <span className="text-gray-400 text-xs">No follow-up</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex gap-2 justify-center flex-wrap">
                              <button
                                onClick={() => handleOpenDetail(row)}
                                className="text-blue-600 hover:bg-blue-50 p-2 rounded text-xs font-medium"
                                title="View details & manage follow-up"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              {row.phone1 && (
                                <button
                                  onClick={() => openWhatsApp(row.phone1)}
                                  className="text-green-600 hover:bg-green-50 p-2 rounded text-xs font-medium"
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

        {/* Set Due Date Modal */}
        <Dialog open={isDueDateModalOpen} onOpenChange={setIsDueDateModalOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Set Due Date</DialogTitle>
            </DialogHeader>
            <div className="py-4 space-y-3">
              <p className="text-sm text-gray-600">
                Setting due date for <strong>{selectedStudents.length}</strong> selected student(s).
                This will update all active invoices for each student.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Due Date</label>
                <input
                  type="date"
                  value={bulkDueDate}
                  onChange={e => setBulkDueDate(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDueDateModalOpen(false)} disabled={savingDueDate}>
                Cancel
              </Button>
              <Button onClick={handleSetDueDate} disabled={savingDueDate} className="bg-[#1a237e] hover:bg-[#283593]">
                {savingDueDate ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Send Reminder Modal */}
        <Dialog open={isReminderModalOpen} onOpenChange={(open) => { setIsReminderModalOpen(open); if (!open) setReminderResult(null); }}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle>Send Fee Reminder via WhatsApp</DialogTitle>
                {!reminderResult && (
                  <Button
                    onClick={handleSendReminder}
                    disabled={sendingReminders}
                    className="gap-2 bg-[#1a237e] hover:bg-[#283593]"
                  >
                    {sendingReminders ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Send ({selectedStudents.length} selected)
                      </>
                    )}
                  </Button>
                )}
              </div>
            </DialogHeader>

            {/* WhatsApp Send Result */}
            {reminderResult && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <h4 className="font-semibold text-green-900">WhatsApp Reminders Sent</h4>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="bg-white rounded-lg p-3 border">
                    <p className="text-2xl font-bold text-gray-800">{reminderResult.total}</p>
                    <p className="text-xs text-gray-500">Total Sent</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border">
                    <p className="text-2xl font-bold text-green-600">{reminderResult.success ?? reminderResult.delivered ?? 0}</p>
                    <p className="text-xs text-gray-500">Delivered</p>
                  </div>
                  <div className="bg-white rounded-lg p-3 border">
                    <p className="text-2xl font-bold text-red-600">{reminderResult.failed ?? 0}</p>
                    <p className="text-xs text-gray-500">Failed</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => { setIsReminderModalOpen(false); setReminderResult(null); }}
                >
                  Close
                </Button>
              </div>
            )}

            {!reminderResult && (
              <div className="space-y-4 py-4">
                {/* Selected Students Table */}
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold">Student Name</th>
                        <th className="px-3 py-2 text-left font-semibold">Class</th>
                        <th className="px-3 py-2 text-right font-semibold">Due Amount</th>
                        <th className="px-3 py-2 text-left font-semibold">Phone</th>
                        <th className="px-3 py-2 text-center font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows
                        .filter(row => selectedStudents.includes(row.student.id))
                        .map((row, idx) => (
                          <tr key={idx} className="border-t">
                            <td className="px-3 py-2">{row.student.name}</td>
                            <td className="px-3 py-2">{row.class.name}</td>
                            <td className="px-3 py-2 text-right font-semibold text-red-600">
                              ₹{row.due.toLocaleString()}
                            </td>
                            <td className="px-3 py-2">{row.phone1 || '-'}</td>
                            <td className="px-3 py-2 text-center">
                              {reminderSentStudentIds.has(row.student.id) ? (
                                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1 justify-center">
                                  <CheckCircle2 className="h-3 w-3" /> Notified
                                </span>
                              ) : (
                                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Pending</span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

                {/* Message Preview */}
                <div className="border rounded-lg p-4 bg-gray-50">
                  <h4 className="font-semibold mb-3 text-sm">Message Preview (first 2):</h4>
                  <div className="space-y-2">
                    {rows
                      .filter(row => selectedStudents.includes(row.student.id))
                      .slice(0, 2)
                      .map((row, idx) => (
                        <div key={idx} className="text-sm text-gray-700 bg-white p-3 rounded border">
                          Dear {row.student.name}, Fee of ₹{row.due.toLocaleString()} is pending. Please pay at earliest.
                        </div>
                      ))}
                    {selectedStudents.length > 2 && (
                      <p className="text-xs text-gray-500 italic">
                        ...and {selectedStudents.length - 2} more students
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {!reminderResult && (
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsReminderModalOpen(false)}
                  disabled={sendingReminders}
                >
                  Cancel
                </Button>
                <Button
                  onClick={doSendReminder}
                  disabled={sendingReminders}
                  className="gap-2 bg-[#1a237e] hover:bg-[#283593]"
                >
                  {sendingReminders ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Confirm & Send
                    </>
                  )}
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Resend confirmation dialog for fee reminders */}
      <Dialog open={confirmResend} onOpenChange={setConfirmResend}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Already Notified
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-2">
            <strong>{alreadySentStudents.length}</strong> of the selected students already received a fee reminder. Do you want to send again?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmResend(false)}>Cancel</Button>
            <Button onClick={() => { setConfirmResend(false); setIsReminderModalOpen(true); setReminderResult(null); }} className="bg-[#1a237e] hover:bg-[#283593]">
              <Send className="h-4 w-4 mr-1.5" /> Send Again
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </LoginRequired>
  );
}