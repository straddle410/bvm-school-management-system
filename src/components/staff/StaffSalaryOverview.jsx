import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Loader2, AlertCircle, IndianRupee, Lock, CalendarDays } from 'lucide-react';
import moment from 'moment';

function todayIST() {
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

function getMonthsFromDateRange(startDate, endDate) {
  const today = moment(todayIST());
  const start = moment(startDate).startOf('month');
  const end = moment.min(moment(endDate).startOf('month'), today.clone().startOf('month'));
  const months = [];
  let cur = start.clone();
  while (cur.isSameOrBefore(end, 'month')) {
    months.push(cur.clone());
    cur.add(1, 'month');
  }
  return months;
}

export default function StaffSalaryOverview({ staffId, academicYear }) {
  const today = moment(todayIST());
  const [months, setMonths] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(today.format('MMMM YYYY'));
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!academicYear) return;
    base44.entities.AcademicYear.filter({ year: academicYear })
      .then(results => {
        const ay = results[0];
        if (ay?.start_date && ay?.end_date) {
          const m = getMonthsFromDateRange(ay.start_date, ay.end_date);
          setMonths(m);
          if (m.length > 0) setSelectedMonth(m[m.length - 1].format('MMMM YYYY'));
        }
      })
      .catch(() => {});
  }, [academicYear]);

  // Is the selected month the current month?
  const isCurrentMonth = selectedMonth === today.format('MMMM YYYY');
  const isFirstOfMonth = today.date() === 1;

  // For current month: only show if it's the 1st (salary generation day) OR payment already exists
  const shouldFetch = !isCurrentMonth || isFirstOfMonth;

  useEffect(() => {
    if (!staffId || !academicYear || !selectedMonth) return;
    if (!shouldFetch) {
      setPayment(null);
      return;
    }
    setLoading(true);
    setError(null);
    base44.entities.SalaryPayment.filter({ staff_id: staffId, academic_year: academicYear, salary_month: selectedMonth })
      .then(results => setPayment(results[0] || null))
      .catch(() => setError('Failed to load salary'))
      .finally(() => setLoading(false));
  }, [staffId, academicYear, selectedMonth, shouldFetch]);

  if (!staffId) return (
    <div className="text-center text-sm text-gray-400 py-8">Staff account not linked.</div>
  );

  return (
    <div className="space-y-4">
      {/* Month selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-600">Month:</label>
        <select
          value={selectedMonth}
          onChange={e => setSelectedMonth(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white"
        >
          {months.map(m => (
            <option key={m.format('MMMM YYYY')} value={m.format('MMMM YYYY')}>
              {m.format('MMMM YYYY')}
            </option>
          ))}
        </select>
      </div>

      {/* Current month locked until 1st */}
      {isCurrentMonth && !isFirstOfMonth ? (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-8 flex flex-col items-center gap-3 text-center">
          <Lock className="h-10 w-10 text-amber-400" />
          <p className="font-semibold text-amber-800 dark:text-amber-300">Salary details for {selectedMonth}</p>
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Current month's salary will be available on the <strong>1st of {today.clone().add(1, 'month').format('MMMM YYYY')}</strong> once attendance is finalized.
          </p>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-indigo-500" /></div>
      ) : error ? (
        <div className="text-center text-sm text-red-500 py-4"><AlertCircle className="inline h-4 w-4 mr-1" />{error}</div>
      ) : !payment ? (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-8 flex flex-col items-center gap-3 text-center">
          <CalendarDays className="h-10 w-10 text-gray-300" />
          <p className="font-semibold text-gray-500 dark:text-gray-400">No salary record for {selectedMonth}</p>
          <p className="text-sm text-gray-400">Salary hasn't been processed yet for this month.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-4 text-white">
            <div className="flex items-center gap-2">
              <IndianRupee className="h-5 w-5" />
              <span className="font-semibold text-lg">Salary Slip — {payment.salary_month}</span>
            </div>
            <p className="text-emerald-100 text-sm mt-1">{payment.designation || ''}</p>
          </div>

          {/* Details */}
          <div className="p-6 space-y-3">
            <Row label="Base Salary" value={`₹${(payment.base_salary || 0).toLocaleString('en-IN')}`} />
            <Row label="Allowances" value={`+ ₹${(payment.allowances || 0).toLocaleString('en-IN')}`} valueClass="text-green-600" />
            <Row label="Deductions" value={`− ₹${(payment.deductions || 0).toLocaleString('en-IN')}`} valueClass="text-red-600" />
            <div className="border-t dark:border-gray-700 pt-3 mt-3">
              <div className="flex justify-between items-center">
                <span className="font-bold text-gray-900 dark:text-white text-base">Net Payable</span>
                <span className="font-bold text-emerald-600 text-xl">₹{(payment.net_payable || 0).toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-3 mt-2 space-y-1 text-sm text-gray-600 dark:text-gray-300">
              <div className="flex justify-between">
                <span>Status</span>
                <span className={`font-semibold ${payment.status === 'Paid' ? 'text-green-600' : 'text-amber-600'}`}>{payment.status}</span>
              </div>
              {payment.payment_date && (
                <div className="flex justify-between">
                  <span>Payment Date</span>
                  <span>{moment(payment.payment_date).format('MMM D, YYYY')}</span>
                </div>
              )}
              {payment.payment_method && (
                <div className="flex justify-between">
                  <span>Method</span>
                  <span>{payment.payment_method}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, valueClass = 'text-gray-900 dark:text-white' }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className={`font-medium ${valueClass}`}>{value}</span>
    </div>
  );
}