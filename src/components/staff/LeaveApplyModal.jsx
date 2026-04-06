import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import moment from 'moment';

// Pay type logic:
// Count non-Sunday extra holidays in that month
// >= 2 extra holidays → Unpaid
// <= 1 extra holidays → first leave of month is Paid, rest Unpaid
async function determinePayType(fromDate, staffId, academicYear) {
  const month = moment(fromDate).format('MMMM YYYY');
  const monthStart = moment(fromDate).startOf('month').format('YYYY-MM-DD');
  const monthEnd = moment(fromDate).endOf('month').format('YYYY-MM-DD');

  // Count extra (non-Sunday) holidays this month
  const holidays = await base44.entities.Holiday.filter({ academic_year: academicYear });
  const extraHolidays = holidays.filter(h => {
    if (h.date < monthStart || h.date > monthEnd) return false;
    if (h.applies_to === 'Students Only') return false;
    if (h.status === 'Cancelled') return false;
    const dow = moment(h.date).day(); // 0=Sun
    return dow !== 0; // non-Sunday
  });

  if (extraHolidays.length >= 2) return 'Unpaid';

  // Check if staff already used their 1 paid leave this month
  const existingLeaves = await base44.entities.StaffLeave.filter({
    staff_id: staffId,
    academic_year: academicYear,
    salary_month: month,
    status: 'Approved'
  });
  const usedPaid = existingLeaves.some(l => l.pay_type === 'Paid');
  return usedPaid ? 'Unpaid' : 'Paid';
}

export default function LeaveApplyModal({ open, onClose, staffId, staffName, designation, academicYear }) {
  const [form, setForm] = useState({
    from_date: '',
    to_date: '',
    leave_type: 'Personal Leave',
    reason: ''
  });
  const [days, setDays] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (form.from_date && form.to_date && form.to_date >= form.from_date) {
      const d = moment(form.to_date).diff(moment(form.from_date), 'days') + 1;
      setDays(d);
    } else {
      setDays(0);
    }
  }, [form.from_date, form.to_date]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.from_date || !form.to_date || !form.reason.trim()) {
      toast.error('Please fill all fields');
      return;
    }
    if (form.to_date < form.from_date) {
      toast.error('End date must be after start date');
      return;
    }
    setSaving(true);
    const payType = await determinePayType(form.from_date, staffId, academicYear);
    await base44.entities.StaffLeave.create({
      staff_id: staffId,
      staff_name: staffName,
      designation: designation || '',
      from_date: form.from_date,
      to_date: form.to_date,
      days,
      reason: form.reason,
      leave_type: form.leave_type,
      pay_type: payType,
      status: 'Pending',
      academic_year: academicYear,
      salary_month: moment(form.from_date).format('MMMM YYYY'),
    });
    toast.success(`Leave applied (${payType} Leave). Pending admin approval.`);
    setSaving(false);
    setForm({ from_date: '', to_date: '', leave_type: 'Personal Leave', reason: '' });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Apply for Leave</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">From Date</label>
              <input type="date" value={form.from_date}
                onChange={e => setForm(f => ({ ...f, from_date: e.target.value }))}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-600" required />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">To Date</label>
              <input type="date" value={form.to_date}
                onChange={e => setForm(f => ({ ...f, to_date: e.target.value }))}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-600" required />
            </div>
          </div>
          {days > 0 && (
            <p className="text-sm text-indigo-600 font-medium">{days} day(s) leave</p>
          )}
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Leave Type</label>
            <select value={form.leave_type}
              onChange={e => setForm(f => ({ ...f, leave_type: e.target.value }))}
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-600">
              {['Sick Leave', 'Personal Leave', 'Emergency Leave', 'Other'].map(t => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Reason</label>
            <textarea value={form.reason}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              rows={3} required placeholder="Briefly explain the reason..."
              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 dark:border-gray-600 resize-none" />
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />Submitting...</> : 'Submit Leave'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}