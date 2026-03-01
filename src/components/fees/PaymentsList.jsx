import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Receipt } from 'lucide-react';
import { format } from 'date-fns';

const CLASSES = ['All', 'Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

export default function PaymentsList({ academicYear }) {
  const [classFilter, setClassFilter] = useState('All');
  const [search, setSearch] = useState('');

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ['fee-payments-all', academicYear, classFilter],
    queryFn: () => {
      const filter = { academic_year: academicYear };
      if (classFilter !== 'All') filter.class_name = classFilter;
      return base44.entities.FeePayment.filter(filter, '-payment_date', 200);
    },
    enabled: !!academicYear
  });

  const filtered = payments.filter(p =>
    p.student_name?.toLowerCase().includes(search.toLowerCase()) ||
    p.receipt_no?.toLowerCase().includes(search.toLowerCase()) ||
    p.student_id?.toLowerCase().includes(search.toLowerCase())
  );

  const totalCollected = filtered.reduce((s, p) => s + (p.amount_paid || 0), 0);

  const modeColor = { Cash: 'bg-green-100 text-green-800', Cheque: 'bg-blue-100 text-blue-800', Online: 'bg-purple-100 text-purple-800', UPI: 'bg-indigo-100 text-indigo-800', DD: 'bg-orange-100 text-orange-800' };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={classFilter} onValueChange={setClassFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="All Classes" /></SelectTrigger>
          <SelectContent>{CLASSES.map(c => <SelectItem key={c} value={c}>{c === 'All' ? 'All Classes' : `Class ${c}`}</SelectItem>)}</SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Search by student, receipt…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="text-sm font-semibold text-slate-700 ml-auto">
          Total: <span className="text-emerald-700">₹{totalCollected.toLocaleString()}</span>
          <span className="text-slate-400 font-normal ml-2">({filtered.length} records)</span>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-slate-400">Loading...</div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-slate-400">
          <Receipt className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>No payments found</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => (
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