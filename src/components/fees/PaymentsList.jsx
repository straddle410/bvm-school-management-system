import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Receipt, RotateCcw } from 'lucide-react';
import { format, startOfWeek, startOfMonth } from 'date-fns';
import ReversalModal from './ReversalModal';

const CLASSES = ['All', 'Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

const today = () => format(new Date(), 'yyyy-MM-dd');
const yesterday = () => format(new Date(Date.now() - 86400000), 'yyyy-MM-dd');
const weekStart = () => format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
const monthStart = () => format(startOfMonth(new Date()), 'yyyy-MM-dd');

const PRESETS = [
  { label: 'Today', from: today, to: today },
  { label: 'Yesterday', from: yesterday, to: yesterday },
  { label: 'This Week', from: weekStart, to: today },
  { label: 'This Month', from: monthStart, to: today },
];

const modeColor = {
  Cash: 'bg-green-100 text-green-800',
  Cheque: 'bg-blue-100 text-blue-800',
  Online: 'bg-purple-100 text-purple-800',
  UPI: 'bg-indigo-100 text-indigo-800',
  DD: 'bg-orange-100 text-orange-800'
};

export default function PaymentsList({ academicYear }) {
  const [classFilter, setClassFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [activePreset, setActivePreset] = useState('Today');
  const [fromDate, setFromDate] = useState(today());
  const [toDate, setToDate] = useState(today());

  const applyPreset = (preset) => {
    setActivePreset(preset.label);
    setFromDate(preset.from());
    setToDate(preset.to());
  };

  const handleFromChange = (val) => {
    setFromDate(val);
    setActivePreset(null);
  };

  const handleToChange = (val) => {
    setToDate(val);
    setActivePreset(null);
  };

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['fee-payments-all', academicYear, classFilter, fromDate, toDate],
    queryFn: () => {
      const filter = { academic_year: academicYear };
      if (classFilter !== 'All') filter.class_name = classFilter;
      return base44.entities.FeePayment.filter(filter, '-payment_date', 500);
    },
    enabled: !!academicYear && !!fromDate && !!toDate
  });

  // Date range filter + search (client-side, fast)
  const filtered = payments.filter(p => {
    const inRange = (!fromDate || p.payment_date >= fromDate) && (!toDate || p.payment_date <= toDate);
    const matchSearch = !search ||
      p.student_name?.toLowerCase().includes(search.toLowerCase()) ||
      p.receipt_no?.toLowerCase().includes(search.toLowerCase()) ||
      p.student_id?.toLowerCase().includes(search.toLowerCase());
    return inRange && matchSearch;
  });

  // Sort latest first
  const sorted = [...filtered].sort((a, b) => (b.payment_date || '').localeCompare(a.payment_date || ''));

  const totalCollected = sorted.reduce((s, p) => s + (p.amount_paid || 0), 0);

  return (
    <div className="space-y-4">
      {/* Date Range + Presets */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-3 space-y-3">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map(preset => (
              <Button
                key={preset.label}
                size="sm"
                variant={activePreset === preset.label ? 'default' : 'outline'}
                className={activePreset === preset.label ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : ''}
                onClick={() => applyPreset(preset)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500 font-medium whitespace-nowrap">From</label>
              <Input type="date" className="w-36 text-sm" value={fromDate} onChange={e => handleFromChange(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500 font-medium whitespace-nowrap">To</label>
              <Input type="date" className="w-36 text-sm" value={toDate} onChange={e => handleToChange(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters Row */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={classFilter} onValueChange={setClassFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All Classes" /></SelectTrigger>
          <SelectContent>{CLASSES.map(c => <SelectItem key={c} value={c}>{c === 'All' ? 'All Classes' : `Class ${c}`}</SelectItem>)}</SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Search by student, receipt…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="text-sm font-semibold text-slate-700 ml-auto whitespace-nowrap">
          <span className="text-emerald-700">₹{totalCollected.toLocaleString()}</span>
          <span className="text-slate-400 font-normal ml-2">({sorted.length} receipt{sorted.length !== 1 ? 's' : ''})</span>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-8 text-slate-400">Loading...</div>
      ) : sorted.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-slate-400">
          <Receipt className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>No receipts found for this period</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {sorted.map(p => (
            <Card key={p.id} className="border-0 shadow-sm">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <Receipt className="h-4 w-4 text-emerald-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-slate-900 text-sm">{p.student_name}</p>
                    <span className="text-xs text-slate-400">{p.student_id}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${modeColor[p.payment_mode] || 'bg-slate-100'}`}>{p.payment_mode}</span>
                  </div>
                  <p className="text-xs text-slate-500">{p.installment_name} · {p.payment_date} · #{p.receipt_no}</p>
                  {p.reference_no && <p className="text-xs text-slate-400">Ref: {p.reference_no}</p>}
                </div>
                <p className="font-bold text-emerald-700 flex-shrink-0">₹{(p.amount_paid || 0).toLocaleString()}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}