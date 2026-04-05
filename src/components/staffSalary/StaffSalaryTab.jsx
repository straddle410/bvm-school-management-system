import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { CheckCircle2, IndianRupee, Calendar } from 'lucide-react';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

// Days present calculation: Present=1, Half Day=0.5, Holiday on paid holiday=1, else=0
function calcDaysFromAttendance(records, paidHolidayDates = new Set()) {
  return records.reduce((sum, r) => {
    if (r.status === 'Present') return sum + 1;
    if (r.status === 'Half Day') return sum + 0.5;
    if (r.status === 'Holiday' && paidHolidayDates.has(r.date)) return sum + 1;
    return sum;
  }, 0);
}

function getFinancialYear(dateStr) {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = d.getMonth();
  const start = m >= 3 ? y : y - 1;
  return `${start}-${start + 1}`;
}

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

function getMonthDateRange(year, month) {
  const pad = n => String(n).padStart(2, '0');
  const start = `${year}-${pad(month + 1)}-01`;
  const end = `${year}-${pad(month + 1)}-${pad(daysInMonth(year, month))}`;
  return { start, end };
}

// Dynamic working days = all days in month - Sundays - unpaid staff holidays
function calcDynamicWorkingDays(year, month, holidays) {
  const total = daysInMonth(year, month);
  const pad = n => String(n).padStart(2, '0');
  let workingDays = 0;
  const unpaidStaffHolidayDates = new Set(
    holidays
      .filter(h => h.is_paid === false && (h.applies_to === 'All' || h.applies_to === 'Staff Only') && h.status === 'Active')
      .map(h => h.date)
  );
  for (let d = 1; d <= total; d++) {
    const dateStr = `${year}-${pad(month + 1)}-${pad(d)}`;
    const dayOfWeek = new Date(dateStr + 'T00:00:00').getDay();
    if (dayOfWeek === 0) continue; // Sunday
    if (unpaidStaffHolidayDates.has(dateStr)) continue; // Unpaid holiday
    workingDays++;
  }
  return workingDays;
}

export default function StaffSalaryTab({ academicYear }) {
  const now = new Date();
  const [selYear, setSelYear] = useState(now.getFullYear());
  const [selMonth, setSelMonth] = useState(now.getMonth()); // 0-indexed

  const [staffData, setStaffData] = useState([]); // { staff, config, attendance, daysPresent, earned, payment }
  const [monthStats, setMonthStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payMethod, setPayMethod] = useState('Bank Transfer');
  const [payDate, setPayDate] = useState(now.toISOString().slice(0, 10));

  useEffect(() => { loadData(); }, [selYear, selMonth, academicYear]);

  const loadData = async () => {
    setLoading(true);
    const { start, end } = getMonthDateRange(selYear, selMonth);
    const monthLabel = `${MONTHS[selMonth]} ${selYear}`;
    try {
      const [staffList, configs, allAttendance, payments, holidays] = await Promise.all([
        base44.entities.StaffAccount.filter({ is_active: true }),
        base44.entities.StaffSalaryConfig.filter({ academic_year: academicYear }),
        base44.entities.StaffAttendance.list('-date', 5000),
        base44.entities.SalaryPayment.filter({ academic_year: academicYear }),
        base44.entities.Holiday.filter({ academic_year: academicYear, status: 'Active' }),
      ]);

      // Build month stats
      const totalDays = daysInMonth(selYear, selMonth);
      const pad = n => String(n).padStart(2, '0');
      let sundaysCount = 0;
      for (let d = 1; d <= totalDays; d++) {
        const dateStr = `${selYear}-${pad(selMonth + 1)}-${pad(d)}`;
        if (new Date(dateStr + 'T00:00:00').getDay() === 0) sundaysCount++;
      }
      const staffHolidaysInMonth = holidays.filter(h =>
        h.date >= start && h.date <= end &&
        (h.applies_to === 'All' || h.applies_to === 'Staff Only')
      );
      const paidHolidaysInMonth = staffHolidaysInMonth.filter(h => h.is_paid !== false);
      const unpaidHolidaysInMonth = staffHolidaysInMonth.filter(h => h.is_paid === false);
      const effectiveWorkingDays = calcDynamicWorkingDays(selYear, selMonth, holidays);
      setMonthStats({
        totalDays,
        sundays: sundaysCount,
        totalHolidays: staffHolidaysInMonth.length,
        paidHolidays: paidHolidaysInMonth.length,
        unpaidHolidays: unpaidHolidaysInMonth.length,
        effectiveWorkingDays,
      });

      // Build set of paid holiday dates in this month (only holidays applicable to staff)
      const paidHolidayDates = new Set(
        holidays
          .filter(h => h.is_paid !== false && (h.applies_to === 'All' || h.applies_to === 'Staff Only'))
          .map(h => h.date)
          .filter(d => d >= start && d <= end)
      );

      const configMap = {};
      configs.forEach(c => { configMap[c.staff_id] = c; });

      const paymentMap = {};
      payments.forEach(p => { if (p.salary_month === monthLabel) paymentMap[p.staff_id] = p; });

      // Filter attendance for this month
      const monthAttendance = allAttendance.filter(a => a.date >= start && a.date <= end);

      const data = staffList.map(s => {
        const config = configMap[s.id];
        const att = monthAttendance.filter(a => a.staff_id === s.id);
        const daysPresent = calcDaysFromAttendance(att, paidHolidayDates);
        const totalDays = daysInMonth(selYear, selMonth);
        const workingDays = calcDynamicWorkingDays(selYear, selMonth, holidays);
        const dailyRate = config ? config.monthly_salary / workingDays : 0;
        const earned = Math.round(dailyRate * daysPresent);
        const payment = paymentMap[s.id] || null;

        return { staff: s, config, att, daysPresent, totalDays, workingDays, earned, payment, dailyRate };
      });

      setStaffData(data);
    } catch { toast.error('Failed to load salary data'); }
    finally { setLoading(false); }
  };

  const markAllPaid = async () => {
    const unpaid = staffData.filter(d => d.config && !d.payment);
    if (unpaid.length === 0) { toast.info('All staff already marked as paid for this month'); return; }
    if (!payDate) { toast.error('Select payment date'); return; }
    setPaying(true);
    const session = (() => { try { return JSON.parse(localStorage.getItem('staff_session')); } catch { return null; } })();
    const monthLabel = `${MONTHS[selMonth]} ${selYear}`;
    const fy = getFinancialYear(payDate);
    const payDateObj = new Date(payDate);
    const ayStart = payDateObj.getMonth() >= 3 ? payDateObj.getFullYear() : payDateObj.getFullYear() - 1;
    const ay = `${ayStart}-${String(ayStart + 1).slice(2)}`;

    try {
      await Promise.all(unpaid.map(async (d) => {
        // Create expense transaction
        const tx = await base44.entities.Transaction.create({
          type: 'Expense',
          category: 'Salaries & Wages',
          description: `Salary: ${d.staff.name} — ${monthLabel} (${d.daysPresent} days)`,
          amount: d.earned,
          transaction_date: payDate,
          payment_method: payMethod,
          status: 'Completed',
          academic_year: ay,
          financial_year: fy,
          recorded_by: session?.email || '',
        });
        // Create salary payment record
        await base44.entities.SalaryPayment.create({
          staff_id: d.staff.id,
          staff_name: d.staff.name,
          designation: d.staff.designation || d.staff.role || '',
          salary_month: monthLabel,
          base_salary: d.config.monthly_salary,
          allowances: 0,
          deductions: 0,
          net_payable: d.earned,
          payment_date: payDate,
          payment_method: payMethod,
          status: 'Paid',
          academic_year: academicYear,
          financial_year: fy,
          transaction_id: tx.id,
          paid_by: session?.email || '',
        });
      }));
      toast.success(`${unpaid.length} salary payment(s) marked as Paid — expenses recorded in Financial Management`);
      loadData();
    } catch { toast.error('Failed to process payments'); }
    finally { setPaying(false); }
  };

  const markOnePaid = async (d) => {
    if (!payDate) { toast.error('Select payment date'); return; }
    setPaying(true);
    const session = (() => { try { return JSON.parse(localStorage.getItem('staff_session')); } catch { return null; } })();
    const monthLabel = `${MONTHS[selMonth]} ${selYear}`;
    const fy = getFinancialYear(payDate);
    const payDateObj = new Date(payDate);
    const ayStart = payDateObj.getMonth() >= 3 ? payDateObj.getFullYear() : payDateObj.getFullYear() - 1;
    const ay = `${ayStart}-${String(ayStart + 1).slice(2)}`;
    try {
      const tx = await base44.entities.Transaction.create({
        type: 'Expense',
        category: 'Salaries & Wages',
        description: `Salary: ${d.staff.name} — ${monthLabel} (${d.daysPresent} days)`,
        amount: d.earned,
        transaction_date: payDate,
        payment_method: payMethod,
        status: 'Completed',
        academic_year: ay,
        financial_year: fy,
        recorded_by: session?.email || '',
      });
      await base44.entities.SalaryPayment.create({
        staff_id: d.staff.id,
        staff_name: d.staff.name,
        designation: d.staff.designation || d.staff.role || '',
        salary_month: monthLabel,
        base_salary: d.config.monthly_salary,
        allowances: 0,
        deductions: 0,
        net_payable: d.earned,
        payment_date: payDate,
        payment_method: payMethod,
        status: 'Paid',
        academic_year: academicYear,
        financial_year: fy,
        transaction_id: tx.id,
        paid_by: session?.email || '',
      });
      toast.success(`Salary paid for ${d.staff.name}`);
      loadData();
    } catch { toast.error('Failed'); }
    finally { setPaying(false); }
  };

  const totalEarned = staffData.reduce((s, d) => s + (d.config ? d.earned : 0), 0);
  const totalPaid = staffData.filter(d => d.payment).reduce((s, d) => s + (d.payment.net_payable || 0), 0);
  const totalPending = totalEarned - totalPaid;
  const allPaid = staffData.filter(d => d.config).every(d => d.payment);

  return (
    <div className="space-y-4 pb-32">
      {/* Month selector */}
      <div className="flex gap-2 items-center flex-wrap">
        <Calendar className="h-4 w-4 text-slate-500 flex-shrink-0" />
        <select value={selMonth} onChange={e => setSelMonth(parseInt(e.target.value))}
          className="border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm">
          {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
        </select>
        <select value={selYear} onChange={e => setSelYear(parseInt(e.target.value))}
          className="border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm">
          {[2024, 2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
        </select>
      </div>

      {/* Month Stats Summary */}
      {monthStats && !loading && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {[
            { label: 'Total Days', value: monthStats.totalDays, color: 'slate' },
            { label: 'Sundays', value: monthStats.sundays, color: 'gray' },
            { label: 'Total Holidays', value: monthStats.totalHolidays, color: 'amber' },
            { label: 'Paid Holidays', value: monthStats.paidHolidays, color: 'green' },
            { label: 'Unpaid Holidays', value: monthStats.unpaidHolidays, color: 'red' },
            { label: 'Working Days', value: monthStats.effectiveWorkingDays, color: 'indigo' },
          ].map(({ label, value, color }) => (
            <div key={label} className={`bg-${color}-50 dark:bg-${color}-900/20 rounded-xl p-3 text-center border border-${color}-100 dark:border-${color}-800`}>
              <p className={`text-lg font-bold text-${color}-700 dark:text-${color}-300`}>{value}</p>
              <p className={`text-[10px] text-${color}-500 dark:text-${color}-400 font-medium`}>{label}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-10"><div className="w-7 h-7 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" /></div>
      ) : (
        <>
          {/* Staff List */}
          <div className="space-y-2">
            {staffData.map(d => {
              const isPaid = !!d.payment;
              const hasConfig = !!d.config;
              return (
                <Card key={d.staff.id} className={`border-0 shadow-sm dark:bg-gray-800 ${isPaid ? 'opacity-75' : ''}`}>
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm text-slate-900 dark:text-white">{d.staff.name}</p>
                          {isPaid && <Badge variant="outline" className="text-[10px] bg-green-100 text-green-700 border-green-200"><CheckCircle2 className="h-3 w-3 mr-0.5 inline" />Paid</Badge>}
                          {!hasConfig && <Badge variant="outline" className="text-[10px] bg-slate-100 text-slate-500">No salary configured</Badge>}
                        </div>
                        <p className="text-xs text-slate-500">{d.staff.designation || d.staff.role}</p>
                        {hasConfig && (
                          <div className="flex gap-3 mt-1.5 text-xs text-slate-500 flex-wrap">
                            <span>Monthly: ₹{(d.config.monthly_salary || 0).toLocaleString('en-IN')}</span>
                            <span>Days Present: <strong className="text-slate-700 dark:text-gray-300">{d.daysPresent}</strong> <span className="text-[10px] text-green-600">(incl. paid holidays)</span></span>
                            <span>Working Days: <strong className="text-slate-700 dark:text-gray-300">{d.workingDays}</strong> <span className="text-[10px] text-blue-500">(auto)</span></span>
                            <span>Daily Rate: ₹{d.dailyRate.toFixed(0)}</span>
                          </div>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        {hasConfig && (
                          <>
                            <p className={`font-bold text-base ${isPaid ? 'text-green-600' : 'text-slate-900 dark:text-white'}`}>
                              ₹{d.earned.toLocaleString('en-IN')}
                            </p>
                            {isPaid && <p className="text-[10px] text-slate-400">{d.payment.payment_method}</p>}
                          </>
                        )}
                        {hasConfig && !isPaid && (
                          <Button size="sm" onClick={() => markOnePaid(d)} disabled={paying}
                            className="mt-1 bg-green-600 hover:bg-green-700 text-white text-xs h-6 px-2">
                            Mark Paid
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {/* Sticky bottom panel */}
      <div className="fixed bottom-20 left-0 right-0 px-4 z-40">
        <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-slate-200 dark:border-gray-700 p-4">
          {/* Totals row */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="text-center">
              <p className="text-[10px] text-slate-500">Total Earned</p>
              <p className="font-bold text-sm text-slate-800 dark:text-white flex items-center justify-center gap-0.5">
                <IndianRupee className="h-3 w-3" />{totalEarned.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-green-600">Paid</p>
              <p className="font-bold text-sm text-green-700 flex items-center justify-center gap-0.5">
                <IndianRupee className="h-3 w-3" />{totalPaid.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-amber-600">Pending</p>
              <p className="font-bold text-sm text-amber-700 flex items-center justify-center gap-0.5">
                <IndianRupee className="h-3 w-3" />{totalPending.toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          {/* Payment controls */}
          {!allPaid && (
            <div className="flex gap-2 items-center flex-wrap">
              <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)}
                className="border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-2 py-1.5 text-sm flex-1 min-w-28" />
              <select value={payMethod} onChange={e => setPayMethod(e.target.value)}
                className="border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-2 py-1.5 text-sm">
                {['Cash','Bank Transfer','Cheque','UPI'].map(m => <option key={m}>{m}</option>)}
              </select>
              <Button onClick={markAllPaid} disabled={paying}
                className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4">
                {paying ? 'Processing...' : '✓ Pay All Pending'}
              </Button>
            </div>
          )}
          {allPaid && staffData.filter(d => d.config).length > 0 && (
            <p className="text-center text-green-600 font-semibold text-sm">✓ All salaries paid for {MONTHS[selMonth]} {selYear}</p>
          )}
        </div>
      </div>
    </div>
  );
}