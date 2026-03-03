import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import moment from 'moment';

function fmt(n) {
  return (n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default function OutstandingDetailDrawer({ row, academicYear, asOfDate, onClose }) {
  const open = !!row;

  const { data, isLoading } = useQuery({
    queryKey: ['outstanding-detail', row?.student?.id, academicYear, asOfDate],
    queryFn: async () => {
      const res = await base44.functions.invoke('getStudentOutstandingDetail', {
        studentId: row.student.id,
        academicYear,
        asOfDate: asOfDate || undefined
      });
      return res.data;
    },
    enabled: open
  });

  const entryBadge = (type) => {
    if (type === 'REVERSAL') return <Badge className="bg-red-100 text-red-700 text-[10px]">Reversal</Badge>;
    if (type === 'CREDIT_ADJUSTMENT') return <Badge className="bg-blue-100 text-blue-700 text-[10px]">Credit</Badge>;
    return <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Payment</Badge>;
  };

  return (
    <Sheet open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-base">
            {row?.student?.name}
            <span className="ml-2 text-sm font-normal text-slate-500">Class {row?.class?.name}</span>
          </SheetTitle>
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="text-slate-500">Net Invoiced: <strong>₹{fmt(row?.netInvoiced)}</strong></span>
            <span className="text-slate-500">Paid: <strong className="text-emerald-600">₹{fmt(row?.paidAmount)}</strong></span>
            {(row?.creditBalance ?? 0) > 0 ? (
              <span className="text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full text-xs">
                ✓ Credit Balance: ₹{fmt(row?.creditBalance)}
              </span>
            ) : (
              <span className="text-slate-500">Due: <strong className="text-red-600">₹{fmt(row?.dueAmount ?? row?.outstanding)}</strong></span>
            )}
          </div>
        </SheetHeader>

        {isLoading ? (
          <div className="text-center py-12 text-slate-400">Loading details…</div>
        ) : (
          <div className="space-y-6">
            {/* Invoices */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Invoices</h3>
              <div className="overflow-x-auto rounded-lg border border-slate-100">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="text-xs">Installment</TableHead>
                      <TableHead className="text-xs">Due Date</TableHead>
                      <TableHead className="text-xs text-right">Gross</TableHead>
                      <TableHead className="text-xs text-right">Discount</TableHead>
                      <TableHead className="text-xs text-right">Net</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.invoices || []).map(inv => (
                      <TableRow key={inv.id} className="text-xs">
                        <TableCell>{inv.installment}</TableCell>
                        <TableCell>{inv.dueDate ? moment(inv.dueDate).format('DD MMM YY') : '—'}</TableCell>
                        <TableCell className="text-right">₹{fmt(inv.gross)}</TableCell>
                        <TableCell className="text-right text-amber-600">-₹{fmt(inv.discount)}</TableCell>
                        <TableCell className="text-right font-medium">₹{fmt(inv.net)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">{inv.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(data?.invoices || []).length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center text-slate-400 text-xs py-4">No invoices</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Payments */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Payments & Adjustments</h3>
              <div className="overflow-x-auto rounded-lg border border-slate-100">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead className="text-xs">Date</TableHead>
                      <TableHead className="text-xs">Receipt</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs">Mode</TableHead>
                      <TableHead className="text-xs text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(data?.payments || []).map(p => (
                      <TableRow key={p.id} className="text-xs">
                        <TableCell>{p.date ? moment(p.date).format('DD MMM YY') : '—'}</TableCell>
                        <TableCell className="font-mono text-[10px] text-slate-500">{p.receiptNo || '—'}</TableCell>
                        <TableCell>{entryBadge(p.entryType)}</TableCell>
                        <TableCell>{p.mode || '—'}</TableCell>
                        <TableCell className={`text-right font-medium ${p.amount < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {p.amount < 0 ? '-' : '+'}₹{fmt(Math.abs(p.amount))}
                        </TableCell>
                      </TableRow>
                    ))}
                    {(data?.payments || []).length === 0 && (
                      <TableRow><TableCell colSpan={5} className="text-center text-slate-400 text-xs py-4">No payments</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Totals */}
            <div className="bg-slate-50 rounded-lg p-3 grid grid-cols-3 gap-3 text-xs">
              <div>
                <p className="text-slate-500">Net Invoiced</p>
                <p className="font-bold text-slate-800">₹{fmt(data?.netInvoiced)}</p>
              </div>
              <div>
                <p className="text-slate-500">Total Paid</p>
                <p className="font-bold text-emerald-600">₹{fmt(data?.totalPaid)}</p>
              </div>
              <div>
                <p className="text-slate-500">Outstanding</p>
                <p className="font-bold text-red-600">₹{fmt(data?.outstanding)}</p>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}