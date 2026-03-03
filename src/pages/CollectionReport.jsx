import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import LoginRequired from '@/components/LoginRequired';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Filter } from 'lucide-react';
import { useAcademicYear } from '@/components/AcademicYearContext';
import moment from 'moment';

const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
const PAYMENT_MODES = ['Cash', 'Cheque', 'Online', 'DD', 'UPI'];
const REVERSAL_TYPES = new Set(['PAYMENT_REVERSAL', 'PAYMENT_REFUND', 'REVERSAL', 'CREDIT_REVERSAL']);

function fmt(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

function CollectionReportContent() {
  const { academicYear } = useAcademicYear();

  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedMode, setSelectedMode] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [includeReversals, setIncludeReversals] = useState(true);
  const [includeVoided, setIncludeVoided] = useState(false);

  // Fetch all cash-affecting payments for this AY (including reversal entries)
  const { data: allPayments = [], isLoading } = useQuery({
    queryKey: ['fee-payments-collection', academicYear],
    queryFn: async () => {
      // Fetch ALL payments; we classify client-side
      const payments = await base44.entities.FeePayment.filter({
        academic_year: academicYear
      });
      return payments || [];
    },
    enabled: !!academicYear
  });

  // Classify and filter payments
  const classifiedPayments = allPayments
    .map(p => {
      const et = p.entry_type || '';
      const status = p.status || '';
      const isVoid = status === 'REVERSED' && !REVERSAL_TYPES.has(et);
      const isReversal = REVERSAL_TYPES.has(et) || (!isVoid && (p.amount_paid ?? 0) < 0 && !REVERSAL_TYPES.has(et) && et !== 'CREDIT_ADJUSTMENT');
      const isCredit = et === 'CREDIT_ADJUSTMENT' && !isReversal && !isVoid;
      const isCash = !isReversal && !isCredit && !isVoid;

      // Signed amount: reversals are negative in the ledger
      let signedAmount = p.amount_paid ?? 0;
      if (isReversal && signedAmount > 0) signedAmount = -signedAmount;
      if (isVoid) signedAmount = 0;

      return { ...p, isVoid, isReversal, isCredit, isCash, signedAmount };
    })
    .filter(p => {
      // Always skip pure credit adjustments
      if (p.isCredit) return false;
      // Skip voided originals unless requested
      if (p.isVoid && !includeVoided) return false;
      // Skip reversal entries unless requested
      if (p.isReversal && !includeReversals) return false;
      return true;
    });

  // Apply user filters
  const filteredPayments = classifiedPayments.filter(p => {
    if (dateRange.start && p.payment_date < dateRange.start) return false;
    if (dateRange.end && p.payment_date > dateRange.end) return false;
    if (selectedClass && p.class_name !== selectedClass) return false;
    if (selectedMode && p.payment_mode !== selectedMode) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!p.receipt_no?.toLowerCase().includes(q) &&
          !p.student_name?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Summary — only cash (non-void, non-reversal) in positive totals; reversals reduce net
  const grossCollected = filteredPayments.filter(p => p.isCash).reduce((s, p) => s + (p.amount_paid || 0), 0);
  const grossReversed = filteredPayments.filter(p => p.isReversal).reduce((s, p) => s + Math.abs(p.amount_paid || 0), 0);
  const netCollected = grossCollected - grossReversed;

  // Mode breakdown (on signed amounts, for net-correct view)
  const modeBreakdown = {};
  filteredPayments.filter(p => !p.isVoid).forEach(p => {
    const mode = p.payment_mode || 'Unknown';
    if (!modeBreakdown[mode]) modeBreakdown[mode] = 0;
    modeBreakdown[mode] += p.signedAmount;
  });

  const exportCSV = () => {
    const headers = ['Date', 'Receipt No.', 'Student', 'Class', 'Mode', 'Amount (₹)', 'Type', 'Status'];
    const rows = filteredPayments.map(p => [
      p.payment_date || '',
      p.receipt_no || '',
      `"${(p.student_name || '').replace(/"/g, '""')}"`,
      p.class_name || '',
      p.payment_mode || '',
      p.signedAmount,
      p.isReversal ? 'REVERSAL' : p.isVoid ? 'VOID' : 'PAYMENT',
      p.isVoid ? 'VOID' : 'POSTED'
    ]);

    const summaryRows = [
      [],
      ['SUMMARY'],
      ['Gross Collected:', grossCollected],
      ['Gross Reversed:', grossReversed],
      ['Net Collected:', netCollected],
      [],
      ['BREAKDOWN BY MODE'],
      ...Object.entries(modeBreakdown).map(([mode, amt]) => [mode, amt])
    ];

    const csv = [headers.join(','), ...rows.map(r => r.join(',')), ...summaryRows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `collection-report-${moment().format('YYYY-MM-DD')}.csv`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    a.remove();
  };

  return (
    <div className="p-4 space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Collection Report</h1>
          <p className="text-xs text-slate-500 mt-0.5">Cash collections for {academicYear}</p>
        </div>
        <Button onClick={exportCSV} className="gap-2 bg-[#1a237e] hover:bg-[#283593] text-sm">
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center gap-2 text-slate-600 font-semibold text-sm">
            <Filter className="h-4 w-4" /> Filters
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div>
              <Label className="text-xs">From Date</Label>
              <Input type="date" className="mt-1 h-9" value={dateRange.start}
                onChange={e => setDateRange(p => ({ ...p, start: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">To Date</Label>
              <Input type="date" className="mt-1 h-9" value={dateRange.end}
                onChange={e => setDateRange(p => ({ ...p, end: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Class</Label>
              <Select value={selectedClass || '__all__'} onValueChange={v => setSelectedClass(v === '__all__' ? '' : v)}>
                <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="All classes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All classes</SelectItem>
                  {CLASSES.map(cls => <SelectItem key={cls} value={cls}>Class {cls}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Mode</Label>
              <Select value={selectedMode || '__all__'} onValueChange={v => setSelectedMode(v === '__all__' ? '' : v)}>
                <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="All modes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All modes</SelectItem>
                  {PAYMENT_MODES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Receipt / Student</Label>
              <Input className="mt-1 h-9" placeholder="Search…" value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-wrap gap-4 pt-1">
            <div className="flex items-center gap-2">
              <Switch id="incl-rev" checked={includeReversals} onCheckedChange={setIncludeReversals} />
              <Label htmlFor="incl-rev" className="text-xs cursor-pointer text-slate-600">Include Reversals</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="incl-void" checked={includeVoided} onCheckedChange={setIncludeVoided} />
              <Label htmlFor="incl-void" className="text-xs cursor-pointer text-slate-600">Include Voided (audit)</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="border-0 shadow-sm bg-green-50 border-green-200">
          <CardContent className="pt-4 pb-3">
            <p className="text-[11px] text-green-600">Gross Collected</p>
            <p className="text-2xl font-bold text-green-700 mt-1">₹{fmt(grossCollected)}</p>
          </CardContent>
        </Card>
        {grossReversed > 0 && (
          <Card className="border-0 shadow-sm bg-red-50 border-red-200">
            <CardContent className="pt-4 pb-3">
              <p className="text-[11px] text-red-500">Gross Reversed</p>
              <p className="text-2xl font-bold text-red-600 mt-1">−₹{fmt(grossReversed)}</p>
            </CardContent>
          </Card>
        )}
        <Card className="border-0 shadow-sm bg-blue-50 border-blue-200">
          <CardContent className="pt-4 pb-3">
            <p className="text-[11px] text-blue-600">Net Collected</p>
            <p className="text-2xl font-bold text-blue-700 mt-1">₹{fmt(netCollected)}</p>
            <p className="text-[10px] text-blue-400 mt-0.5">{filteredPayments.filter(p => !p.isVoid).length} entries</p>
          </CardContent>
        </Card>
      </div>

      {/* Mode breakdown */}
      {Object.keys(modeBreakdown).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(modeBreakdown).map(([mode, amt]) => (
            <div key={mode} className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs shadow-sm">
              <span className="font-semibold text-slate-700">{mode}</span>
              <span className="mx-1 text-slate-400">·</span>
              <span className={amt < 0 ? 'text-red-500' : 'text-emerald-600'}>₹{fmt(amt)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="text-center py-12 text-slate-400">Loading…</div>
          ) : filteredPayments.length === 0 ? (
            <div className="text-center py-12 text-slate-400">No payments found for the selected filters.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-xs font-semibold">Date</TableHead>
                  <TableHead className="text-xs font-semibold">Receipt No.</TableHead>
                  <TableHead className="text-xs font-semibold">Student</TableHead>
                  <TableHead className="text-xs font-semibold">Class</TableHead>
                  <TableHead className="text-xs font-semibold">Mode</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Amount (₹)</TableHead>
                  <TableHead className="text-xs font-semibold">Type</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.map(p => (
                  <TableRow key={p.id}
                    className={`text-xs border-b border-slate-100 ${p.isVoid ? 'opacity-40' : 'hover:bg-slate-50'}`}
                  >
                    <TableCell className="text-slate-600 whitespace-nowrap">
                      {p.payment_date ? moment(p.payment_date).format('DD MMM YY') : '—'}
                    </TableCell>
                    <TableCell className="font-mono text-slate-600">{p.receipt_no || '—'}</TableCell>
                    <TableCell className="font-medium text-slate-800">{p.student_name || '—'}</TableCell>
                    <TableCell className="text-slate-600">{p.class_name || '—'}</TableCell>
                    <TableCell className="text-slate-600">{p.payment_mode || '—'}</TableCell>
                    <TableCell className={`text-right font-semibold tabular-nums ${
                      p.isVoid ? 'text-slate-400 line-through' :
                      p.isReversal ? 'text-red-600' : 'text-emerald-700'
                    }`}>
                      {p.isReversal ? `−₹${fmt(Math.abs(p.signedAmount))}` : `₹${fmt(p.signedAmount)}`}
                    </TableCell>
                    <TableCell>
                      {p.isVoid ? (
                        <Badge className="text-[10px] bg-slate-200 text-slate-500 line-through">VOID</Badge>
                      ) : p.isReversal ? (
                        <Badge className="text-[10px] bg-red-100 text-red-700">Reversal</Badge>
                      ) : (
                        <Badge className="text-[10px] bg-emerald-100 text-emerald-700">Payment</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function CollectionReport() {
  return (
    <LoginRequired allowedRoles={['admin', 'principal']} pageName="Collection Report">
      <CollectionReportContent />
    </LoginRequired>
  );
}