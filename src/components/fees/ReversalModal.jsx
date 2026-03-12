import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getStaffSession } from '@/components/useStaffSession';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export default function VoidModal({ payment, onClose, onSuccess, onVoidingStart }) {
  const [reason, setReason] = useState('');
  const queryClient = useQueryClient();
  const staffInfo = getStaffSession();

  const voidMutation = useMutation({
    mutationFn: async () => {
      onVoidingStart?.();
      try {
        const res = await base44.functions.invoke('voidReceipt', {
          paymentId: payment.id,
          reason: reason.trim(),
          staffInfo
        });
        
        // Check for error in response data
        if (res.data?.error) {
          throw new Error(res.data.error);
        }
        
        return res.data;
      } catch (err) {
        // Re-throw to be handled by onError
        throw err;
      }
    },
    onSuccess: (data) => {
      // Handle idempotent case: already voided
      if (data.already_voided) {
        toast.info(data.message || 'Receipt was already voided');
      } else {
        queryClient.invalidateQueries({ queryKey: ['fee-payments-all'] });
        queryClient.invalidateQueries({ queryKey: ['fee-outstanding'] });
        queryClient.invalidateQueries({ queryKey: ['student-ledger'] });
        queryClient.invalidateQueries({ queryKey: ['fee-invoice'] });
        
        toast.success(`Receipt #${payment.receipt_no} voided successfully`);
      }
      onSuccess();
    },
    onError: (error) => {
      // Extract error message from various formats
      let errorMsg = 'Failed to void receipt';
      if (error?.response?.data?.error) {
        errorMsg = error.response.data.error;
      } else if (error?.data?.error) {
        errorMsg = error.data.error;
      } else if (error?.message) {
        errorMsg = error.message;
      }
      toast.error(errorMsg);
      console.error('Void receipt error:', errorMsg);
    }
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Void Receipt
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
            This will <strong>void</strong> the receipt and reduce the invoice's paid amount accordingly.
            The original receipt will be marked as VOID (not deleted). You can then create a new correct receipt.
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700">Reason for Voiding *</label>
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
              disabled={!reason.trim() || voidMutation.isPending}
              onClick={() => voidMutation.mutate()}
            >
              {voidMutation.isPending ? 'Voiding...' : 'Confirm Void'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}