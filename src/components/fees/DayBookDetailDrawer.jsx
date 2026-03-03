import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

const STATUS_COLORS = {
  POSTED: 'bg-green-100 text-green-700',
  REVERSAL: 'bg-red-100 text-red-700',
  VOID: 'bg-gray-100 text-gray-500',
};

export default function DayBookDetailDrawer({ open, onClose, date, filters }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [meta, setMeta] = useState(null);

  useEffect(() => {
    if (!open || !date) return;
    setLoading(true);
    base44.functions.invoke('getDayBookReport', {
      reportMode: 'details',
      detailDate: date,
      dateFrom: date,
      dateTo: date,
      academicYear: filters.academicYear || undefined,
      className: filters.className || undefined,
      mode: filters.mode?.length ? filters.mode : undefined,
      includeReversals: filters.includeReversals,
      includeCancelled: filters.includeCancelled,
      pageSize: 500
    }).then(res => {
      setRows(res.data.rows || []);
      setMeta(res.data.meta || null);
    }).finally(() => setLoading(false));
  }, [open, date, JSON.stringify(filters)]);

  const grossCollected = rows.filter(r => r.amount > 0).reduce((s, r) => s + r.amount, 0);
  const grossReversed  = rows.filter(r => r.amount < 0).reduce((s, r) => s + Math.abs(r.amount), 0);
  const net            = grossCollected - grossReversed;

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <SheetHeader className="px-6 py-4 border-b bg-slate-50 sticky top-0 z-10">
          <SheetTitle className="text-base font-semibold">
            Day Book — {date}
          </SheetTitle>
          {!loading && (
            <div className="flex gap-4 text-sm mt-1">
              <span className="text-green-600 font-medium">Collected: ₹{fmt(grossCollected)}</span>
              {grossReversed > 0 && <span className="text-red-500 font-medium">Reversed: ₹{fmt(grossReversed)}</span>}
              <span className="text-slate-700 font-semibold">Net: ₹{fmt(net)}</span>
            </div>
          )}
        </SheetHeader>

        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-sm">No receipts found for this date.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-500 uppercase text-[10px] tracking-wide">
                    <th className="px-3 py-2 text-left">Receipt</th>
                    <th className="px-3 py-2 text-left">Student</th>
                    <th className="px-3 py-2 text-left">Class</th>
                    <th className="px-3 py-2 text-left">Mode</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2 text-center">Status</th>
                    <th className="px-3 py-2 text-left">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((row, i) => (
                    <tr key={row.paymentId || i} className="hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-2 font-mono text-slate-700">{row.receiptNo || '—'}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-800">{row.student?.name || '—'}</div>
                        <div className="text-slate-400 text-[10px]">{row.student?.id}</div>
                      </td>
                      <td className="px-3 py-2 text-slate-600">{row.class?.name || '—'}</td>
                      <td className="px-3 py-2">
                        <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-medium">{row.mode}</span>
                      </td>
                      <td className={`px-3 py-2 text-right font-semibold tabular-nums ${row.amount < 0 ? 'text-red-500' : row.amount === 0 ? 'text-slate-400' : 'text-slate-800'}`}>
                        {row.amount < 0 ? '−' : ''}₹{fmt(Math.abs(row.amount))}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[row.status] || 'bg-slate-100 text-slate-500'}`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-slate-400 max-w-[120px] truncate">{row.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}