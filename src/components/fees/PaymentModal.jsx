import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { getStaffSession } from '@/components/useStaffSession';
import PaymentConfirmationModal from './PaymentConfirmationModal';

const PAYMENT_MODES = ['Cash', 'Cheque', 'Online', 'DD', 'UPI'];

export default function PaymentModal({ invoice, onClose, onSuccess }) {
  const staffInfo = getStaffSession();
  
  if (!staffInfo) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Error</DialogTitle>
          </DialogHeader>
          <p className="text-red-600">No staff session found. Please log in again.</p>
          <Button onClick={onClose}>Close</Button>
        </DialogContent>
      </Dialog>
    );
  }

  const outstanding = (invoice.balance != null ? invoice.balance : invoice.total_amount) || 0;

  const [form, setForm] = useState({
    amountPaid: 0,
    paymentDate: format(new Date(), 'yyyy-MM-dd'),
    paymentMode: 'Cash',
    referenceNo: '',
    remarks: ''
  });
  const [showConfirmation, setShowConfirmation] = useState(false);

  const enteredAmount = parseFloat(form?.amountPaid) || 0;
  const isOverpayment = enteredAmount > outstanding;

  const payMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        invoiceId: invoice.id,
        amountPaid: parseFloat(form.amountPaid),
        paymentDate: form.paymentDate,
        paymentMode: form.paymentMode,
        referenceNo: form.referenceNo,
        remarks: form.remarks,
        staffInfo
      };
      console.log('[PaymentModal] Sending payload:', payload);
      const res = await base44.functions.invoke('recordFeePayment', payload);
      console.log('[PaymentModal] Response:', res.data);
      return res.data;
    },
    onSuccess: async (data) => {
      console.log('[Payment] Triggering notification for:', data.payment_id);
      toast.success(`Payment recorded! Receipt: ${data.receipt_no}`);
      setShowConfirmation(false);
      
      // Trigger notification function with full payment data
      try {
        const studentId = invoice.student_id;
        console.log('[Payment] Calling FCM with:', studentId, data.payment_id);
        
        await base44.functions.invoke('sendFeePaymentNotification', {
          event: { type: 'create', entity_name: 'FeePayment', entity_id: data.payment_id },
          data: {
            id: data.payment_id,
            student_id: studentId,
            amount_paid: parseFloat(form.amountPaid),
            receipt_no: data.receipt_no,
            payment_id: data.payment_id
          }
        });
      } catch (err) {
        console.warn('[Payment] Notification call failed:', err.message);
      }
      
      onSuccess();
    },
    onError: (e) => {
      console.error('[PaymentModal] Error:', e);
      toast.error(e.response?.data?.error || e.message);
      setShowConfirmation(false);
    }
  });

  const handleRecordClick = () => {
    if (!form.amountPaid || parseFloat(form.amountPaid) <= 0) {
      toast.error('Enter a valid amount');
      return;
    }
    if (isOverpayment) {
      toast.error(`Amount exceeds outstanding balance of ₹${outstanding}`);
      return;
    }
    setShowConfirmation(true);
  };

  const handleConfirmPayment = () => {
    payMutation.mutate();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="bg-slate-50 rounded-lg p-3 text-sm space-y-1">
            <p><span className="text-slate-500">Student:</span> <span className="font-medium">{invoice.student_name}</span></p>
            <p><span className="text-slate-500">Invoice:</span> <span className="font-medium">{invoice.title || invoice.installment_name || 'Annual Fee'}</span></p>
            <p><span className="text-slate-500">Total:</span> ₹{(invoice.total_amount || 0).toLocaleString()} · <span className="text-slate-500">Balance:</span> <span className="font-semibold text-red-600">₹{(invoice.balance || 0).toLocaleString()}</span></p>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Amount to Pay (₹) *</label>
            <p className="text-xs text-slate-500 mb-1">Max payable = ₹{outstanding.toLocaleString()}</p>
            <input
              type="number" min="1" max={outstanding}
              className={`border rounded-lg px-3 py-2 text-sm w-full ${isOverpayment ? 'border-red-400 bg-red-50' : ''}`}
              value={form.amountPaid}
              onChange={e => setForm({ ...form, amountPaid: e.target.value })}
            />
            {isOverpayment && (
              <p className="text-xs text-red-600 mt-1">Amount cannot exceed outstanding balance of ₹{outstanding.toLocaleString()}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Payment Date *</label>
            <input type="date" className="border rounded-lg px-3 py-2 text-sm w-full mt-1" value={form.paymentDate} onChange={e => setForm({ ...form, paymentDate: e.target.value })} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Payment Mode *</label>
            <Select value={form.paymentMode} onValueChange={v => setForm({ ...form, paymentMode: v })}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>{PAYMENT_MODES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {['Cheque', 'Online', 'DD', 'UPI'].includes(form.paymentMode) && (
            <div>
              <label className="text-sm font-medium text-slate-700">Reference / Transaction No.</label>
              <input className="border rounded-lg px-3 py-2 text-sm w-full mt-1" placeholder="e.g. UTR, Cheque No." value={form.referenceNo} onChange={e => setForm({ ...form, referenceNo: e.target.value })} />
            </div>
          )}
          <div>
            <label className="text-sm font-medium text-slate-700">Remarks</label>
            <input className="border rounded-lg px-3 py-2 text-sm w-full mt-1" placeholder="Optional" value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={handleRecordClick}
              disabled={isOverpayment}
            >
              Record Payment
            </Button>
          </div>
        </div>
      </DialogContent>

      <PaymentConfirmationModal
        open={showConfirmation}
        studentName={invoice.student_name}
        amount={parseFloat(form.amountPaid) || 0}
        onConfirm={handleConfirmPayment}
        onCancel={() => setShowConfirmation(false)}
        isLoading={payMutation.isPending}
      />
    </Dialog>
  );
}