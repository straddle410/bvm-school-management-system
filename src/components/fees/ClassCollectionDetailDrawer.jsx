import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const fmt = n => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function ClassCollectionDetailDrawer({ className, dateFrom, dateTo, academicYear, includeVoided, onClose }) {
  const open = !!className;

  const { data, isLoading } = useQuery({
    queryKey: ['class-collection-detail', className, dateFrom, dateTo, academicYear, includeVoided],
    queryFn: async () => {
      const res = await base44.functions.invoke('getCollectionByClass', {
        reportMode: 'details',
        classId: className,
        dateFrom,
        dateTo,
        academicYear,
        includeVoided,
        pageSize: 500,
      });
      return res.data;
    },
    enabled: !!className && !!dateFrom && !!dateTo,
  });

  const rows = data?.rows || [];
  const validRows = rows.filter(r => !r.isVoided);
  const totalCollected = validRows.reduce((s, r) => s + (r.amount || 0), 0);

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle>
            Class {className} — Receipts
          </SheetTitle>
          <p className="text-xs text-slate-500">{dateFrom} to {dateTo}</p>
          {!isLoading && (
            <div className="flex gap-4 mt-2 text-sm">
              <span className="text-slate-600">Receipts: <strong>{validRows.length}</strong></span>
              <span className="text-emerald-700">Collected: <strong>₹{fmt(totalCollected)}</strong></span>
            </div>
          )}
        </SheetHeader>

        <div className="mt-4">
          {isLoading ? (
            <div className="text-center py-12 text-slate-400 text-sm">Loading...</div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">No receipts found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Receipt</TableHead>
                  <TableHead className="text-xs">Student</TableHead>
                  <TableHead className="text-xs">Mode</TableHead>
                  <TableHead className="text-xs text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r, i) => (
                  <TableRow key={i} className={r.isVoided ? 'opacity-40 line-through' : ''}>
                    <TableCell className="text-xs">{r.postedAt}</TableCell>
                    <TableCell className="text-xs font-mono text-slate-600">
                      {r.receiptNo}
                      {r.isVoided && (
                        <Badge className="ml-1 text-[10px] px-1 py-0 bg-red-100 text-red-700">VOID</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{r.student?.name || '—'}</TableCell>
                    <TableCell className="text-xs">{r.mode}</TableCell>
                    <TableCell className="text-xs text-right font-medium">
                      {r.isVoided ? <span className="text-slate-400">—</span> : `₹${fmt(r.amount)}`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}