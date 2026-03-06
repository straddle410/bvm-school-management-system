import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import ArchivedYearPaymentWarning from './ArchivedYearPaymentWarning';

export default function FeePaymentForm({ invoice, isArchivedYear, academicYear, onPaymentSuccess }) {
  const [amountPaid, setAmountPaid] = useState(invoice?.balance || 0);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [referenceNo, setReferenceNo] = useState('');
  const [remarks, setRemarks] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const outstanding = (invoice?.total_amount || 0) - (invoice?.paid_amount || 0);
  const maxAmount = outstanding;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!amountPaid || amountPaid <= 0) {
      toast.error('Payment amount must be greater than zero');
      return;
    }

    if (amountPaid > outstanding) {
      toast.error(`Payment exceeds outstanding balance of ₹${outstanding}`);
      return;
    }

    setIsLoading(true);
    try {
      const response = await base44.functions.invoke('recordFeePayment', {
        invoiceId: invoice.id,
        amountPaid: parseFloat(amountPaid),
        paymentDate,
        paymentMode,
        referenceNo: referenceNo || undefined,
        remarks: remarks || undefined,
        entryType: 'CASH_PAYMENT'
      });

      if (response.data?.success) {
        toast.success(`Payment recorded successfully. Receipt: ${response.data.receipt_no}`);
        onPaymentSuccess?.(response.data);
      } else {
        toast.error(response.data?.error || 'Failed to record payment');
      }
    } catch (error) {
      toast.error(error.message || 'Error recording payment');
      console.error('Payment error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {isArchivedYear && (
        <ArchivedYearPaymentWarning
          academicYear={academicYear}
          studentName={invoice?.student_name || 'Student'}
        />
      )}

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Record Payment</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-semibold text-gray-600">Outstanding Amount</Label>
                <p className="text-2xl font-bold text-red-600 mt-1">₹{outstanding.toFixed(2)}</p>
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-600">Invoice Status</Label>
                <p className="text-sm font-semibold text-gray-900 mt-1">{invoice?.status}</p>
              </div>
            </div>

            <div>
              <Label htmlFor="amountPaid">Amount to Pay *</Label>
              <Input
                id="amountPaid"
                type="number"
                step="0.01"
                min="0"
                max={maxAmount}
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                placeholder="0.00"
                className="mt-1"
                required
              />
              <p className="text-xs text-gray-500 mt-1">Max: ₹{maxAmount.toFixed(2)}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="paymentDate">Payment Date *</Label>
                <Input
                  id="paymentDate"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="mt-1"
                  required
                />
              </div>
              <div>
                <Label htmlFor="paymentMode">Payment Mode *</Label>
                <Select value={paymentMode} onValueChange={setPaymentMode}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Cheque">Cheque</SelectItem>
                    <SelectItem value="Online">Online</SelectItem>
                    <SelectItem value="DD">DD</SelectItem>
                    <SelectItem value="UPI">UPI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="referenceNo">Reference No. (Cheque/Transaction ID)</Label>
              <Input
                id="referenceNo"
                type="text"
                value={referenceNo}
                onChange={(e) => setReferenceNo(e.target.value)}
                placeholder="e.g., CHQ-12345 or Transaction ID"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="remarks">Remarks</Label>
              <Input
                id="remarks"
                type="text"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Optional remarks"
                className="mt-1"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                type="submit"
                disabled={isLoading}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {isLoading ? 'Processing...' : 'Record Payment'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}