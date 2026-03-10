import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import LoginRequired from '@/components/LoginRequired';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Search, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useAcademicYear } from '@/components/AcademicYearContext';
import LedgerRowDrawer from '@/components/fees/LedgerRowDrawer';
import moment from 'moment';

function fmt(n) {
  return (n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const TYPE_STYLES = {
  INVOICE:    'bg-blue-100 text-blue-700',
  PAYMENT:    'bg-emerald-100 text-emerald-700',
  REVERSAL:   'bg-red-100 text-red-700',
  CREDIT:     'bg-purple-100 text-purple-700',
  ADJUSTMENT: 'bg-amber-100 text-amber-700',
};

function StudentLedgerContent() {
  const { academicYear } = useAcademicYear();
  const navigate = useNavigate();

  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [studentSuggestions, setStudentSuggestions] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [includeReversals, setIncludeReversals] = useState(true);
  const [includeCredits, setIncludeCredits] = useState(true);
  const [includeVoided, setIncludeVoided] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [invoicesCache, setInvoicesCache] = useState([]);

  // Student typeahead
  const { data: studentResults = [], isFetching: searchingStudents } = useQuery({
    queryKey: ['student-search', searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      const students = await base44.entities.Student.filter({ academic_year: academicYear, is_deleted: false });
      const q = searchQuery.toLowerCase();
      return students.filter(s =>
        s.name?.toLowerCase().includes(q) ||
        s.student_id?.toLowerCase().includes(q)
      ).slice(0, 10);
    },
    enabled: searchQuery.length >= 2,
    staleTime: 30000
  });

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setSearchQuery(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setStudentSuggestions(studentResults);
  }, [studentResults]);

  // Ledger data
  const { data, isLoading, error: fetchError } = useQuery({
    queryKey: ['student-ledger', selectedStudent?.student_id, academicYear, dateFrom, dateTo, includeReversals, includeCredits, includeVoided],
    queryFn: async () => {
      try {
        const staffInfo = (() => {
          try {
            const raw = localStorage.getItem('staff_session');
            return raw ? JSON.parse(raw) : null;
          } catch { return null; }
        })();
        const res = await base44.functions.invoke('getStudentLedger', {
          studentId: selectedStudent.student_id,
          academicYear: academicYear || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          includeReversals,
          includeCredits,
          includeVoided,
          pageSize: 500,
          staffInfo
        });
        return res.data;
      } catch (err) {
        if (err.response?.status === 403) return null;
        throw err;
      }
    },
    enabled: !!selectedStudent
  });

  // Fetch invoices for drawer line items (via protected getStudentLedger, not direct entity)
  useEffect(() => {
    // Invoices are returned within ledger data
  }, [selectedStudent, academicYear]);

  const rows = data?.rows || [];
  const summary = data?.summary || {};

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

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await base44.functions.invoke('getStudentLedger', {
        studentId: selectedStudent.student_id,
        academicYear: academicYear || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        includeReversals,
        includeCredits,
        includeVoided,
        exportCsv: true,
        pageSize: 9999
      });
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ledger-${selectedStudent.student_id}.csv`;
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
          <h1 className="text-xl font-bold text-slate-900">Student Ledger Report</h1>
          <p className="text-xs text-slate-500 mt-0.5">Chronological fee ledger with running balance</p>
        </div>
        {selectedStudent && (
          <div className="flex gap-2">
            <Button onClick={() => navigate(`${createPageUrl('ParentStatement')}?studentId=${selectedStudent.student_id}&year=${academicYear}`)}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-sm">
              <FileText className="h-4 w-4" />
              Print Statement
            </Button>
            <Button onClick={handleExport} disabled={exporting || rows.length === 0}
              className="gap-2 bg-[#1a237e] hover:bg-[#283593] text-sm">
              <Download className="h-4 w-4" />
              {exporting ? 'Exporting…' : 'Export CSV'}
            </Button>
          </div>
        )}
      </div>

      {/* Student Picker */}
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-4 pb-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
            {/* Student search */}
            <div className="relative">
              <Label className="text-xs">Student (Name / ID)</Label>
              <div className="relative mt-1">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <Input
                  className="pl-8"
                  placeholder="Search student…"
                  value={searchInput}
                  onChange={e => { setSearchInput(e.target.value); if (!e.target.value) setSelectedStudent(null); }}
                />
              </div>
              {studentSuggestions.length > 0 && !selectedStudent && (
                <div className="absolute z-20 top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg mt-1 max-h-52 overflow-y-auto">
                  {studentSuggestions.map(s => (
                    <button key={s.id} className="w-full text-left px-3 py-2 hover:bg-slate-50 text-sm border-b border-slate-50 last:border-0"
                      onClick={() => { setSelectedStudent(s); setSearchInput(s.name); setStudentSuggestions([]); }}>
                      <div className="font-medium text-slate-800">{s.name}</div>
                      <div className="text-xs text-slate-400">ID: {s.student_id} · Class {s.class_name}-{s.section}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs">Date From</Label>
              <Input type="date" className="mt-1" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Date To</Label>
              <Input type="date" className="mt-1" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
            <div className="flex gap-4 items-center pt-5">
              <div className="flex items-center gap-1.5">
                <Switch id="rev" checked={includeReversals} onCheckedChange={setIncludeReversals} />
                <Label htmlFor="rev" className="text-xs cursor-pointer">Reversals</Label>
              </div>
              <div className="flex items-center gap-1.5">
                <Switch id="cred" checked={includeCredits} onCheckedChange={setIncludeCredits} />
                <Label htmlFor="cred" className="text-xs cursor-pointer">Credits</Label>
              </div>
              <div className="flex items-center gap-1.5">
                <Switch id="void" checked={includeVoided} onCheckedChange={setIncludeVoided} />
                <Label htmlFor="void" className="text-xs cursor-pointer">Voided</Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Student info strip */}
      {selectedStudent && (
        <div className="bg-[#e8eaf6] rounded-xl px-4 py-3 flex flex-wrap gap-4 items-center text-sm">
          <div>
            <span className="text-[11px] text-[#3949ab] font-semibold uppercase tracking-wide">Student</span>
            <p className="font-bold text-[#1a237e]">{selectedStudent.name}</p>
          </div>
          <div>
            <span className="text-[11px] text-slate-500 uppercase tracking-wide">ID</span>
            <p className="font-mono text-slate-700">{selectedStudent.student_id}</p>
          </div>
          <div>
            <span className="text-[11px] text-slate-500 uppercase tracking-wide">Class</span>
            <p className="text-slate-700">Class {selectedStudent.class_name}-{selectedStudent.section}</p>
          </div>
          {selectedStudent.parent_phone && (
            <div>
              <span className="text-[11px] text-slate-500 uppercase tracking-wide">Phone</span>
              <p className="text-slate-700">{selectedStudent.parent_phone}</p>
            </div>
          )}
        </div>
      )}

      {/* Summary Cards */}
      {selectedStudent && data && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-3 pb-3">
              <p className="text-[11px] text-slate-500">Opening Balance</p>
              <p className="text-lg font-bold text-slate-700 mt-0.5">₹{fmt(data.openingBalance)}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-3 pb-3">
              <p className="text-[11px] text-slate-500">Total Invoiced</p>
              <p className="text-lg font-bold text-blue-700 mt-0.5">₹{fmt(summary.totalInvoiced)}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-3 pb-3">
              <p className="text-[11px] text-slate-500">Total Paid</p>
              <p className="text-lg font-bold text-emerald-600 mt-0.5">₹{fmt(summary.totalPaid)}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm bg-red-50">
            <CardContent className="pt-3 pb-3">
              <p className="text-[11px] text-red-500">Closing Balance</p>
              <p className="text-lg font-bold text-red-600 mt-0.5">₹{fmt(data.closingBalance)}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-3 pb-3">
              <p className="text-[11px] text-slate-500">Entries</p>
              <p className="text-lg font-bold text-slate-700 mt-0.5">{data.meta?.totalRows ?? 0}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Ledger Table */}
      {selectedStudent ? (
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardContent className="p-0 overflow-x-auto">
            {isLoading ? (
              <div className="text-center py-12 text-slate-400">Loading ledger…</div>
            ) : rows.length === 0 ? (
              <div className="text-center py-12 text-slate-400">No ledger entries found for this student.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="text-xs font-semibold">Date</TableHead>
                    <TableHead className="text-xs font-semibold">Type</TableHead>
                    <TableHead className="text-xs font-semibold">Ref</TableHead>
                    <TableHead className="text-xs font-semibold">Description</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Debit</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Credit</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Balance</TableHead>
                    <TableHead className="text-xs font-semibold">Mode</TableHead>
                    <TableHead className="text-xs font-semibold">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row, idx) => (
                    <TableRow key={idx}
                      className={`text-xs cursor-pointer border-b border-slate-100 transition-colors ${
                        row.status === 'VOID' ? 'opacity-50' : 'hover:bg-slate-50'
                      }`}
                      onClick={() => setSelectedRow(row)}
                    >
                      <TableCell className="text-slate-600 whitespace-nowrap">
                        {row.date ? moment(row.date).format('DD MMM YY') : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] ${TYPE_STYLES[row.type] || 'bg-slate-100 text-slate-500'}`}>
                          {row.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-[10px] text-slate-400">{row.refNo || '—'}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-slate-700">{row.description}</TableCell>
                      <TableCell className={`text-right font-medium ${row.debit > 0 ? 'text-red-600' : 'text-slate-300'}`}>
                        {row.debit > 0 ? `₹${fmt(row.debit)}` : '—'}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${row.credit > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>
                        {row.credit > 0 ? `₹${fmt(row.credit)}` : '—'}
                      </TableCell>
                      <TableCell className={`text-right font-bold ${row.runningBalance > 0 ? 'text-slate-800' : 'text-emerald-600'}`}>
                        ₹{fmt(row.runningBalance)}
                      </TableCell>
                      <TableCell className="text-slate-500">{row.mode || '—'}</TableCell>
                      <TableCell>
                        {row.status === 'VOID' ? (
                          <Badge className="text-[10px] bg-slate-200 text-slate-500 line-through">VOID</Badge>
                        ) : row.type === 'REVERSAL' ? (
                          <Badge className="text-[10px] bg-red-100 text-red-700">Reversal</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-slate-500">Posted</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Closing balance row */}
                  <TableRow className="bg-slate-50 font-semibold text-xs">
                    <TableCell colSpan={6} className="text-right text-slate-600">Closing Balance</TableCell>
                    <TableCell className="text-right font-bold text-slate-900">₹{fmt(data?.closingBalance)}</TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="text-center py-16 text-slate-400">
          <Search className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Search for a student above to view their ledger</p>
        </div>
      )}

      {/* Row detail drawer */}
      <LedgerRowDrawer
        row={selectedRow}
        invoices={invoicesCache}
        onClose={() => setSelectedRow(null)}
      />
    </div>
  );
}

export default function StudentLedgerReport() {
  return (
    <LoginRequired allowedRoles={['admin', 'principal', 'accountant']} pageName="Student Ledger Report">
      <StudentLedgerContent />
    </LoginRequired>
  );
}