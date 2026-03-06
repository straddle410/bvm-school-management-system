import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import FeePaymentForm from './FeePaymentForm';
import ArchivedYearPaymentWarning from './ArchivedYearPaymentWarning';

export default function StudentLedgerArchivedYear({ studentId, academicYear, isArchived }) {
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ['student-ledger', studentId, academicYear],
    queryFn: () => base44.entities.FeeInvoice.filter({
      student_id: studentId,
      academic_year: academicYear
    }),
    enabled: !!studentId && !!academicYear
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['student-payments', studentId, academicYear],
    queryFn: () => base44.entities.FeePayment.filter({
      student_id: studentId,
      academic_year: academicYear
    }),
    enabled: !!studentId && !!academicYear
  });

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

  return (
    <div className="space-y-6">
      {isArchived && (
        <ArchivedYearPaymentWarning
          academicYear={academicYear}
          studentName={invoices[0]?.student_name || 'Student'}
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
                          // Invalidate queries to refresh
                          window.location.reload();
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