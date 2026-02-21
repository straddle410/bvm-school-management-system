import React from 'react';
import { Palmtree, CheckCircle2, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function HolidayStatusDisplay({ isHoliday, isSunday, hasOverride, holidayReason }) {
  if (!isHoliday && !isSunday) {
    return (
      <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
        <div className="h-3 w-3 rounded-full bg-green-500" />
        <span className="text-sm font-medium text-green-900">Working Day • Attendance Enabled</span>
      </div>
    );
  }

  if (isHoliday || isSunday) {
    if (hasOverride) {
      return (
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <div className="flex-1">
            <span className="text-sm font-medium text-blue-900">Holiday Override Active</span>
            <p className="text-xs text-blue-700">Attendance is enabled for today despite holiday</p>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
        <Palmtree className="h-4 w-4 text-amber-600" />
        <div className="flex-1">
          <span className="text-sm font-medium text-amber-900">Holiday • Attendance Disabled</span>
          <p className="text-xs text-amber-700">{holidayReason || 'Holiday'}</p>
        </div>
      </div>
    );
  }
}