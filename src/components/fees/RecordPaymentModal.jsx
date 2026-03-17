import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Printer } from 'lucide-react';
import { toast } from 'sonner';
import moment from 'moment';

export default function RecordPaymentModal({ onClose, selectedStudent, selectedInvoice }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    amount: '',
    paymentMode: 'Cash',
    paymentDate: moment().format('YYYY-MM-DD'),
    referenceNo: '',
  });
  const [error, setError] = useState('');

  // Calculate outstanding balance
  const outstanding = selectedInvoice
    ? (selectedInvoice.total_amount || 0) - (selectedInvoice.paid_amount || 0)
    : 0;

  // Autofill amount on invoice change
  useEffect(() => {
    if (selectedInvoice) {
      setFormData(prev => ({
        ...prev,
        amount: String(outstanding),
        paymentDate: moment().format('YYYY-MM-DD')
      }));
      setError('');
    }
  }, [selectedInvoice, outstanding]);

  const recordPaymentMutation = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(formData.amount);
      if (!amount || amount <= 0) throw new Error('Amount must be greater than 0');
      if (amount > outstanding) throw new Error(`Amount exceeds outstanding balance (₹${Math.floor(outstanding)})`);

      const staffInfo = (() => {
        try {
          const raw = localStorage.getItem('staff_session');
          return raw ? JSON.parse(raw) : null;
        } catch {
          return null;
        }
      })();

      const res = await base44.functions.invoke('recordFeePayment', {
        invoiceId: selectedInvoice.id,
        amountPaid: amount,
        paymentDate: formData.paymentDate,
        paymentMode: formData.paymentMode,
        referenceNo: formData.referenceNo || '',
        staffInfo
      });

      return res.data;
    },
    onSuccess: (data) => {
      // Show success toast with Print and Done actions
      const { receipt_no, payment_id } = data;

      toast.success('Receipt Saved Successfully', {
        duration: 5000,
        action: {
          label: 'Print',
          onClick: () => {
            window.open(`/PrintReceiptA5?paymentId=${payment_id}`, '_blank');
          }
        },
        close: {
          label: 'Done',
          onClick: () => {
            // Close modal and refresh ledger
            handleDone();
          }
        },
        onDismiss: () => {
          // Also refresh ledger when toast dismisses
          queryClient.invalidateQueries({ queryKey: ['student-ledger', selectedStudent?.student_id, selectedStudent?.academic_year] });
        }
      });

      // Close modal
      onClose();

      // Refresh ledger
      queryClient.invalidateQueries({ queryKey: ['student-ledger', selectedStudent?.student_id] });
    },
    onError: (err) => {
      const errorMsg = err?.response?.data?.error || err?.message || 'Failed to record payment';
      setError(errorMsg);
    }
  });

  const handleDone = () => {
    onClose();
    queryClient.invalidateQueries({ queryKey: ['student-ledger', selectedStudent?.student_id] });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    recordPaymentMutation.mutate();
  };

  if (!selectedStudent || !selectedInvoice) return null;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>

        {/* Student Info Display */}
        <div className="bg-indigo-50 rounded-lg p-3 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-600">Student:</span>
            <span className="font-semibold text-slate-900">{selectedStudent.name}</span>
          </div>
          {selectedStudent.parent_name && (
            <div className="flex justify-between">
              <span className="text-slate-600">Parent:</span>
              <span className="font-semibold text-slate-900">{selectedStudent.parent_name}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-slate-600">ID:</span>
            <span className="font-mono text-slate-700">{selectedStudent.student_id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Class:</span>
            <span className="text-slate-700">
              {selectedStudent.class_name}-{selectedStudent.section}
            </span>
          </div>
          <div className="flex justify-between pt-2 border-t border-indigo-200">
            <span className="text-slate-600 font-semibold">Outstanding:</span>
            <span className="text-red-600 font-bold">₹{Math.floor(outstanding)}</span>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <Label className="text-xs font-semibold">Amount to Pay (₹) *</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              max={outstanding}
              className="mt-1"
              value={formData.amount}
              onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
              placeholder="Enter amount"
            />
            <p className="text-xs text-slate-400 mt-1">Max: ₹{Math.floor(outstanding)}</p>
          </div>

          <div>
            <Label className="text-xs font-semibold">Payment Mode *</Label>
            <Select value={formData.paymentMode} onValueChange={(value) => setFormData(prev => ({ ...prev, paymentMode: value }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Cash">Cash</SelectItem>
                <SelectItem value="Cheque">Cheque</SelectItem>
                <SelectItem value="Online">Online Transfer</SelectItem>
                <SelectItem value="Card">Card</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs font-semibold">Payment Date *</Label>
            <Input
              type="date"
              className="mt-1"
              value={formData.paymentDate}
              onChange={(e) => setFormData(prev => ({ ...prev, paymentDate: e.target.value }))}
            />
          </div>

          <div>
            <Label className="text-xs font-semibold">Reference No. (optional)</Label>
            <Input
              type="text"
              className="mt-1"
              placeholder="Cheque # or Transaction ID"
              value={formData.referenceNo}
              onChange={(e) => setFormData(prev => ({ ...prev, referenceNo: e.target.value }))}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              disabled={recordPaymentMutation.isPending}
            >
              {recordPaymentMutation.isPending ? 'Recording…' : 'Record Payment'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}