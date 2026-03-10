import React, { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';

export default function SuccessPopup({ open, onOpenChange, message }) {
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => onOpenChange(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [open, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-600">
            <Check className="h-5 w-5" />
            Success!
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-600">{message}</p>
        <Button onClick={() => onOpenChange(false)} className="w-full bg-green-600 hover:bg-green-700">
          OK
        </Button>
      </DialogContent>
    </Dialog>
  );
}