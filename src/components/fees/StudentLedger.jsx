import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, User, TrendingDown } from 'lucide-react';
import PaymentModal from './PaymentModal';

const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

const statusColor = {
  Pending: 'bg-yellow-100 text-yellow-800',
  Partial: 'bg-blue-100 text-blue-800',
  Paid: 'bg-green-100 text-green-800',
  Overdue: 'bg-red-100 text-red-800',
  Waived: 'bg-slate-100 text-slate-600'
};

export default function StudentLedger({ academicYear }) {
  const [selectedClass, setSelectedClass] = useState('');
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [payingInvoice, setPayingInvoice] = useState(null);

  const { data: students = [] } = useQuery({
    queryKey: ['students-published', selectedClass, academicYear],
    queryFn: () => base44.entities.Student.filter({ class_name: selectedClass, academic_year: academicYear, status: 'Published' }),
    enabled: !!selectedClass && !!academicYear
  });

  const { data: invoices = [], refetch: refetchInvoices } = useQuery({
    queryKey: ['fee-invoices', selectedStudent?.student_id, academicYear],
    queryFn: () => base44.entities.FeeInvoice.filter({ student_id: selectedStudent.student_id, academic_year: academicYear }),
    enabled: !!selectedStudent && !!academicYear
  });

  const { data: payments = [], refetch: refetchPayments } = useQuery({
    queryKey: ['fee-payments-student', selectedStudent?.student_id, academicYear],
    queryFn: () => base44.entities.FeePayment.filter({ student_id: selectedStudent.student_id, academic_year: academicYear }),
    enabled: !!selectedStudent && !!academicYear
  });

  const filteredStudents = students.filter(s => s.name?.toLowerCase().includes(search.toLowerCase()) || s.student_id?.toLowerCase().includes(search.toLowerCase()));

  const totalDue = invoices.reduce((s, i) => s + (i.total_amount || 0), 0);
  const totalPaid = invoices.reduce((s, i) => s + (i.paid_amount || 0), 0);
  const totalBalance = invoices.reduce((s, i) => s + (i.balance || 0), 0);

  const sortedInvoices = [...invoices].sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Select value={selectedClass} onValueChange={(v) => { setSelectedClass(v); setSelectedStudent(null); setSearch(''); }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Select Class" /></SelectTrigger>
          <SelectContent>{CLASSES.map(c => <SelectItem key={c} value={c}>Class {c}</SelectItem>)}</SelectContent>
        </Select>
        {selectedClass && (
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input placeholder="Search student…" className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        )}
      </div>

      {selectedClass && !selectedStudent && (
        <div className="grid gap-2">
          {filteredStudents.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-slate-400">No students found</CardContent></Card>
          ) : filteredStudents.map(s => (
            <Card key={s.id} className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={() => setSelectedStudent(s)}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="h-9 w-9 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-indigo-700 font-bold text-sm">{s.name?.[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900">{s.name}</p>
                  <p className="text-xs text-slate-500">{s.student_id} · Roll {s.roll_no}</p>
                </div>
                <span className="text-xs text-slate-400">→</span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedStudent && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setSelectedStudent(null)} className="text-sm text-indigo-600 hover:underline">← Back</button>
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-slate-400" />
              <span className="font-semibold text-slate-800">{selectedStudent.name}</span>
              <span className="text-sm text-slate-500">{selectedStudent.student_id}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Due', value: totalDue, color: 'text-slate-800' },
              { label: 'Paid', value: totalPaid, color: 'text-emerald-700' },
              { label: 'Balance', value: totalBalance, color: totalBalance > 0 ? 'text-red-600' : 'text-emerald-700' }
            ].map(({ label, value, color }) => (
              <Card key={label} className="border-0 shadow-sm">
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className={`text-lg font-bold ${color}`}>₹{value.toLocaleString()}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {sortedInvoices.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-slate-400">No invoices generated for this student yet.</CardContent></Card>
          ) : (
            <div className="space-y-3">
              {sortedInvoices.map(inv => {
                const invPayments = payments.filter(p => p.invoice_id === inv.id);
                return (
                  <Card key={inv.id} className="border-0 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50 flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-slate-800">{inv.installment_name}</span>
                        {inv.due_date && <span className="ml-2 text-xs text-slate-500">Due: {inv.due_date}</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[inv.status] || 'bg-slate-100'}`}>{inv.status}</span>
                        <span className="font-bold text-slate-800">₹{(inv.total_amount || 0).toLocaleString()}</span>
                      </div>
                    </div>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500">Paid: <span className="font-medium text-emerald-700">₹{(inv.paid_amount || 0).toLocaleString()}</span></span>
                        <span className="text-slate-500">Balance: <span className={`font-medium ${(inv.balance || 0) > 0 ? 'text-red-600' : 'text-emerald-700'}`}>₹{(inv.balance || 0).toLocaleString()}</span></span>
                      </div>

                      {invPayments.length > 0 && (
                        <div className="border-t pt-3 space-y-1">
                          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Payments</p>
                          {invPayments.map(p => (
                            <div key={p.id} className="flex items-center justify-between text-sm">
                              <span className="text-slate-600">{p.payment_date} · {p.payment_mode}</span>
                              <span className="font-medium text-emerald-700">₹{(p.amount_paid || 0).toLocaleString()} <span className="text-xs text-slate-400">#{p.receipt_no}</span></span>
                            </div>
                          ))}
                        </div>
                      )}

                      {inv.status !== 'Paid' && inv.status !== 'Waived' && (
                        <Button size="sm" className="w-full" onClick={() => setPayingInvoice(inv)}>
                          Record Payment
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {payingInvoice && (
        <PaymentModal
          invoice={payingInvoice}
          onClose={() => setPayingInvoice(null)}
          onSuccess={() => { setPayingInvoice(null); refetchInvoices(); refetchPayments(); }}
        />
      )}
    </div>
  );
}