import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, User, AlertCircle } from 'lucide-react';
import FeePaymentForm from './FeePaymentForm';
import ArchivedYearPaymentWarning from './ArchivedYearPaymentWarning';

const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

const statusColor = {
  Pending: 'bg-yellow-100 text-yellow-800',
  Partial: 'bg-blue-100 text-blue-800',
  Paid: 'bg-green-100 text-green-800',
  Overdue: 'bg-red-100 text-red-800',
  Waived: 'bg-slate-100 text-slate-600'
};

export default function StudentLedgerArchivedYear({ academicYear, isArchived }) {
  const queryClient = useQueryClient();
  const [selectedClass, setSelectedClass] = useState('');
  const [search, setSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);

  const { data: students = [] } = useQuery({
    queryKey: ['students-published', selectedClass, academicYear],
    queryFn: async () => {
      const all = await base44.entities.Student.filter({ 
        class_name: selectedClass, 
        academic_year: academicYear, 
        status: 'Published', 
        is_deleted: false 
      });
      return all.filter(s => s.is_active !== false);
    },
    enabled: !!selectedClass && !!academicYear
  });

  const { data: invoices = [], isLoading, refetch: refetchInvoices } = useQuery({
    queryKey: ['student-ledger', selectedStudent?.student_id, academicYear],
    queryFn: () => base44.entities.FeeInvoice.filter({
      student_id: selectedStudent.student_id,
      academic_year: academicYear
    }),
    enabled: !!selectedStudent && !!academicYear
  });

  const { data: payments = [], refetch: refetchPayments } = useQuery({
    queryKey: ['student-payments', selectedStudent?.student_id, academicYear],
    queryFn: () => base44.entities.FeePayment.filter({
      student_id: selectedStudent.student_id,
      academic_year: academicYear
    }),
    enabled: !!selectedStudent && !!academicYear
  });

  if (!selectedStudent && selectedClass) {
    const filteredStudents = students.filter(s =>
      s.name?.toLowerCase().includes(search.toLowerCase()) || s.student_id?.toLowerCase().includes(search.toLowerCase())
    );

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
      </div>
    );
  }

  if (isLoading) {
    return <div className="text-center py-8">Loading ledger...</div>;
  }

  const totalAmount = invoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + (inv.paid_amount || 0), 0);
  const totalOutstanding = totalAmount - totalPaid;

  const statusColors = {
    Pending: 'bg-yellow-100 text-yellow-700',
    Partial: 'bg-blue-100 text-blue-700',
    Paid: 'bg-green-100 text-green-700',
    Overdue: 'bg-red-100 text-red-700',
    Waived: 'bg-gray-100 text-gray-700',
    Cancelled: 'bg-slate-100 text-slate-700'
  };

  const statusIcons = {
    Pending: Clock,
    Partial: AlertCircle,
    Paid: CheckCircle2,
    Overdue: AlertCircle,
    Waived: CheckCircle2,
    Cancelled: AlertCircle
  };

  if (!selectedStudent) {
    return (
      <div className="space-y-4">
        <Select value={selectedClass} onValueChange={(v) => { setSelectedClass(v); setSelectedStudent(null); setSearch(''); }}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Select Class" /></SelectTrigger>
          <SelectContent>{CLASSES.map(c => <SelectItem key={c} value={c}>Class {c}</SelectItem>)}</SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => setSelectedStudent(null)} className="text-sm text-indigo-600 hover:underline">← Back</button>
        <div className="flex items-center gap-2">
          <User className="h-5 w-5 text-slate-400" />
          <span className="font-semibold text-slate-800">{selectedStudent.name}</span>
          <span className="text-sm text-slate-500">{selectedStudent.student_id}</span>
        </div>
      </div>

      {isArchived && (
        <ArchivedYearPaymentWarning
          academicYear={academicYear}
          studentName={selectedStudent.name}
        />
      )}

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500 font-medium">Total Invoices</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">₹{totalAmount.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500 font-medium">Total Paid</p>
            <p className="text-2xl font-bold text-green-600 mt-1">₹{totalPaid.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500 font-medium">Outstanding</p>
            <p className={`text-2xl font-bold mt-1 ${totalOutstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>
              ₹{totalOutstanding.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Invoices */}
      <div className="space-y-3">
        <h3 className="font-semibold text-gray-900">Invoices</h3>
        {invoices.length > 0 ? (
          invoices.map((invoice) => {
            const StatusIcon = statusIcons[invoice.status] || Clock;
            const outstanding = (invoice.total_amount || 0) - (invoice.paid_amount || 0);
            return (
              <Card key={invoice.id} className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="font-semibold text-sm text-gray-900">{invoice.installment_name}</p>
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${statusColors[invoice.status]}`}>
                          {invoice.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">Due: {invoice.due_date}</p>
                    </div>
                    <StatusIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-gray-500">Amount</p>
                      <p className="font-semibold text-gray-900">₹{invoice.total_amount?.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Paid</p>
                      <p className="font-semibold text-green-600">₹{(invoice.paid_amount || 0).toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Outstanding</p>
                      <p className={`font-semibold ${outstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        ₹{outstanding.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* Payment form for invoices with outstanding balance */}
                  {outstanding > 0 && isArchived && (
                    <div className="mt-4 pt-4 border-t">
                      <FeePaymentForm
                        invoice={invoice}
                        isArchivedYear={true}
                        academicYear={academicYear}
                        onPaymentSuccess={() => {
                          refetchInvoices();
                          refetchPayments();
                        }}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card className="border-0 shadow-sm">
            <CardContent className="py-8 text-center text-gray-500">
              No invoices found for this academic year
            </CardContent>
          </Card>
        )}
      </div>

      {/* Payment history */}
      {payments.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900">Payment History</h3>
          {payments.map((payment) => (
            <Card key={payment.id} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-gray-900">Receipt {payment.receipt_no}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {payment.payment_date} • {payment.payment_mode}
                    </p>
                    {payment.reference_no && (
                      <p className="text-xs text-gray-500">Ref: {payment.reference_no}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">₹{payment.amount_paid?.toFixed(2)}</p>
                    {payment.entry_type && (
                      <p className="text-xs text-gray-500 mt-1">{payment.entry_type}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}