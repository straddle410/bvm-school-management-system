import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { XCircle, Send, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from "sonner";
import { format } from 'date-fns';

export default function AbsentNotificationTab({ academicYear, user }) {
  const todayDate = format(new Date(), 'yyyy-MM-dd');
  const [selectedDate, setSelectedDate] = useState(todayDate);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [sending, setSending] = useState(false);
  const [sentResults, setSentResults] = useState(null);
  const [whatsappResult, setWhatsappResult] = useState(null);
  const [confirmResend, setConfirmResend] = useState(false);
  const [resendCount, setResendCount] = useState(0);
  const queryClient = useQueryClient();

  const { data: allAbsentRecords = [], isLoading } = useQuery({
    queryKey: ['absent-records-for-notif', selectedDate, academicYear],
    queryFn: () => base44.entities.Attendance.filter({
      date: selectedDate,
      attendance_type: 'absent',
      academic_year: academicYear,
    }),
    enabled: !!selectedDate && !!academicYear,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Fetch WA logs for absent notifications on this date
  const { data: waLogs = [] } = useQuery({
    queryKey: ['absent-wa-logs', selectedDate, academicYear],
    queryFn: async () => {
      const logs = await base44.entities.WhatsAppMessageLog.filter({
        use_case: 'Absent',
      });
      // Filter logs for the selected date
      return logs.filter(l => l.timestamp_sent && l.timestamp_sent.startsWith(selectedDate));
    },
    enabled: !!selectedDate && !!academicYear,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  // Unique classes from absent records
  const availableClasses = [...new Set(allAbsentRecords.map(r => r.class_name).filter(Boolean))].sort();

  // Filter by selected class
  const absentRecords = selectedClass ? allAbsentRecords.filter(r => r.class_name === selectedClass) : allAbsentRecords;

  // Map: student_id -> log status (sent/delivered)
  const notifiedStudentIds = new Set(
    waLogs.filter(l => l.status === 'sent' || l.status === 'delivered').map(l => l.student_id)
  );

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === absentRecords.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(absentRecords.map(r => r.id)));
    }
  };

  const allSelected = absentRecords.length > 0 && selectedIds.size === absentRecords.length;

  const doSend = async () => {
    setSending(true);
    setSentResults(null);
    setWhatsappResult(null);
    setConfirmResend(false);
    try {
      const selectedRecords = absentRecords.filter(r => selectedIds.has(r.id));
      const studentIds = [...new Set(selectedRecords.map(r => r.student_id))];
      const [studentFetches, schoolProfileList] = await Promise.all([
        Promise.all(studentIds.map(id => base44.entities.Student.filter({ student_id: id }))),
        base44.entities.SchoolProfile.list(),
      ]);
      const studentMap = {};
      studentFetches.flat().forEach(s => { studentMap[s.student_id] = s; });
      const schoolName = (schoolProfileList?.[0]?.school_name || 'School').trim();

      const rawDateStr = selectedDate || new Date().toISOString().slice(0, 10);
      const parsedDate = new Date(rawDateStr);
      const formattedDate = !isNaN(parsedDate)
        ? parsedDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
        : rawDateStr;

      const recipients = [];
      for (const record of selectedRecords) {
        const student = studentMap[record.student_id] || {};
        const rawPhone = student.parent_phone || student.alternate_parent_phone;
        if (!rawPhone) continue;
        const digits = rawPhone.replace(/\D/g, '');
        if (digits.length < 10) continue;
        const phone = digits.startsWith('91') ? digits : `91${digits}`;

        const classValue = `Class ${record.class_name || ''}-${record.section || ''}`.trim();
        const parent = (student.father_name || student.mother_name || student.guardian_name || student.parent_name || 'Guardian').trim();
        const studentName = (record.student_name || record.student_id || 'Student').trim();

        const variables = [
          parent,        // {{1}} parent_name
          studentName,   // {{2}} student_name
          classValue,    // {{3}} class
          formattedDate, // {{4}} date
          schoolName,    // {{5}} school_name
        ];

        console.log('Absent FINAL variables:', variables);

        if (variables.length !== 5 || variables.some(v => !v || v.toString().trim() === '')) {
          console.error('[AbsentNotification] Invalid variables', variables);
          continue;
        }

        recipients.push({ student_id: record.student_id, phone, variables });
      }

      if (recipients.length === 0) {
        toast.error('No valid phone numbers found for selected students');
        setSending(false);
        return;
      }

      const res = await base44.functions.invoke('sendWhatsAppBulkMessage', {
        template_id: 'absent_notification',
        use_case: 'Absent',
        recipients,
      });
      setWhatsappResult(res.data);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['absent-wa-logs'] });
    } catch (err) {
      toast.error('Failed to send notifications: ' + (err?.message || 'Unknown error'));
    } finally {
      setSending(false);
    }
  };

  const handleSend = () => {
    if (selectedIds.size === 0) {
      toast.error('Please select at least one student');
      return;
    }
    const selectedRecords = absentRecords.filter(r => selectedIds.has(r.id));
    const alreadyNotifiedCount = selectedRecords.filter(r => notifiedStudentIds.has(r.student_id)).length;
    if (alreadyNotifiedCount > 0) {
      setResendCount(alreadyNotifiedCount);
      setConfirmResend(true);
      return;
    }
    doSend();
  };

  return (
    <div className="space-y-4">
      <Card className="border-0 shadow-sm dark:bg-gray-800">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-600 dark:text-gray-400 whitespace-nowrap">Date:</label>
              <input
                type="date"
                value={selectedDate}
                onChange={e => {
                  setSelectedDate(e.target.value);
                  setSelectedIds(new Set());
                  setSelectedClass('');
                  setSentResults(null);
                  queryClient.invalidateQueries({ queryKey: ['absent-records-for-notif'] });
                  queryClient.invalidateQueries({ queryKey: ['absent-notif-messages'] });
                }}
                className="border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-600 dark:text-gray-400 whitespace-nowrap">Class:</label>
              <select
                value={selectedClass}
                onChange={e => { setSelectedClass(e.target.value); setSelectedIds(new Set()); }}
                className="border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm"
              >
                <option value="">All Classes</option>
                {availableClasses.map(c => (
                  <option key={c} value={c}>Class {c}</option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-gray-400">
            Select a date to view absent students and send notifications.
          </p>
        </CardContent>
      </Card>

      {whatsappResult && (
        <Card className="border-green-200 bg-green-50 dark:bg-green-900/20 dark:border-green-800">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
              <p className="text-sm font-semibold text-green-800 dark:text-green-300">WhatsApp Notifications Sent</p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border">
                <p className="text-xl font-bold text-gray-800 dark:text-white">{whatsappResult.total}</p>
                <p className="text-xs text-gray-500">Total Sent</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border">
                <p className="text-xl font-bold text-green-600">{whatsappResult.success ?? whatsappResult.delivered ?? 0}</p>
                <p className="text-xs text-gray-500">Delivered</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border">
                <p className="text-xl font-bold text-red-600">{whatsappResult.failed ?? 0}</p>
                <p className="text-xs text-gray-500">Failed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Card className="border-0 shadow-sm dark:bg-gray-800">
          <CardContent className="py-12 flex justify-center">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
          </CardContent>
        </Card>
      ) : absentRecords.length === 0 ? (
        <Card className="border-0 shadow-sm dark:bg-gray-800">
          <CardContent className="py-16 text-center">
            <XCircle className="h-12 w-12 text-slate-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-700 dark:text-gray-300">No absent students</h3>
            <p className="text-slate-500 dark:text-gray-400 mt-2">No absent records found for {selectedDate}.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-sm dark:bg-gray-800">
          <CardContent className="p-0">
            <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700">
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleSelectAll}
                  disabled={absentRecords.length === 0}
                />
                <span className="text-sm font-medium text-slate-700 dark:text-gray-300">
                  {absentRecords.length} absent student(s)
                </span>
              </div>
              <Button
                onClick={handleSend}
                disabled={selectedIds.size === 0 || sending}
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <Send className="h-4 w-4 mr-1.5" />
                {sending ? 'Sending...' : `Send Notification (${selectedIds.size})`}
              </Button>
            </div>

            <div className="divide-y dark:divide-gray-700 max-h-[500px] overflow-y-auto">
              {absentRecords.map(record => {
                const alreadyNotified = notifiedStudentIds.has(record.student_id);
                const isSelected = selectedIds.has(record.id);
                return (
                  <div
                    key={record.id}
                    className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-gray-700`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelect(record.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-900 dark:text-white text-sm truncate">
                        {record.student_name || record.student_id}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-gray-400">
                        {record.student_id} · Class {record.class_name}-{record.section}
                      </p>
                    </div>
                    {alreadyNotified ? (
                      <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Notified
                      </span>
                    ) : (
                      <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                        <XCircle className="h-3 w-3" /> Absent
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirm resend dialog */}
      <Dialog open={confirmResend} onOpenChange={setConfirmResend}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Already Notified
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600 py-2">
            <strong>{resendCount}</strong> of the selected students already received an absent notification today. Do you want to send again?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmResend(false)}>Cancel</Button>
            <Button onClick={doSend} className="bg-red-600 hover:bg-red-700 text-white">
              <Send className="h-4 w-4 mr-1.5" /> Send Again
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}