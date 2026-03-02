import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function ReversalModal({ payment, onClose, onSuccess }) {
  const [reason, setReason] = useState('');

  const reverseMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('reverseReceipt', {
        paymentId: payment.id,
        reason: reason.trim()
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success(`Receipt #${payment.receipt_no} reversed successfully`);
      onSuccess();
    },
    onError: (e) => toast.error(e.response?.data?.error || e.message)
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Reverse Receipt
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm space-y-1">
            <p><span className="text-slate-500">Receipt:</span> <span className="font-medium">#{payment.receipt_no}</span></p>
            <p><span className="text-slate-500">Student:</span> <span className="font-medium">{payment.student_name}</span></p>
            <p><span className="text-slate-500">Amount:</span> <span className="font-bold text-red-700">₹{(payment.amount_paid || 0).toLocaleString()}</span></p>
            <p><span className="text-slate-500">Date:</span> {payment.payment_date} · {payment.payment_mode}</p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
            This will <strong>reverse</strong> the receipt and reduce the invoice's paid amount accordingly.
            The original receipt will be marked as REVERSED (not deleted). You can then create a new correct receipt.
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Reason for Reversal *</label>
            <Textarea
              className="mt-1"
              placeholder="e.g. Wrong amount entered, Cheque bounced, Duplicate entry…"
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              disabled={!reason.trim() || reverseMutation.isPending}
              onClick={() => reverseMutation.mutate()}
            >
              {reverseMutation.isPending ? 'Reversing...' : 'Confirm Reversal'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}