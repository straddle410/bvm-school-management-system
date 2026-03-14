import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, User, Receipt } from 'lucide-react';
import PaymentModal from './PaymentModal';
import StudentListVirtual from './StudentListVirtual';
import PullToRefresh from '@/components/PullToRefresh';

const LoadingSpinner = () => (
  <div className="flex justify-center py-12">
    <div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
  </div>
);

const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

const statusColor = {
  Pending: 'bg-yellow-100 text-yellow-800',
  Partial: 'bg-blue-100 text-blue-800',
  Paid: 'bg-green-100 text-green-800',
  Overdue: 'bg-red-100 text-red-800',
  Waived: 'bg-slate-100 text-slate-600'
};

export default function StudentLedger({ academicYear, isArchivedYear, feeHeads = [] }) {
  const queryClient = useQueryClient();
  const [selectedClass, setSelectedClass] = useState('');
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [payingInvoice, setPayingInvoice] = useState(null);
  const [studentPage, setStudentPage] = useState(0);
  const STUDENTS_LIMIT = 50;

  const { data: students = [], isLoading: isLoadingStudents } = useQuery({
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

  // ✅ OPTIMIZATION: Load all fee data in parallel with ONE query per entity type
  const { data: allData = { invoices: [], payments: [], discounts: [] }, refetch: refetchFeeData } = useQuery({
    queryKey: ['student-fee-data', selectedStudent?.student_id, academicYear],
    queryFn: async () => {
      const [invoices, payments, discounts] = await Promise.all([
        base44.entities.FeeInvoice.filter({ student_id: selectedStudent.student_id, academic_year: academicYear }),
        base44.entities.FeePayment.filter({ student_id: selectedStudent.student_id, academic_year: academicYear }),
        base44.entities.StudentFeeDiscount.filter({ student_id: selectedStudent.student_id, academic_year: academicYear, status: 'Active' })
      ]);
      return { invoices, payments, discounts };
    },
    enabled: !!selectedStudent && !!academicYear,
    staleTime: 5 * 60 * 1000
  });

  const allInvoices = allData.invoices;
  const payments = allData.payments;
  const discounts = allData.discounts;

  const invoice = allInvoices.find(i => (i.invoice_type || 'ANNUAL') === 'ANNUAL') || null;
  const adhocInvoices = allInvoices.filter(i => i.invoice_type === 'ADHOC' && i.status !== 'Cancelled');

  // Payments keyed by invoice_id for adhoc
  const paymentsByInvoice = payments.reduce((acc, p) => {
    if (!acc[p.invoice_id]) acc[p.invoice_id] = [];
    acc[p.invoice_id].push(p);
    return acc;
  }, {});

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

  const handleRefresh = async () => {
    await refetchFeeData();
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        <Select value={selectedClass} onValueChange={(v) => { setSelectedClass(v); setSelectedStudent(null); setSearch(''); setStudentPage(0); }}>
          <SelectTrigger className="w-56 text-base min-h-[48px]"><SelectValue placeholder="Select Class" /></SelectTrigger>
          <SelectContent>
            {CLASSES.map(c => (
              <SelectItem key={c} value={c} className="text-base py-3">Class {c}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selectedClass && (
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
            <Input 
              placeholder="Search student…" 
              className="pl-12 pr-12 text-base min-h-[48px]" 
              value={search} 
              onChange={e => setSearch(e.target.value)} 
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center text-slate-600 font-bold text-lg"
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>

      {selectedClass && !selectedStudent && (
        <>
          {isLoadingStudents ? (
            <Card><CardContent className="py-12"><LoadingSpinner /></CardContent></Card>
          ) : (
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
        </>
      )}

      {selectedStudent && (
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <button onClick={() => setSelectedStudent(null)} className="text-base font-bold text-indigo-600 hover:underline min-h-[44px] px-3">← Back</button>
            <div className="flex items-center gap-3">
              <User className="h-6 w-6 text-slate-500" />
              <span className="font-semibold text-xl text-slate-900">{selectedStudent.name}</span>
              <span className="text-base text-slate-600 font-medium">{selectedStudent.student_id}</span>
            </div>
          </div>

          {!invoice ? (
            <Card><CardContent className="py-8 text-center text-slate-400">No annual invoice generated for this student yet.</CardContent></Card>
          ) : (
            <Card className="border-0 shadow-sm overflow-hidden">
              <div className="px-5 py-4 bg-slate-50 dark:bg-gray-700 flex items-center justify-between">
                <div>
                  <span className="font-bold text-lg text-slate-900">Annual Fee</span>
                  {invoice.due_date && <span className="ml-3 text-base text-slate-600 font-medium">Due: {invoice.due_date}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm px-3 py-1 rounded-full font-bold ${statusColor[invoice.status] || 'bg-slate-100'}`}>{invoice.status}</span>
                </div>
              </div>

              <CardContent className="p-5 space-y-4">
                {/* Fee breakdown */}
                {(invoice.fee_heads || []).filter(fh => fh.gross_amount > 0).length > 0 && (
                  <table className="w-full text-base">
                    <thead>
                      <tr className="border-b-2 border-slate-300">
                        <th className="text-left pb-3 text-slate-700 dark:text-gray-300 font-bold text-base">Fee Head</th>
                        <th className="text-right pb-3 text-slate-700 dark:text-gray-300 font-bold text-base">Gross</th>
                        {invoice.discount_total > 0 && <th className="text-right pb-3 text-slate-700 dark:text-gray-300 font-bold text-base">Discount</th>}
                        <th className="text-right pb-3 text-slate-700 dark:text-gray-300 font-bold text-base">Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(invoice.fee_heads || []).filter(fh => fh.gross_amount > 0).map((fh, i) => (
                        <tr key={i} className="border-b border-slate-200">
                          <td className="py-3 text-slate-800 text-base">{fh.fee_head_name}</td>
                          <td className="py-3 text-right text-slate-700 text-base">₹{(fh.gross_amount || 0).toLocaleString()}</td>
                          {invoice.discount_total > 0 && (
                            <td className="py-3 text-right text-emerald-600 font-semibold text-base">
                              {fh.discount_amount > 0 ? `−₹${fh.discount_amount.toLocaleString()}` : '—'}
                            </td>
                          )}
                          <td className="py-3 text-right font-bold text-base">₹{(fh.net_amount || fh.amount || 0).toLocaleString()}</td>
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
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'Gross', value: gross, color: 'text-slate-900' },
                    { label: 'Discount', value: discount, color: 'text-emerald-700' },
                    { label: 'Fee Paid', value: paid, color: 'text-green-700' },
                    { label: 'Balance', value: balance, color: balance > 0 ? 'text-red-600' : 'text-green-700' }
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-slate-100 rounded-lg p-4 text-center border-2 border-slate-200">
                      <p className="text-base text-slate-700 font-semibold">{label}</p>
                      <p className={`text-2xl font-bold mt-1 ${color}`}>₹{value.toLocaleString()}</p>
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
                   <Button size="lg" className="w-full bg-emerald-600 hover:bg-emerald-700 text-lg font-bold py-4 min-h-[60px] shadow-lg" onClick={() => setPayingInvoice({ ...invoice, total_amount: net, balance })}>
                     <Receipt className="h-6 w-6 mr-2" />
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
            refetchFeeData();
          }}
        />
      )}
      </div>
      </PullToRefresh>
      );
      }