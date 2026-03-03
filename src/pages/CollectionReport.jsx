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
import { Download, Filter, Loader2 } from 'lucide-react';
import { useAcademicYear } from '@/components/AcademicYearContext';
import moment from 'moment';

const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
const PAYMENT_MODES = ['Cash', 'Cheque', 'Online', 'DD', 'UPI'];

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

  // Backend-classified data via getCollectionReport
  const { data, isLoading } = useQuery({
    queryKey: ['collection-report', academicYear, dateRange, selectedClass, selectedMode, searchQuery, includeReversals, includeVoided],
    queryFn: async () => {
      const res = await base44.functions.invoke('getCollectionReport', {
        academicYear,
        dateFrom: dateRange.start || undefined,
        dateTo: dateRange.end || undefined,
        className: selectedClass || undefined,
        paymentMode: selectedMode || undefined,
        search: searchQuery || undefined,
        includeReversals,
        includeVoided,
        reportMode: 'list',
        pageSize: 1000
      });
      return res.data;
    },
    enabled: !!academicYear,
    keepPreviousData: true
  });

  const rows = data?.rows || [];
  const summary = data?.summary || { grossCollected: 0, grossReversed: 0, netCollected: 0, modeBreakdown: {} };

  const exportCSV = async () => {
    const res = await base44.functions.invoke('getCollectionReport', {
      academicYear,
      dateFrom: dateRange.start || undefined,
      dateTo: dateRange.end || undefined,
      className: selectedClass || undefined,
      paymentMode: selectedMode || undefined,
      search: searchQuery || undefined,
      includeReversals,
      includeVoided,
      reportMode: 'export'
    });
    // Response is CSV text
    const csv = res.data;
    const blob = new Blob([typeof csv === 'string' ? csv : JSON.stringify(csv)], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `collection-report-${academicYear}-${moment().format('YYYY-MM-DD')}.csv`;
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
        <Card className="border-0 shadow-sm bg-green-50">
          <CardContent className="pt-4 pb-3">
            <p className="text-[11px] text-green-600">Gross Collected</p>
            <p className="text-2xl font-bold text-green-700 mt-1">₹{fmt(summary.grossCollected)}</p>
          </CardContent>
        </Card>
        {summary.grossReversed > 0 && (
          <Card className="border-0 shadow-sm bg-red-50">
            <CardContent className="pt-4 pb-3">
              <p className="text-[11px] text-red-500">Gross Reversed</p>
              <p className="text-2xl font-bold text-red-600 mt-1">−₹{fmt(summary.grossReversed)}</p>
            </CardContent>
          </Card>
        )}
        <Card className="border-0 shadow-sm bg-blue-50">
          <CardContent className="pt-4 pb-3">
            <p className="text-[11px] text-blue-600">Net Collected</p>
            <p className="text-2xl font-bold text-blue-700 mt-1">₹{fmt(summary.netCollected)}</p>
            <p className="text-[10px] text-blue-400 mt-0.5">{rows.filter(r => !r.isVoid).length} entries</p>
          </CardContent>
        </Card>
      </div>

      {/* Mode breakdown */}
      {Object.keys(summary.modeBreakdown || {}).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(summary.modeBreakdown).map(([mode, amt]) => (
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
            <div className="flex items-center justify-center py-12 text-slate-400 gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading…
            </div>
          ) : rows.length === 0 ? (
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
                  <TableHead className="text-xs font-semibold">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.id}
                    className={`text-xs border-b border-slate-100 ${r.isVoid ? 'opacity-40' : 'hover:bg-slate-50'}`}
                  >
                    <TableCell className="text-slate-600 whitespace-nowrap">
                      {r.date ? moment(r.date).format('DD MMM YY') : '—'}
                    </TableCell>
                    <TableCell className="font-mono text-slate-600">{r.receiptNo || '—'}</TableCell>
                    <TableCell className="font-medium text-slate-800">{r.studentName || '—'}</TableCell>
                    <TableCell className="text-slate-600">{r.className || '—'}</TableCell>
                    <TableCell className="text-slate-600">{r.mode || '—'}</TableCell>
                    <TableCell className={`text-right font-semibold tabular-nums ${
                      r.isVoid ? 'text-slate-400 line-through' :
                      r.isReversal ? 'text-red-600' : 'text-emerald-700'
                    }`}>
                      {r.isReversal ? `−₹${fmt(Math.abs(r.signedAmount))}` : `₹${fmt(r.signedAmount)}`}
                    </TableCell>
                    <TableCell>
                      {r.isVoid ? (
                        <Badge className="text-[10px] bg-slate-200 text-slate-500">VOID</Badge>
                      ) : r.isReversal ? (
                        <Badge className="text-[10px] bg-red-100 text-red-700">Reversal</Badge>
                      ) : (
                        <Badge className="text-[10px] bg-emerald-100 text-emerald-700">Payment</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-400 text-[10px] max-w-[160px]">
                      {r.notes
                        ? <span title={r.notes} className="truncate block max-w-[160px]">{r.notes}</span>
                        : '—'}
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
    <LoginRequired allowedRoles={['admin', 'principal', 'accountant']} pageName="Collection Report">
      <CollectionReportContent />
    </LoginRequired>
  );
}