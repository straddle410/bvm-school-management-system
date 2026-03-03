import React from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import moment from 'moment';

function fmt(n) {
  return (n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const TYPE_COLORS = {
  INVOICE: 'bg-blue-100 text-blue-700',
  PAYMENT: 'bg-emerald-100 text-emerald-700',
  REVERSAL: 'bg-red-100 text-red-700',
  CREDIT: 'bg-purple-100 text-purple-700',
  ADJUSTMENT: 'bg-amber-100 text-amber-700',
  VOIDED: 'bg-slate-100 text-slate-500'
};

export default function LedgerRowDrawer({ row, invoices, onClose }) {
  const open = !!row;

  // Find matching invoice if this is an invoice row or payment row
  const linkedInvoice = invoices?.find(inv => inv.id === (row?.invoiceId));

  return (
    <Sheet open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        {row && (
          <>
            <SheetHeader className="mb-4">
              <SheetTitle className="text-base flex items-center gap-2">
                <Badge className={TYPE_COLORS[row.type] || 'bg-slate-100'}>{row.type}</Badge>
                {row.refNo || 'Ledger Entry'}
              </SheetTitle>
              <p className="text-xs text-slate-500">{row.date ? moment(row.date).format('DD MMM YYYY') : '—'}</p>
            </SheetHeader>

            {/* Core amounts */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="bg-red-50 rounded-lg p-3 text-center">
                <p className="text-[10px] text-red-500 mb-1">Debit</p>
                <p className="font-bold text-red-700 text-lg">₹{fmt(row.debit)}</p>
              </div>
              <div className="bg-emerald-50 rounded-lg p-3 text-center">
                <p className="text-[10px] text-emerald-600 mb-1">Credit</p>
                <p className="font-bold text-emerald-700 text-lg">₹{fmt(row.credit)}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 text-center">
                <p className="text-[10px] text-slate-500 mb-1">Balance After</p>
                <p className="font-bold text-slate-800 text-lg">₹{fmt(row.runningBalance)}</p>
              </div>
            </div>

            {/* Details */}
            <div className="space-y-2 text-sm mb-5">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Description</span>
                <span className="font-medium text-slate-800 text-right max-w-[60%]">{row.description}</span>
              </div>
              {row.mode && (
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Payment Mode</span>
                  <span className="font-medium">{row.mode}</span>
                </div>
              )}
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Status</span>
                <Badge variant="outline" className="text-xs">{row.status}</Badge>
              </div>
              {row.refNo && (
                <div className="flex justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-500">Reference</span>
                  <span className="font-mono text-xs text-slate-600">{row.refNo}</span>
                </div>
              )}
            </div>

            {/* Invoice line items (if invoice row) */}
            {row.type === 'INVOICE' && linkedInvoice && (
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Fee Line Items</h3>
                <div className="rounded-lg border border-slate-100 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="text-xs">Fee Head</TableHead>
                        <TableHead className="text-xs text-right">Gross</TableHead>
                        <TableHead className="text-xs text-right">Discount</TableHead>
                        <TableHead className="text-xs text-right">Net</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(linkedInvoice.fee_heads || []).map((fh, i) => (
                        <TableRow key={i} className="text-xs">
                          <TableCell>{fh.fee_head_name}</TableCell>
                          <TableCell className="text-right">₹{fmt(fh.gross_amount ?? fh.amount ?? 0)}</TableCell>
                          <TableCell className="text-right text-amber-600">-₹{fmt(fh.discount_amount ?? 0)}</TableCell>
                          <TableCell className="text-right font-medium">₹{fmt(fh.net_amount ?? fh.amount ?? 0)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-slate-50 font-semibold text-xs">
                        <TableCell>Total</TableCell>
                        <TableCell className="text-right">₹{fmt(linkedInvoice.gross_total ?? linkedInvoice.total_amount)}</TableCell>
                        <TableCell className="text-right text-amber-600">-₹{fmt(linkedInvoice.discount_total ?? 0)}</TableCell>
                        <TableCell className="text-right">₹{fmt(linkedInvoice.total_amount)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}