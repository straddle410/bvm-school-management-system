import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

const INCOME_CATEGORIES = ['Fees Collected', 'Other Income'];
const EXPENSE_CATEGORIES = [
  'Rent', 'Loan EMI', 'Salaries & Wages', 'Diesel & Fuel', 'Stationery & Supplies',
  'Gifts & Donations', 'Utilities', 'Maintenance', 'Curriculum & Books', 'Transport Costs',
  'Hostel Costs', 'Marketing & Advertising', 'Insurance', 'Bank Charges', 'Tax Payments',
  'IT & Software', 'Events & Activities', 'Other Expenses',
];
const TRANSFER_CATEGORIES = ['Cash Deposit to Bank'];

const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'Cheque', 'UPI', 'Online', 'Debit Card', 'Credit Card'];
const STATUSES = ['Completed', 'Pending Bank Deposit', 'Reconciled'];

export default function TransactionForm({ initial, onSave, onCancel }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    type: 'Expense',
    category: 'Rent',
    description: '',
    amount: '',
    transaction_date: today,
    payment_method: 'Cash',
    status: 'Completed',
    reference_number: '',
  });

  useEffect(() => {
    if (initial) {
      setForm({ ...initial, amount: String(initial.amount || '') });
    }
  }, [initial]);

  const set = (field, val) => setForm(f => ({ ...f, [field]: val }));

  const getCategories = () => {
    if (form.type === 'Income') return INCOME_CATEGORIES;
    if (form.type === 'Bank Transfer') return TRANSFER_CATEGORIES;
    return EXPENSE_CATEGORIES;
  };

  const handleTypeChange = (type) => {
    const cats = type === 'Income' ? INCOME_CATEGORIES : type === 'Bank Transfer' ? TRANSFER_CATEGORIES : EXPENSE_CATEGORIES;
    setForm(f => ({ ...f, type, category: cats[0] }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) return;
    onSave({ ...form, amount: Number(form.amount) });
  };

  const Field = ({ label, children }) => (
    <div>
      <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1">{label}</label>
      {children}
    </div>
  );

  const cls = "w-full border dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-3 py-2 text-sm";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-3 gap-1">
        {['Income', 'Expense', 'Bank Transfer'].map(t => (
          <button
            key={t} type="button"
            onClick={() => handleTypeChange(t)}
            className={`rounded-lg px-2 py-2 text-xs font-semibold border transition-all ${form.type === t ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white dark:bg-gray-700 text-slate-600 dark:text-gray-300 border-slate-200 dark:border-gray-600'}`}
          >{t}</button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          <select className={cls} value={form.category} onChange={e => set('category', e.target.value)}>
            {getCategories().map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Amount (₹)">
          <input type="number" className={cls} placeholder="0.00" value={form.amount} onChange={e => set('amount', e.target.value)} required min="0.01" step="0.01" />
        </Field>
      </div>

      <Field label="Description">
        <input type="text" className={cls} placeholder="Brief description..." value={form.description} onChange={e => set('description', e.target.value)} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">
          <input type="date" className={cls} value={form.transaction_date} onChange={e => set('transaction_date', e.target.value)} required />
        </Field>
        <Field label="Payment Method">
          <select className={cls} value={form.payment_method} onChange={e => set('payment_method', e.target.value)}>
            {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Status">
          <select className={cls} value={form.status} onChange={e => set('status', e.target.value)}>
            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Reference No. (Optional)">
          <input type="text" className={cls} placeholder="Cheque / UTR / Invoice..." value={form.reference_number} onChange={e => set('reference_number', e.target.value)} />
        </Field>
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>
        <Button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white">Save Transaction</Button>
      </div>
    </form>
  );
}