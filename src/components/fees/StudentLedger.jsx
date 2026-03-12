import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, User } from 'lucide-react';
import PaymentModal from './PaymentModal';
import StudentListVirtual from './StudentListVirtual';

const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

const statusColor = {
  Pending: 'bg-yellow-100 text-yellow-800',
  Partial: 'bg-blue-100 text-blue-800',
  Paid: 'bg-green-100 text-green-800',
  Overdue: 'bg-red-100 text-red-800',
  Waived: 'bg-slate-100 text-slate-600'
};

export default function StudentLedger({ academicYear, isArchivedYear }) {
  const queryClient = useQueryClient();
  const [selectedClass, setSelectedClass] = useState('');
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [payingInvoice, setPayingInvoice] = useState(null);
  const [studentPage, setStudentPage] = useState(0);
  const STUDENTS_LIMIT = 50;

  const { data: students = [] } = useQuery({
    queryKey: ['students-published', selectedClass, academicYear, studentPage],
    queryFn: async () => {
      const all = await base44.entities.Student.filter({ 
        class_name: selectedClass, 
        academic_year: academicYear, 
        status: 'Published', 
        is_deleted: false,
        is_active: true
      });
      const start = studentPage * STUDENTS_LIMIT;
      return all.slice(start, start + STUDENTS_LIMIT);
    },
    enabled: !!selectedClass && !!academicYear,
    staleTime: 5 * 60 * 1000, // 5 min cache
    gcTime: 10 * 60 * 1000 // 10 min memory
  });

  const { data: allInvoices = [], refetch: refetchInvoice } = useQuery({
    queryKey: ['fee-invoice', selectedStudent?.student_id, academicYear],
    queryFn: () => base44.entities.FeeInvoice.filter({ student_id: selectedStudent.student_id, academic_year: academicYear }),
    enabled: !!selectedStudent && !!academicYear
  });

  const invoice = allInvoices.find(i => (i.invoice_type || 'ANNUAL') === 'ANNUAL') || null;
  const adhocInvoices = allInvoices.filter(i => i.invoice_type === 'ADHOC' && i.status !== 'Cancelled');

  const { data: payments = [], refetch: refetchPayments } = useQuery({
    queryKey: ['fee-payments-student', selectedStudent?.student_id, academicYear],
    queryFn: () => base44.entities.FeePayment.filter({ student_id: selectedStudent.student_id, academic_year: academicYear }),
    enabled: !!selectedStudent && !!academicYear
  });

  // Payments keyed by invoice_id for adhoc
  const paymentsByInvoice = payments.reduce((acc, p) => {
    if (!acc[p.invoice_id]) acc[p.invoice_id] = [];
    acc[p.invoice_id].push(p);
    return acc;
  }, {});

  const { data: discounts = [] } = useQuery({
    queryKey: ['fee-discounts-student', selectedStudent?.student_id, academicYear],
    queryFn: () => base44.entities.StudentFeeDiscount.filter({ student_id: selectedStudent.student_id, academic_year: academicYear, status: 'Active' }),
    enabled: !!selectedStudent && !!academicYear
  });

  // Compute ledger figures from source of truth
  const gross = invoice?.gross_total ?? invoice?.total_amount ?? 0;
  const discountSum = discounts.reduce((sum, d) => {
    if (d.discount_type === 'PERCENT') return sum + (gross * d.discount_value / 100);
    return sum + (d.discount_value || 0);
  }, 0);
  const discount = Math.min(discountSum, gross);
  const net = gross - discount;

  // Calculate paid: ONLY ANNUAL payments (not ADHOC)
  // Filters: actual cash payments, linked to ANNUAL invoice, not VOID/CANCELLED
  const annualPayments = payments.filter(p => 
    p.invoice_id === invoice?.id && 
    p.entry_type === 'CASH_PAYMENT' &&
    p.affects_cash === true && 
    p.status !== 'VOID' &&
    p.status !== 'CANCELLED'
  );
  const paid = annualPayments.reduce((sum, p) => sum + (p.amount_paid || 0), 0);

  // Calculate ADHOC paid (for display below paid total)
  const adhocPaid = payments.reduce((sum, p) => {
    const isAdhocPayment = adhocInvoices.some(inv => inv.id === p.invoice_id);
    if (isAdhocPayment && p.entry_type === 'CASH_PAYMENT' && p.affects_cash === true && p.status !== 'VOID' && p.status !== 'CANCELLED') {
      return sum + (p.amount_paid || 0);
    }
    return sum;
  }, 0);

  const balance = Math.max(net - paid, 0);

  const filteredStudents = useMemo(() => 
    students.filter(s =>
      s.name?.toLowerCase().includes(search.toLowerCase()) || s.student_id?.toLowerCase().includes(search.toLowerCase())
    ),
    [students, search]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Select value={selectedClass} onValueChange={(v) => { setSelectedClass(v); setSelectedStudent(null); setSearch(''); setStudentPage(0); }}>
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
        <>
          <StudentListVirtual students={filteredStudents} onSelect={setSelectedStudent} />
          {students.length === STUDENTS_LIMIT && (
            <div className="flex justify-center gap-2 pt-2">
              <button onClick={() => setStudentPage(p => Math.max(0, p - 1))} disabled={studentPage === 0} className="px-3 py-1 text-sm border rounded disabled:opacity-50">Prev</button>
              <span className="px-3 py-1 text-sm text-slate-500">Page {studentPage + 1}</span>
              <button onClick={() => setStudentPage(p => p + 1)} className="px-3 py-1 text-sm border rounded">Next</button>
            </div>
          )}
        </>
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

          {!invoice ? (
            <Card><CardContent className="py-8 text-center text-slate-400">No annual invoice generated for this student yet.</CardContent></Card>
          ) : (
            <Card className="border-0 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 dark:bg-gray-700 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-800">Annual Fee</span>
                  {invoice.due_date && <span className="ml-2 text-xs text-slate-500">Due: {invoice.due_date}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[invoice.status] || 'bg-slate-100'}`}>{invoice.status}</span>
                </div>
              </div>

              <CardContent className="p-4 space-y-3">
                {/* Fee breakdown */}
                {(invoice.fee_heads || []).filter(fh => fh.gross_amount > 0).length > 0 && (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left pb-1.5 text-slate-500 dark:text-gray-400 font-medium text-xs">Fee Head</th>
                        <th className="text-right pb-1.5 text-slate-500 dark:text-gray-400 font-medium text-xs">Gross</th>
                        {invoice.discount_total > 0 && <th className="text-right pb-1.5 text-slate-500 dark:text-gray-400 font-medium text-xs">Discount</th>}
                        <th className="text-right pb-1.5 text-slate-500 dark:text-gray-400 font-medium text-xs">Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(invoice.fee_heads || []).filter(fh => fh.gross_amount > 0).map((fh, i) => (
                        <tr key={i} className="border-b border-slate-50">
                          <td className="py-1.5 text-slate-600">{fh.fee_head_name}</td>
                          <td className="py-1.5 text-right text-slate-500">₹{(fh.gross_amount || 0).toLocaleString()}</td>
                          {invoice.discount_total > 0 && (
                            <td className="py-1.5 text-right text-emerald-600">
                              {fh.discount_amount > 0 ? `−₹${fh.discount_amount.toLocaleString()}` : '—'}
                            </td>
                          )}
                          <td className="py-1.5 text-right font-medium">₹{(fh.net_amount || fh.amount || 0).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* Discount row */}
                {discount > 0 && (
                  <div className="flex justify-between items-center text-sm bg-emerald-50 rounded-lg px-3 py-2">
                    <span className="text-emerald-700 font-medium flex items-center gap-1.5">
                      {discounts.some(d => d.notes?.startsWith('[SIBLING]')) ? (
                        <span className="flex items-center gap-1">
                          <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-semibold">SIBLING</span>
                          Sibling Discount
                        </span>
                      ) : 'Discount Applied'}
                    </span>
                    <span className="text-emerald-700 font-bold">−₹{discount.toLocaleString()}</span>
                  </div>
                )}

                {/* Totals summary */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Gross', value: gross, color: 'text-slate-800' },
                    { label: 'Discount', value: discount, color: 'text-emerald-700' },
                    { label: 'Fee Paid', value: paid, color: 'text-blue-700' },
                    { label: 'Balance', value: balance, color: balance > 0 ? 'text-red-600' : 'text-emerald-700' }
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-slate-50 rounded-lg p-2.5 text-center">
                      <p className="text-xs text-slate-500">{label}</p>
                      <p className={`text-sm font-bold ${color}`}>₹{value.toLocaleString()}</p>
                    </div>
                  ))}
                </div>

                {/* Total Collected (All receipts) */}
                <div className="bg-indigo-50 rounded-lg p-3 border border-indigo-100">
                  <p className="text-xs text-slate-500 mb-1">Total Collected (All Receipts)</p>
                  <p className="text-lg font-bold text-indigo-700">₹{(paid + adhocPaid).toLocaleString()}</p>
                  <p className="text-xs text-slate-400 mt-1">Annual: ₹{paid.toLocaleString()} + ADHOC: ₹{adhocPaid.toLocaleString()}</p>
                </div>

                {/* Helper text */}
                <div className="bg-amber-50 rounded-lg p-2.5 border border-amber-100">
                  <p className="text-xs text-amber-700">
                    💡 <span className="font-medium">ADHOC payments do not reduce Annual Fee balance.</span> They are collected separately.
                  </p>
                </div>

                {/* Payments list with filter tabs */}
                {annualPayments.length > 0 && (
                  <div className="border-t pt-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Annual Fee Payments</p>
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">({annualPayments.length})</span>
                    </div>
                    <div className="space-y-1.5">
                      {annualPayments.map(p => {
                       const isVoid = p.status === 'VOID' || p.status === 'CANCELLED';
                       return (
                         <div key={p.id} className={`rounded-lg px-2 py-1.5 ${isVoid ? 'bg-red-50 border border-red-100' : ''}`}>
                           <div className="flex items-center justify-between text-sm">
                             <span className={`flex items-center gap-1.5 ${isVoid ? 'text-slate-400 line-through' : 'text-slate-600'}`}>
                               {p.payment_date} · {p.payment_mode}
                               {isVoid && (
                                 <Badge variant="destructive" className="text-[10px] py-0 px-1.5 no-underline" style={{ textDecoration: 'none' }}>VOID</Badge>
                               )}
                             </span>
                             <span className={`font-medium ${isVoid ? 'text-slate-400 line-through' : 'text-emerald-700'}`}>
                               ₹{(p.amount_paid || 0).toLocaleString()}{' '}
                               <span className={`text-xs ${isVoid ? 'text-slate-300' : 'text-slate-400'}`}>#{p.receipt_no}</span>
                             </span>
                           </div>
                           {isVoid && (
                             <div className="text-xs text-red-500 mt-0.5 space-y-0.5">
                               {p.void_reason && <p>↩ {p.void_reason}</p>}
                               {p.voided_by && <p className="text-slate-400">By: {p.voided_by}{p.voided_at ? ` · ${new Date(p.voided_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}` : ''}</p>}
                             </div>
                           )}
                         </div>
                       );
                      })}
                    </div>
                  </div>
                )}

                {!isArchivedYear && balance > 0 && invoice.status !== 'Waived' && (
                   <Button size="sm" className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={() => setPayingInvoice({ ...invoice, total_amount: net, balance })}>
                     Record Payment
                   </Button>
                 )}
                </CardContent>
              </Card>
            )}
        </div>
      )}

      {/* Additional Fees Section */}
      {selectedStudent && adhocInvoices.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Additional Fees</p>
          {adhocInvoices.map(adhoc => {
            const adhocPaid = adhoc.paid_amount ?? 0;
            const adhocBalance = Math.max((adhoc.total_amount ?? 0) - adhocPaid, 0);
            const invPayments = paymentsByInvoice[adhoc.id] || [];
            return (
              <Card key={adhoc.id} className="border-0 shadow-sm overflow-hidden">
                <div className="px-4 py-3 bg-amber-50 flex items-center justify-between">
                  <span className="font-medium text-slate-800 text-sm">{adhoc.title || adhoc.installment_name}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[adhoc.status] || 'bg-slate-100'}`}>{adhoc.status}</span>
                </div>
                <CardContent className="p-4 space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Amount', value: adhoc.total_amount ?? 0, color: 'text-slate-800' },
                      { label: 'Paid', value: adhocPaid, color: 'text-blue-700' },
                      { label: 'Balance', value: adhocBalance, color: adhocBalance > 0 ? 'text-red-600' : 'text-emerald-700' }
                    ].map(({ label, value, color }) => (
                      <div key={label} className="bg-slate-50 rounded-lg p-2.5 text-center">
                        <p className="text-xs text-slate-500">{label}</p>
                        <p className={`text-sm font-bold ${color}`}>₹{value.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                  {invPayments.length > 0 && (
                    <div className="border-t pt-2 space-y-1.5">
                      {invPayments.map(p => {
                        const isVoid = p.status === 'VOID' || p.status === 'CANCELLED';
                        return (
                          <div key={p.id} className={`rounded-lg px-2 py-1 ${isVoid ? 'bg-red-50 border border-red-100' : ''}`}>
                            <div className="flex items-center justify-between text-xs">
                              <span className={`flex items-center gap-1 ${isVoid ? 'text-slate-400 line-through' : 'text-slate-500'}`}>
                                {p.payment_date} · {p.payment_mode}
                                {isVoid && (
                                  <Badge variant="destructive" className="text-[9px] py-0 px-1" style={{ textDecoration: 'none' }}>VOID</Badge>
                                )}
                              </span>
                              <span className={`font-medium ${isVoid ? 'text-slate-400 line-through' : 'text-emerald-700'}`}>
                                ₹{(p.amount_paid || 0).toLocaleString()} <span className={`${isVoid ? 'text-slate-300' : 'text-slate-400'}`}>#{p.receipt_no}</span>
                              </span>
                            </div>
                            {isVoid && (
                              <div className="text-[10px] text-red-500 mt-0.5 space-y-0.5">
                                {p.void_reason && <p>↩ {p.void_reason}</p>}
                                {p.voided_by && <p className="text-slate-400">By: {p.voided_by}{p.voided_at ? ` · ${new Date(p.voided_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}` : ''}</p>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {!isArchivedYear && adhocBalance > 0 && adhoc.status !== 'Waived' && (
                    <Button size="sm" className="w-full bg-amber-600 hover:bg-amber-700"
                      onClick={() => setPayingInvoice({ ...adhoc, balance: adhocBalance })}>
                      Record Payment
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {payingInvoice && (
        <PaymentModal
          invoice={payingInvoice}
          onClose={() => setPayingInvoice(null)}
          onSuccess={() => {
            setPayingInvoice(null);
            refetchInvoice();
            refetchPayments();
          }}
        />
      )}
    </div>
  );
}