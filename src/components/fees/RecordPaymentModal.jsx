import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Search, AlertCircle, Printer } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function RecordPaymentModal({ isOpen, onClose, academicYear }) {
  const [step, setStep] = useState(1); // 1: Student, 2: Invoice, 3: Payment details
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [referenceNo, setReferenceNo] = useState('');
  const [recordedPaymentId, setRecordedPaymentId] = useState(null);
  const queryClient = useQueryClient();

  // Step 1: Search students
  const { data: studentSuggestions = [] } = useQuery({
    queryKey: ['student-search-payment', studentSearch, academicYear],
    queryFn: async () => {
      if (!studentSearch || studentSearch.length < 2) return [];
      const students = await base44.entities.Student.filter({
        academic_year: academicYear,
        is_deleted: false,
        is_active: true,
        status: 'Published'
      });
      const q = studentSearch.toLowerCase();
      return students.filter(s =>
        s.name?.toLowerCase().includes(q) || s.student_id?.toLowerCase().includes(q)
      ).slice(0, 10);
    },
    enabled: studentSearch.length >= 2
  });

  // Step 2: Load student invoices
  const { data: invoices = [] } = useQuery({
    queryKey: ['student-invoices-for-payment', selectedStudent?.student_id, academicYear],
    queryFn: async () => {
      const allInvoices = await base44.entities.FeeInvoice.filter({
        student_id: selectedStudent.student_id,
        academic_year: academicYear
      });
      // Show invoices with balance (not fully paid)
      return allInvoices.filter(inv => (inv.balance ?? 0) > 0).sort((a, b) => 
        new Date(b.due_date) - new Date(a.due_date)
      );
    },
    enabled: !!selectedStudent?.student_id && step >= 2
  });

  // Step 3: Record payment
  const recordPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedInvoice) throw new Error('Invoice is required');
      if (!paymentAmount || parseFloat(paymentAmount) <= 0) throw new Error('Amount must be > 0');
      
      const outstanding = (selectedInvoice.total_amount || 0) - (selectedInvoice.paid_amount || 0);
      const amount = parseFloat(paymentAmount);
      if (amount > outstanding) {
        throw new Error(`Amount (₹${amount}) exceeds balance (₹${outstanding})`);
      }

      const res = await base44.functions.invoke('recordFeePayment', {
        invoiceId: selectedInvoice.id,
        amountPaid: amount,
        paymentDate,
        paymentMode,
        referenceNo: referenceNo || undefined,
        staffInfo: (() => {
          try {
            const raw = localStorage.getItem('staff_session');
            return raw ? JSON.parse(raw) : null;
          } catch { return null; }
        })()
      });
      return res.data;
    },
    onSuccess: (data) => {
      setRecordedPaymentId(data.payment_id);
      queryClient.invalidateQueries({ queryKey: ['fee-payments-all'] });
      toast.success('Receipt Saved Successfully');
    },
    onError: (e) => {
      const msg = e?.message || e?.data?.error || 'Failed to record payment';
      toast.error(msg);
    }
  });

  const handleReset = () => {
    setStep(1);
    setStudentSearch('');
    setSelectedStudent(null);
    setSelectedInvoice(null);
    setPaymentAmount('');
    setPaymentMode('Cash');
    setPaymentDate(format(new Date(), 'yyyy-MM-dd'));
    setReferenceNo('');
    setRecordedPaymentId(null);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handlePrint = () => {
    if (recordedPaymentId) {
      window.open(`/PrintReceiptA5?paymentId=${recordedPaymentId}`, '_blank');
    }
  };

  const successScreen = recordedPaymentId ? (
    <div className="space-y-4 text-center py-6">
      <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
        <span className="text-2xl">✓</span>
      </div>
      <div>
        <p className="text-sm text-slate-600 mb-2">Receipt saved for</p>
        <p className="text-lg font-semibold text-slate-900">{selectedStudent?.name}</p>
        <p className="text-sm text-slate-500 mt-1">₹{paymentAmount}</p>
      </div>
      <div className="flex gap-2 justify-center">
        <Button variant="outline" onClick={handleClose}>Close</Button>
        <Button onClick={handlePrint} className="gap-2 bg-blue-600 hover:bg-blue-700">
          <Printer className="h-4 w-4" />
          Print Receipt
        </Button>
      </div>
    </div>
  ) : null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className={recordedPaymentId ? 'max-w-sm' : 'max-w-2xl max-h-[90vh] overflow-y-auto'}>
        <DialogHeader>
          <DialogTitle>
            {recordedPaymentId ? 'Payment Recorded Successfully' : (
              <>
                {step === 1 && 'Select Student'}
                {step === 2 && 'Select Invoice'}
                {step === 3 && 'Payment Details'}
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        {successScreen || (
        <div className="space-y-4">
          {/* STEP 1: Student Selection */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm">Search Student (Name / ID)</Label>
                <div className="relative mt-2">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="e.g. Amit or S0001"
                    className="pl-10"
                    value={studentSearch}
                    onChange={e => setStudentSearch(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>

              {studentSuggestions.length > 0 ? (
                <div className="border rounded-lg max-h-64 overflow-y-auto space-y-1 p-2">
                  {studentSuggestions.map(s => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSelectedStudent(s);
                        setStep(2);
                      }}
                      className="w-full text-left p-3 rounded-lg hover:bg-slate-100 transition border border-transparent hover:border-slate-200"
                    >
                      <div className="font-medium text-slate-900">{s.name}</div>
                      <div className="text-xs text-slate-500">ID: {s.student_id} · Class {s.class_name}-{s.section}</div>
                    </button>
                  ))}
                </div>
              ) : studentSearch.length >= 2 ? (
                <div className="text-center py-8 text-slate-400 text-sm">No students found</div>
              ) : (
                <div className="text-center py-8 text-slate-400 text-sm">Type at least 2 characters to search</div>
              )}
            </div>
          )}

          {/* STEP 2: Invoice Selection */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                <p className="text-sm text-indigo-700">
                  <span className="font-semibold">{selectedStudent.name}</span> ({selectedStudent.student_id})
                </p>
              </div>

              {invoices.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-slate-400">
                    <p className="text-sm">No pending invoices found</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {invoices.map(inv => {
                    const balance = (inv.total_amount || 0) - (inv.paid_amount || 0);
                    return (
                      <button
                        key={inv.id}
                        onClick={() => {
                          setSelectedInvoice(inv);
                          setPaymentAmount(balance.toString());
                          setStep(3);
                        }}
                        className="w-full text-left p-3 rounded-lg border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50 transition"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-slate-900">{inv.installment_name}</p>
                            <p className="text-xs text-slate-500">Due: {inv.due_date}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-slate-700">₹{balance.toLocaleString()}</p>
                            <p className="text-xs text-slate-500">outstanding</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              <Button variant="outline" onClick={() => setStep(1)} className="w-full">
                ← Back
              </Button>
            </div>
          )}

          {/* STEP 3: Payment Details */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-1">
                <p className="text-sm text-emerald-700">
                  <span className="font-semibold">{selectedStudent.name}</span> ({selectedStudent.student_id})
                </p>
                <p className="text-sm text-emerald-700">
                  Invoice: <span className="font-semibold">{selectedInvoice.installment_name}</span>
                </p>
                <p className="text-sm text-emerald-700">
                  Balance: <span className="font-semibold">₹{((selectedInvoice.total_amount || 0) - (selectedInvoice.paid_amount || 0)).toLocaleString()}</span>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Amount (₹)</Label>
                  <Input
                    type="number"
                    className="mt-1"
                    value={paymentAmount}
                    onChange={e => setPaymentAmount(e.target.value)}
                    step="0.01"
                  />
                </div>
                <div>
                  <Label className="text-xs">Payment Mode</Label>
                  <Select value={paymentMode} onValueChange={setPaymentMode}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="Cheque">Cheque</SelectItem>
                      <SelectItem value="Online">Online</SelectItem>
                      <SelectItem value="UPI">UPI</SelectItem>
                      <SelectItem value="DD">DD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Payment Date</Label>
                  <Input
                    type="date"
                    className="mt-1"
                    value={paymentDate}
                    onChange={e => setPaymentDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Reference No (optional)</Label>
                  <Input
                    className="mt-1"
                    placeholder="e.g. Cheque #123"
                    value={referenceNo}
                    onChange={e => setReferenceNo(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                  ← Back
                </Button>
                <Button
                  onClick={() => recordPaymentMutation.mutate()}
                  disabled={recordPaymentMutation.isPending || !paymentAmount}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                >
                  {recordPaymentMutation.isPending ? 'Recording…' : 'Record Payment'}
                </Button>
              </div>
            </div>
          )}
          </div>
          )}
          </DialogContent>
          </Dialog>
          );
          }