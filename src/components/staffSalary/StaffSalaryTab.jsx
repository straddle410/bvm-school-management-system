import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, CheckCircle2, Clock, IndianRupee } from 'lucide-react';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

function getFinancialYear(dateStr) {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = d.getMonth();
  const start = m >= 3 ? y : y - 1;
  return `${start}-${start + 1}`;
}

const EMPTY_FORM = {
  staff_id: '', staff_name: '', designation: '',
  salary_month: '', base_salary: '', allowances: '0',
  deductions: '0', payment_date: '', payment_method: 'Bank Transfer',
  reference_number: '',
};

export default function StaffSalaryTab({ academicYear }) {
  const [payments, setPayments] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [filterMonth, setFilterMonth] = useState('');

  useEffect(() => { loadData(); }, [academicYear]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [pays, staff] = await Promise.all([
        base44.entities.SalaryPayment.filter({ academic_year: academicYear }),
        base44.entities.StaffAccount.filter({ is_active: true }),
      ]);
      setPayments(pays.sort((a, b) => (b.created_date || '').localeCompare(a.created_date || '')));
      setStaffList(staff);
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const net = (f) => {
    const b = parseFloat(f.base_salary) || 0;
    const a = parseFloat(f.allowances) || 0;
    const d = parseFloat(f.deductions) || 0;
    return b + a - d;
  };

  const handleStaffChange = (staffId) => {
    const s = staffList.find(x => x.id === staffId);
    setForm(f => ({ ...f, staff_id: staffId, staff_name: s?.name || '', designation: s?.designation || s?.role || '' }));
  };

  const handleSave = async () => {
    if (!form.staff_id || !form.salary_month || !form.base_salary) {
      toast.error('Fill staff, month and base salary');
      return;
    }
    setSaving(true);
    try {
      const netPayable = net(form);
      await base44.entities.SalaryPayment.create({
        ...form,
        base_salary: parseFloat(form.base_salary),
        allowances: parseFloat(form.allowances) || 0,
        deductions: parseFloat(form.deductions) || 0,
        net_payable: netPayable,
        status: 'Pending',
        academic_year: academicYear,
      });
      toast.success('Salary record created');
      setShowForm(false);
      setForm(EMPTY_FORM);
      loadData();
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const markPaid = async (payment) => {
    if (!payment.payment_date || !payment.payment_method) {
      toast.error('Set payment date and method first');
      return;
    }
    setSaving(true);
    const session = (() => { try { return JSON.parse(localStorage.getItem('staff_session')); } catch { return null; } })();
    try {
      const fy = getFinancialYear(payment.payment_date);
      const payDate = new Date(payment.payment_date);
      const ayStart = payDate.getMonth() >= 3 ? payDate.getFullYear() : payDate.getFullYear() - 1;
      const ay = `${ayStart}-${String(ayStart + 1).slice(2)}`;

      // Create expense transaction in financial module
      const tx = await base44.entities.Transaction.create({
        type: 'Expense',
        category: 'Salaries & Wages',
        description: `Salary: ${payment.staff_name} — ${payment.salary_month}`,
        amount: payment.net_payable,
        transaction_date: payment.payment_date,
        payment_method: payment.payment_method,
        reference_number: payment.reference_number || '',
        status: 'Completed',
        academic_year: ay,
        financial_year: fy,
        recorded_by: session?.email || '',
      });

      await base44.entities.SalaryPayment.update(payment.id, {
        status: 'Paid',
        paid_by: session?.email || '',
        transaction_id: tx.id,
      });

      toast.success('Marked as Paid — expense recorded in Financial Management');
      loadData();
    } catch { toast.error('Failed to mark as paid'); }
    finally { setSaving(false); }
  };

  const updatePaymentField = async (id, field, value) => {
    await base44.entities.SalaryPayment.update(id, { [field]: value });
    setPayments(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const totalPaid = payments.filter(p => p.status === 'Paid').reduce((s, p) => s + (p.net_payable || 0), 0);
  const totalPending = payments.filter(p => p.status === 'Pending').reduce((s, p) => s + (p.net_payable || 0), 0);

  const filtered = filterMonth ? payments.filter(p => p.salary_month?.includes(filterMonth)) : payments;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 border border-green-200 text-center">
          <p className="text-xs text-green-600 font-medium">Paid This Year</p>
          <p className="text-base font-bold text-green-700">₹{totalPaid.toLocaleString('en-IN')}</p>
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 border border-amber-200 text-center">
          <p className="text-xs text-amber-600 font-medium">Pending</p>
          <p className="text-base font-bold text-amber-700">₹{totalPending.toLocaleString('en-IN')}</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-2 items-center">
        <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
          className="flex-1 border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm">
          <option value="">All Months</option>
          {MONTHS.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <Button size="sm" onClick={() => setShowForm(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-10"><div className="w-7 h-7 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-slate-500">No salary records found.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => (
            <Card key={p.id} className="border-0 shadow-sm dark:bg-gray-800">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{p.staff_name}</p>
                    <p className="text-xs text-slate-500">{p.designation} · {p.salary_month}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-800 dark:text-white flex items-center gap-1">
                      <IndianRupee className="h-3.5 w-3.5" />{(p.net_payable || 0).toLocaleString('en-IN')}
                    </p>
                    <Badge variant="outline" className={p.status === 'Paid' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-amber-100 text-amber-700 border-amber-200'}>
                      {p.status === 'Paid' ? <CheckCircle2 className="h-3 w-3 mr-1 inline" /> : <Clock className="h-3 w-3 mr-1 inline" />}
                      {p.status}
                    </Badge>
                  </div>
                </div>
                <div className="text-xs text-slate-500 flex gap-4">
                  <span>Base: ₹{(p.base_salary || 0).toLocaleString('en-IN')}</span>
                  <span>Allow: +₹{(p.allowances || 0).toLocaleString('en-IN')}</span>
                  <span>Deduct: -₹{(p.deductions || 0).toLocaleString('en-IN')}</span>
                </div>
                {p.status === 'Pending' && (
                  <div className="flex gap-2 flex-wrap pt-1 border-t dark:border-gray-700">
                    <input
                      type="date"
                      defaultValue={p.payment_date || ''}
                      onBlur={e => updatePaymentField(p.id, 'payment_date', e.target.value)}
                      placeholder="Payment Date"
                      className="border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-2 py-1 text-xs flex-1 min-w-28"
                    />
                    <select
                      defaultValue={p.payment_method || 'Bank Transfer'}
                      onBlur={e => updatePaymentField(p.id, 'payment_method', e.target.value)}
                      className="border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-2 py-1 text-xs"
                    >
                      {['Cash','Bank Transfer','Cheque','UPI'].map(m => <option key={m}>{m}</option>)}
                    </select>
                    <Button size="sm" onClick={() => markPaid(p)} disabled={saving}
                      className="bg-green-600 hover:bg-green-700 text-white text-xs h-7">
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark Paid
                    </Button>
                  </div>
                )}
                {p.status === 'Paid' && (
                  <p className="text-xs text-green-600 dark:text-green-400 pt-1 border-t dark:border-gray-700">
                    ✓ Paid on {p.payment_date} via {p.payment_method} · Expense auto-recorded in Financial Management
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Form Dialog */}
      <Dialog open={showForm} onOpenChange={v => { setShowForm(v); if (!v) setForm(EMPTY_FORM); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Add Salary Record</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-gray-300">Staff Member</label>
              <select value={form.staff_id} onChange={e => handleStaffChange(e.target.value)}
                className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm mt-1">
                <option value="">Select staff...</option>
                {staffList.map(s => <option key={s.id} value={s.id}>{s.name} — {s.designation || s.role}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-gray-300">Salary Month</label>
              <select value={form.salary_month} onChange={e => setForm(f => ({ ...f, salary_month: e.target.value }))}
                className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm mt-1">
                <option value="">Select month...</option>
                {MONTHS.map(m => <option key={m} value={`${m} ${new Date().getFullYear()}`}>{m} {new Date().getFullYear()}</option>)}
              </select>
            </div>
            {[
              { label: 'Base Salary (₹)', key: 'base_salary' },
              { label: 'Allowances (₹)', key: 'allowances' },
              { label: 'Deductions (₹)', key: 'deductions' },
            ].map(({ label, key }) => (
              <div key={key}>
                <label className="text-sm font-medium text-slate-700 dark:text-gray-300">{label}</label>
                <input type="number" value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm mt-1"
                />
              </div>
            ))}
            <div className="bg-slate-50 dark:bg-gray-700 rounded-lg p-3 text-sm">
              <span className="text-slate-600 dark:text-gray-300">Net Payable: </span>
              <span className="font-bold text-slate-900 dark:text-white">₹{net(form).toLocaleString('en-IN')}</span>
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}>Cancel</Button>
              <Button className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Record'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}