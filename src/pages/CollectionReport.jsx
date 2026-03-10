import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import LoginRequired from '@/components/LoginRequired';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Filter } from 'lucide-react';
import { useAcademicYear } from '@/components/AcademicYearContext';
import moment from 'moment';

const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
const PAYMENT_MODES = ['Cash', 'Cheque', 'Online', 'DD', 'UPI'];

function CollectionReportContent() {
  const { academicYear } = useAcademicYear();
  const today = new Date().toISOString().split('T')[0];
  
  // Filters - default to today
  const [dateRange, setDateRange] = useState({ start: today, end: today });
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedMode, setSelectedMode] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch via protected server function (not direct entity access)
  const { data: reportData = {}, isLoading, error: fetchError } = useQuery({
    queryKey: ['fee-payments-collection', academicYear, dateRange, selectedClass, selectedMode, searchQuery],
    queryFn: async () => {
      try {
        const mode = selectedClass ? 'details' : 'summary';
        const res = await base44.functions.invoke('getCollectionByClass', {
          academicYear,
          dateFrom: dateRange.start,
          dateTo: dateRange.end,
          className: selectedClass || undefined,
          mode: selectedMode || undefined,
          reportMode: mode,
          classId: selectedClass || undefined,
          pageSize: 9999
        });
        return res.data || {};
      } catch (err) {
        if (err.response?.status === 403) {
          return {};
        }
        throw err;
      }
    },
    enabled: !!academicYear
  });

  const allPayments = reportData.rows || [];

  // Apply client-side filters
  const filteredPayments = allPayments.filter(p => {
    // Date range filter
    if (dateRange.start && p.payment_date < dateRange.start) return false;
    if (dateRange.end && p.payment_date > dateRange.end) return false;

    // Class filter
    if (selectedClass && p.class_name !== selectedClass) return false;

    // Payment mode filter
    if (selectedMode && p.payment_mode !== selectedMode) return false;

    // Search filter (receipt_no, student_name)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      if (!p.receipt_no?.toLowerCase().includes(query) &&
          !p.student_name?.toLowerCase().includes(query)) {
        return false;
      }
    }

    return true;
  });

  // Calculate summary
  const summary = {
    totalAmount: filteredPayments.reduce((sum, p) => sum + (p.amount_paid || 0), 0),
    receiptCount: filteredPayments.length,
    avgPerReceipt: filteredPayments.length > 0 
      ? filteredPayments.reduce((sum, p) => sum + (p.amount_paid || 0), 0) / filteredPayments.length 
      : 0
  };

  // Mode breakdown
  const modeBreakdown = {};
  filteredPayments.forEach(p => {
    const mode = p.payment_mode || 'Unknown';
    modeBreakdown[mode] = (modeBreakdown[mode] || 0) + (p.amount_paid || 0);
  });

  // Export to CSV
  const exportCSV = () => {
    const headers = ['Date', 'Receipt No.', 'Student', 'Class', 'Mode', 'Amount (₹)'];
    const rows = filteredPayments.map(p => [
      moment(p.payment_date).format('YYYY-MM-DD'),
      p.receipt_no || '',
      p.student_name || '',
      p.class_name || '',
      p.payment_mode || '',
      p.amount_paid || 0
    ]);

    // Summary section
    const summaryRows = [
      [],
      ['SUMMARY'],
      ['Total Receipts:', filteredPayments.length],
      ['Total Amount:', summary.totalAmount],
      ['Average Per Receipt:', summary.avgPerReceipt.toFixed(2)]
    ];

    // Mode breakdown
    const modeRows = [
      [],
      ['BREAKDOWN BY MODE']
    ];
    Object.entries(modeBreakdown).forEach(([mode, amount]) => {
      modeRows.push([mode, amount]);
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => 
        typeof cell === 'string' && cell.includes(',') ? `"${cell}"` : cell
      ).join(',')),
      ...summaryRows.map(row => row.join(',')),
      ...modeRows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Wave3A-Collection-${moment().format('YYYY-MM-DD')}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  // Show access denied on 403
  if (fetchError?.response?.status === 403) {
    return (
      <div className="p-4">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Access Denied</h2>
          <p className="text-sm text-red-600">You do not have permission to view financial reports.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Wave 3A Collection Report</h1>
        <p className="text-sm text-slate-500 mt-1">Cash payments collected (excluding reversals, credits, adjustments)</p>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-600" />
            <h2 className="font-semibold text-slate-700">Filters</h2>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <Label className="text-xs">From Date</Label>
              <Input 
                type="date" 
                className="mt-1"
                value={dateRange.start}
                onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">To Date</Label>
              <Input 
                type="date" 
                className="mt-1"
                value={dateRange.end}
                onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-xs">Class</Label>
              <Select value={selectedClass} onValueChange={setSelectedClass}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="All classes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>All classes</SelectItem>
                  {CLASSES.map(cls => <SelectItem key={cls} value={cls}>Class {cls}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Payment Mode</Label>
              <Select value={selectedMode} onValueChange={setSelectedMode}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="All modes" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>All modes</SelectItem>
                  {PAYMENT_MODES.map(mode => <SelectItem key={mode} value={mode}>{mode}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Receipt / Student</Label>
              <Input 
                className="mt-1"
                placeholder="Search..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <p className="text-xs text-slate-500">Total Receipts</p>
            <p className="text-2xl font-bold text-slate-900 mt-2">{summary.receiptCount}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <p className="text-xs text-slate-500">Total Amount Collected</p>
            <p className="text-2xl font-bold text-emerald-600 mt-2">₹{summary.totalAmount.toLocaleString('en-IN')}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-6">
            <p className="text-xs text-slate-500">Average Per Receipt</p>
            <p className="text-2xl font-bold text-slate-900 mt-2">₹{summary.avgPerReceipt.toFixed(0).toLocaleString('en-IN')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Mode Breakdown */}
      {Object.keys(modeBreakdown).length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <h3 className="font-semibold text-slate-700">Breakdown by Payment Mode</h3>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {Object.entries(modeBreakdown).map(([mode, amount]) => (
                <div key={mode} className="bg-slate-50 rounded-lg p-3">
                  <p className="text-xs text-slate-500">{mode}</p>
                  <p className="text-lg font-semibold text-slate-900 mt-1">₹{amount.toLocaleString('en-IN')}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Export Button */}
      <div className="flex justify-end">
        <Button onClick={exportCSV} className="gap-2 bg-[#1a237e] hover:bg-[#283593]">
          <Download className="h-4 w-4" />
          Export to CSV
        </Button>
      </div>

      {/* Table */}
      <Card className="border-0 shadow-sm overflow-hidden">
        <CardHeader className="pb-3">
          <h3 className="font-semibold text-slate-700">Collection Details</h3>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <div className="text-center py-8 text-slate-400">Loading...</div>
          ) : filteredPayments.length === 0 ? (
            <div className="text-center py-8 text-slate-400">No payments found for the selected filters.</div>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPayments.map(payment => (
                  <TableRow key={payment.id} className="text-xs border-b border-slate-100 hover:bg-slate-50">
                    <TableCell>{moment(payment.payment_date).format('YYYY-MM-DD')}</TableCell>
                    <TableCell className="font-mono text-slate-600">{payment.receipt_no || '—'}</TableCell>
                    <TableCell>{payment.student_name || '—'}</TableCell>
                    <TableCell>{payment.class_name || '—'}</TableCell>
                    <TableCell className="text-slate-600">{payment.payment_mode || '—'}</TableCell>
                    <TableCell className="text-right font-medium">{(payment.amount_paid || 0).toLocaleString('en-IN')}</TableCell>
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