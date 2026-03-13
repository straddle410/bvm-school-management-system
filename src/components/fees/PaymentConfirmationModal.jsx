import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export default function PaymentConfirmationModal({ open, studentName, amount, onConfirm, onCancel, isLoading }) {
  return (
    <Dialog open={open} onOpenChange={onCancel}>
      <DialogContent className="max-w-sm">
        <div className="text-center space-y-6 py-4">
          <div>
            <p className="text-3xl font-bold text-slate-900">{studentName}</p>
          </div>
          
          <div className="bg-emerald-50 rounded-lg p-6">
            <p className="text-sm text-slate-500 mb-2">Amount to Collect</p>
            <p className="text-3xl font-bold text-emerald-600">₹{amount.toLocaleString()}</p>
          </div>

          <div className="flex gap-3 justify-center">
            <Button
              variant="outline"
              className="px-8 py-2 text-base font-semibold border-slate-300"
              onClick={onCancel}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 px-8 py-2 text-base font-semibold text-white"
              onClick={onConfirm}
              disabled={isLoading}
            >
              {isLoading ? 'Processing...' : 'Confirm'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}