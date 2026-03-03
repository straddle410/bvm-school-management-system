import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import LoginRequired from '@/components/LoginRequired';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useAcademicYear } from '@/components/AcademicYearContext';
import OutstandingDetailDrawer from '@/components/fees/OutstandingDetailDrawer';
import moment from 'moment';

const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

function fmt(n) {
  return (n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function SortIcon({ field, sort }) {
  if (!sort.startsWith(field)) return <ArrowUpDown className="h-3 w-3 inline ml-1 text-slate-400" />;
  return sort.endsWith('desc')
    ? <ArrowDown className="h-3 w-3 inline ml-1 text-slate-600" />
    : <ArrowUp className="h-3 w-3 inline ml-1 text-slate-600" />;
}

function OutstandingReportContent() {
  const { academicYear } = useAcademicYear();
  const today = moment().format('YYYY-MM-DD');

  const [asOfDate, setAsOfDate] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [search, setSearch] = useState('');
  const [includeZero, setIncludeZero] = useState(false);
  const [viewMode, setViewMode] = useState('all'); // 'all' | 'due' | 'credit'
  const [sort, setSort] = useState('outstanding_desc');
  const [selectedRow, setSelectedRow] = useState(null);
  const [exporting, setExporting] = useState(false);

  const effectiveDate = asOfDate || today;

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['outstanding-report', academicYear, effectiveDate, selectedClass, search, includeZero, viewMode, sort],
    queryFn: async () => {
      const res = await base44.functions.invoke('getOutstandingReport', {
        academicYear,
        asOfDate: asOfDate || undefined,
        className: selectedClass || undefined,
        search: search || undefined,
        includeZeroOutstanding: includeZero,
        onlyDue: viewMode === 'due',
        onlyCredit: viewMode === 'credit',
        sort,
        page: 1,
        pageSize: 500
      });
      return res.data;
    },
    enabled: !!academicYear
  });

  const rows = data?.rows || [];
  const summary = data?.summary || {};

  const toggleSort = (field) => {
    const next = sort === `${field}_desc` ? `${field}_asc` : `${field}_desc`;
    setSort(next);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await base44.functions.invoke('getOutstandingReport', {
        academicYear,
        asOfDate: asOfDate || undefined,
        className: selectedClass || undefined,
        search: search || undefined,
        includeZeroOutstanding: includeZero,
        onlyDue: viewMode === 'due',
        onlyCredit: viewMode === 'credit',
        sort,
        exportCsv: true,
        pageSize: 9999
      });
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `outstanding-report-${effectiveDate}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="p-4 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Outstanding / Due Report</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            As of: <strong>{moment(effectiveDate).format('DD MMM YYYY')}</strong> · Year: <strong>{academicYear}</strong>
          </p>
        </div>
        <Button onClick={handleExport} disabled={exporting || rows.length === 0}
          className="gap-2 bg-[#1a237e] hover:bg-[#283593] text-sm">
          <Download className="h-4 w-4" />
          {exporting ? 'Exporting…' : 'Export CSV'}
        </Button>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-4 pb-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 items-end">
            <div>
              <Label className="text-xs">As Of Date</Label>
              <Input type="date" className="mt-1" value={asOfDate}
                onChange={e => setAsOfDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Class</Label>
              <Select value={selectedClass} onValueChange={v => setSelectedClass(v === '__all__' ? '' : v)}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="All classes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All classes</SelectItem>
                  {CLASSES.map(cls => <SelectItem key={cls} value={cls}>Class {cls}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Search Student</Label>
              <Input className="mt-1" placeholder="Name or ID…" value={search}
                onChange={e => setSearch(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Sort By</Label>
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="outstanding_desc">Outstanding ↓</SelectItem>
                  <SelectItem value="outstanding_asc">Outstanding ↑</SelectItem>
                  <SelectItem value="name_asc">Name A→Z</SelectItem>
                  <SelectItem value="name_desc">Name Z→A</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Show</Label>
              <Select value={viewMode} onValueChange={setViewMode}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Due + Credit</SelectItem>
                  <SelectItem value="due">Due Only</SelectItem>
                  <SelectItem value="credit">Credit Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-5">
              <Switch id="incl-zero" checked={includeZero} onCheckedChange={setIncludeZero} />
              <Label htmlFor="incl-zero" className="text-xs cursor-pointer">Include Zero</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-3">
            <p className="text-[11px] text-slate-500">Total Students</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{summary.countTotal ?? 0}</p>
            {(summary.countCreditStudents ?? 0) > 0 && (
              <p className="text-[10px] text-emerald-600 mt-0.5">{summary.countCreditStudents} with credit</p>
            )}
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-red-50 border-red-100">
          <CardContent className="pt-4 pb-3">
            <p className="text-[11px] text-red-500">Total Due</p>
            <p className="text-xl font-bold text-red-600 mt-1">₹{fmt(summary.totalDue)}</p>
            <p className="text-[10px] text-red-400 mt-0.5">{summary.countDueStudents ?? 0} students</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-emerald-50 border-emerald-100">
          <CardContent className="pt-4 pb-3">
            <p className="text-[11px] text-emerald-600">Credit Balances</p>
            <p className="text-xl font-bold text-emerald-600 mt-1">₹{fmt(summary.totalCredit)}</p>
            <p className="text-[10px] text-emerald-500 mt-0.5">{summary.countCreditStudents ?? 0} overpaid</p>
          </CardContent>
        </Card>
        <Card className={`border-0 shadow-sm ${(summary.netReceivable ?? 0) > 0 ? 'bg-orange-50 border-orange-100' : 'bg-slate-50'}`}>
          <CardContent className="pt-4 pb-3">
            <p className="text-[11px] text-slate-500">Net Receivable</p>
            <p className={`text-xl font-bold mt-1 ${(summary.netReceivable ?? 0) > 0 ? 'text-orange-600' : 'text-slate-700'}`}>
              ₹{fmt(summary.netReceivable)}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">Due − Credit</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="text-center py-12 text-slate-400">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="text-center py-12 text-slate-400">No outstanding dues found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="text-xs font-semibold cursor-pointer" onClick={() => toggleSort('name')}>
                    Student <SortIcon field="name" sort={sort} />
                  </TableHead>
                  <TableHead className="text-xs font-semibold">Class</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Gross</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Discount</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Net Inv.</TableHead>
                  <TableHead className="text-xs font-semibold text-right">Paid</TableHead>
                  <TableHead className="text-xs font-semibold text-right cursor-pointer text-red-600" onClick={() => toggleSort('outstanding')}>
                    Due <SortIcon field="outstanding" sort={sort} />
                  </TableHead>
                  <TableHead className="text-xs font-semibold text-right text-emerald-600">Credit</TableHead>
                  <TableHead className="text-xs font-semibold">Last Payment</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={row.student.id}
                    className="text-xs cursor-pointer hover:bg-slate-50 border-b border-slate-100"
                    onClick={() => setSelectedRow(row)}
                  >
                    <TableCell>
                      <div className="font-medium text-slate-800">{row.student.name}</div>
                      <div className="text-[10px] text-slate-400">{row.student.id}</div>
                    </TableCell>
                    <TableCell className="text-slate-600">{row.class.name}</TableCell>
                    <TableCell className="text-right text-slate-600">₹{fmt(row.grossAmount)}</TableCell>
                    <TableCell className="text-right text-amber-600">-₹{fmt(row.discountAmount)}</TableCell>
                    <TableCell className="text-right font-medium text-slate-700">₹{fmt(row.netInvoiced)}</TableCell>
                    <TableCell className="text-right text-emerald-600">₹{fmt(row.paidAmount)}</TableCell>
                    <TableCell className={`text-right font-bold ${row.outstanding > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                      ₹{fmt(row.outstanding)}
                    </TableCell>
                    <TableCell className="text-slate-500">
                      {row.lastPaymentDate ? moment(row.lastPaymentDate).format('DD MMM YY') : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {isFetching && !isLoading && (
            <div className="text-center py-2 text-xs text-slate-400">Refreshing…</div>
          )}
        </CardContent>
      </Card>

      {/* Detail Drawer */}
      <OutstandingDetailDrawer
        row={selectedRow}
        academicYear={academicYear}
        asOfDate={asOfDate || undefined}
        onClose={() => setSelectedRow(null)}
      />
    </div>
  );
}

export default function OutstandingReport() {
  return (
    <LoginRequired allowedRoles={['admin', 'principal']} pageName="Outstanding Report">
      <OutstandingReportContent />
    </LoginRequired>
  );
}