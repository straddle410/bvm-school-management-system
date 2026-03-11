import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import LoginRequired from '@/components/LoginRequired';
import { useAcademicYear } from '@/components/AcademicYearContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Filter, BarChart3 } from 'lucide-react';
import ClassCollectionDetailDrawer from '@/components/fees/ClassCollectionDetailDrawer';
import moment from 'moment';

const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
const PAYMENT_MODES = ['Cash', 'Cheque', 'Online', 'DD', 'UPI', 'NEFT', 'RTGS', 'Card'];

const fmt = n => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function ClassCollectionContent() {
  const { academicYear } = useAcademicYear();

  const thisMonthStart = moment().startOf('month').format('YYYY-MM-DD');
  const today = moment().format('YYYY-MM-DD');

  const [dateFrom, setDateFrom] = useState(thisMonthStart);
  const [dateTo, setDateTo] = useState(today);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedMode, setSelectedMode] = useState('');
  const [includeVoided, setIncludeVoided] = useState(false);
  const [appliedFilters, setAppliedFilters] = useState({
    dateFrom: thisMonthStart, dateTo: today, selectedClass: '', selectedMode: '', includeVoided: false
  });
  const [drawerClass, setDrawerClass] = useState(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['collection-by-class', appliedFilters, academicYear],
    queryFn: async () => {
      const payload = {
        dateFrom: appliedFilters.dateFrom,
        dateTo: appliedFilters.dateTo,
        academicYear,
        includeVoided: appliedFilters.includeVoided,
        reportMode: 'summary',
      };
      if (appliedFilters.selectedClass) payload.className = appliedFilters.selectedClass;
      if (appliedFilters.selectedMode) payload.mode = appliedFilters.selectedMode;
      const res = await base44.functions.invoke('getCollectionByClass', payload);
      return res.data;
    },
    enabled: !!appliedFilters.dateFrom && !!appliedFilters.dateTo,
  });

  const handleApply = () => {
    setAppliedFilters({ dateFrom, dateTo, selectedClass, selectedMode, includeVoided });
  };

  const handleExport = async () => {
    const payload = {
      dateFrom: appliedFilters.dateFrom,
      dateTo: appliedFilters.dateTo,
      academicYear,
      includeVoided: appliedFilters.includeVoided,
      reportMode: 'export',
    };
    if (appliedFilters.selectedClass) payload.className = appliedFilters.selectedClass;
    if (appliedFilters.selectedMode) payload.mode = appliedFilters.selectedMode;

    const res = await base44.functions.invoke('getCollectionByClass', payload);
    const csvText = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    const blob = new Blob([csvText], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `collection-by-class-${appliedFilters.dateFrom}-to-${appliedFilters.dateTo}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  const summary = data?.summary || {};
  const rows = data?.rows || [];

  return (
    <div className="p-4 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-[#1a237e]" />
            Collection by Class
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Fee collection summary grouped by class</p>
        </div>
        <Button onClick={handleExport} variant="outline" className="gap-2 hidden sm:flex">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 items-end">
            <div>
              <Label className="text-xs text-slate-500">From Date</Label>
              <Input type="date" className="mt-1" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-slate-500">To Date</Label>
              <Input type="date" className="mt-1" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs text-slate-500">Class</Label>
              <Select value={selectedClass} onValueChange={v => setSelectedClass(v === 'all' ? '' : v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="All Classes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {CLASSES.map(c => <SelectItem key={c} value={c}>Class {c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs text-slate-500">Mode</Label>
              <Select value={selectedMode} onValueChange={v => setSelectedMode(v === 'all' ? '' : v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="All Modes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Modes</SelectItem>
                  {PAYMENT_MODES.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-slate-500">Show Voided (audit)</Label>
              <div className="flex items-center gap-2 mt-2">
                <Switch checked={includeVoided} onCheckedChange={setIncludeVoided} />
                <span className="text-xs text-slate-500">{includeVoided ? 'ON' : 'OFF'}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleApply} className="flex-1 bg-[#1a237e] hover:bg-[#283593] gap-1">
                <Filter className="h-3 w-3" /> Apply
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className={`grid gap-4 grid-cols-2 ${appliedFilters.includeVoided ? 'sm:grid-cols-5' : 'sm:grid-cols-4'}`}>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5 pb-5">
            <p className="text-xs text-slate-500">Total Invoiced (Net)</p>
            <p className="text-xl font-bold text-slate-700 mt-1">₹{fmt(summary.totalInvoicedNetAllClasses)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5 pb-5">
            <p className="text-xs text-slate-500">Total Collected</p>
            <p className="text-xl font-bold text-emerald-600 mt-1">₹{fmt(summary.totalCollected)}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5 pb-5">
            <p className="text-xs text-slate-500">Overall Coverage (Range/Annual)</p>
            <p className="text-xl font-bold text-blue-600 mt-1">{(summary.overallCoveragePercent ?? 0).toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-5 pb-5">
            <p className="text-xs text-slate-500">Total Receipts</p>
            <p className="text-xl font-bold text-slate-900 mt-1">{summary.totalReceipts ?? 0}</p>
          </CardContent>
        </Card>
        {appliedFilters.includeVoided && (
          <Card className="border-0 shadow-sm border-red-100">
            <CardContent className="pt-5 pb-5">
              <p className="text-xs text-red-400">Voided Amount (audit)</p>
              <p className="text-xl font-bold text-red-500 mt-1">₹{fmt(summary.voidedAmount)}</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="text-center py-12 text-slate-400">Loading...</div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-slate-400">No data for the selected filters.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-xs font-semibold pl-4">Class</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Annual Invoiced (Net)</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Collected (₹)</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Coverage (Range/Annual) %</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Receipts</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Students Paid</TableHead>
                  {appliedFilters.includeVoided && (
                    <>
                      <TableHead className="text-xs font-semibold text-right text-red-400">Voided Rcpts</TableHead>
                      <TableHead className="text-xs font-semibold text-right text-red-400">Voided Amt (₹)</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(row => (
                  <TableRow
                    key={row.class.id}
                    className="cursor-pointer hover:bg-blue-50 transition-colors border-b border-slate-100"
                    onClick={() => setDrawerClass(row.class.name)}
                  >
                    <TableCell className="font-semibold text-slate-800 pl-4">
                      Class {row.class.name}
                    </TableCell>
                    <TableCell className="text-right text-slate-500">₹{fmt(row.totalInvoicedNet)}</TableCell>
                    <TableCell className="text-right font-bold text-emerald-700">
                      ₹{fmt(row.collectedAmount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={`font-semibold ${row.coveragePercent >= 100 ? 'text-emerald-600' : row.coveragePercent >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                        {(row.coveragePercent ?? 0).toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-slate-600">{row.receiptsCount}</TableCell>
                    <TableCell className="text-right text-slate-600">{row.studentsPaidCount}</TableCell>
                    {appliedFilters.includeVoided && (
                      <>
                        <TableCell className="text-right text-red-400">{row.voidedReceiptsCount}</TableCell>
                        <TableCell className="text-right text-red-400">₹{fmt(row.voidedAmount)}</TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
                {/* Totals row */}
                <TableRow className="bg-slate-50 font-bold">
                  <TableCell className="pl-4 text-slate-700">Total (Range/Annual)</TableCell>
                  <TableCell className="text-right text-slate-600">₹{fmt(summary.totalInvoicedNetAllClasses)}</TableCell>
                  <TableCell className="text-right text-emerald-700">₹{fmt(summary.totalCollected)}</TableCell>
                  <TableCell className="text-right text-blue-600">{(summary.overallCoveragePercent ?? 0).toFixed(1)}%</TableCell>
                  <TableCell className="text-right text-slate-700">{summary.totalReceipts ?? 0}</TableCell>
                  <TableCell className="text-right text-slate-500">—</TableCell>
                  {appliedFilters.includeVoided && (
                    <>
                      <TableCell className="text-right text-red-400">
                        {rows.reduce((s, r) => s + r.voidedReceiptsCount, 0)}
                      </TableCell>
                      <TableCell className="text-right text-red-400">
                        ₹{fmt(summary.voidedAmount)}
                      </TableCell>
                    </>
                  )}
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Mobile export */}
      <div className="sm:hidden flex justify-end">
        <Button onClick={handleExport} variant="outline" className="gap-2">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* Detail Drawer */}
      <ClassCollectionDetailDrawer
        className={drawerClass}
        dateFrom={appliedFilters.dateFrom}
        dateTo={appliedFilters.dateTo}
        academicYear={academicYear}
        includeVoided={appliedFilters.includeVoided}
        onClose={() => setDrawerClass(null)}
      />
    </div>
  );
}

export default function ClassCollectionSummaryReport() {
  return (
    <LoginRequired allowedRoles={['admin', 'principal', 'accountant']} pageName="Collection by Class">
      <ClassCollectionContent />
    </LoginRequired>
  );
}