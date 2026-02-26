import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function HalfDayModal({ isOpen, onClose, onConfirm, studentName }) {
  const [period, setPeriod] = useState('morning');
  const [reason, setReason] = useState('');

  const handleConfirm = () => {
    onConfirm({ period, reason });
    setPeriod('morning');
    setReason('');
  };

  const handleClose = () => {
    onClose();
    setPeriod('morning');
    setReason('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark Half Day - {studentName}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              Half Day Period *
            </label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="morning">
                  ☀️ Morning Only (Present Afternoon)
                </SelectItem>
                <SelectItem value="afternoon">
                  🌙 Afternoon Only (Present Morning)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">
              Reason (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g., Medical appointment, Family event"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} className="bg-yellow-600 hover:bg-yellow-700">
            Mark Half Day
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}