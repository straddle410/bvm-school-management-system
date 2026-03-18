import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import LoginRequired from '@/components/LoginRequired';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, Search, FileText, ChevronRight, User, CreditCard } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { useAcademicYear } from '@/components/AcademicYearContext';
import LedgerRowDrawer from '@/components/fees/LedgerRowDrawer';
import moment from 'moment';

const CLASS_OPTIONS = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

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

  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('A');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [includeReversals, setIncludeReversals] = useState(true);
  const [includeCredits, setIncludeCredits] = useState(true);
  const [includeVoided, setIncludeVoided] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [invoicesCache, setInvoicesCache] = useState([]);
  const [showInvoicesList, setShowInvoicesList] = useState(!selectedStudent);

  // Fetch invoices for the selected student
  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ['student-invoices', selectedStudent?.student_id, academicYear],
    queryFn: () => base44.entities.FeeInvoice.filter({
      student_id: selectedStudent.student_id,
      academic_year: academicYear,
      invoice_type: 'ANNUAL'
    }),
    enabled: !!selectedStudent && !!academicYear,
    staleTime: 30000
  });

  const handlePayClick = (invoice) => {
    navigate(`${createPageUrl('Fees')}?tab=ledger&student_id=${selectedStudent.student_id}&className=${selectedStudent.class_name}`);
  };

  // Fetch sections for selected class from SectionConfig
  const { data: sectionConfig = [] } = useQuery({
    queryKey: ['section-config', academicYear],
    queryFn: () => base44.entities.SectionConfig.filter({ academic_year: academicYear }),
    staleTime: 60000
  });

  const availableSections = useMemo(() => {
    if (!selectedClass) return ['A'];
    const cfg = sectionConfig.find(s => s.class_name === selectedClass);
    return cfg?.sections?.length ? cfg.sections : ['A'];
  }, [sectionConfig, selectedClass]);

  // Students for selected class + section
  const { data: classStudents = [], isFetching: loadingStudents } = useQuery({
    queryKey: ['class-students', academicYear, selectedClass, selectedSection],
    queryFn: () => base44.entities.Student.filter({
    academic_year: academicYear,
    class_name: selectedClass,
    section: selectedSection,
    status: 'Published',
    is_deleted: false,
    is_active: true
    }),
    enabled: !!selectedClass && !!selectedSection,
    staleTime: 30000
  });

  const sortedStudents = useMemo(() =>
    [...classStudents].sort((a, b) => (a.roll_no || 999) - (b.roll_no || 999) || a.name.localeCompare(b.name)),
    [classStudents]
  );

  // Reset student when class/section changes
  useEffect(() => { setSelectedStudent(null); }, [selectedClass, selectedSection]);

  // Ledger data
   const { data, isLoading, error: fetchError } = useQuery({
     queryKey: ['student-ledger', selectedStudent?.student_id, academicYear, dateFrom, dateTo, includeReversals, includeCredits, includeVoided],
     queryFn: async () => {
       // Force fresh data by never caching
       const ts = Date.now();
       const _bust = ts;
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
        enabled: !!selectedStudent,
        staleTime: 0,
        gcTime: 0
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
        exportCsv: true,
        pageSize: 9999,
        staffInfo
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
    <div className="p-4 space-y-5 dark:bg-gray-900 min-h-screen">
    {/* Header */}
    <div className="flex items-start justify-between gap-3 flex-wrap">
     <div>
       <h1 className="text-xl font-bold text-slate-900 dark:text-white">Student Ledger Report</h1>
       <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">Chronological fee ledger with running balance</p>
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

      {/* Step 1: Class & Section Selector */}
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-4 pb-4">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Step 1 — Select Class &amp; Section</p>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="w-40">
              <Label className="text-sm font-medium">Class</Label>
              <Select value={selectedClass} onValueChange={v => { setSelectedClass(v); setSelectedSection('A'); }}>
                <SelectTrigger className="mt-1 h-11 text-base">
                  <SelectValue placeholder="Select Class" />
                </SelectTrigger>
                <SelectContent>
                  {CLASS_OPTIONS.map(c => (
                    <SelectItem key={c} value={c} className="text-base py-2">{c === 'Nursery' || c === 'LKG' || c === 'UKG' ? c : `Class ${c}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-32">
              <Label className="text-sm font-medium">Section</Label>
              <Select value={selectedSection} onValueChange={setSelectedSection} disabled={!selectedClass}>
                <SelectTrigger className="mt-1 h-11 text-base">
                  <SelectValue placeholder="Section" />
                </SelectTrigger>
                <SelectContent>
                  {availableSections.map(s => (
                    <SelectItem key={s} value={s} className="text-base py-2">Section {s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedClass && (
              <div className="flex items-end pb-0.5">
                <span className="text-sm text-slate-500 ml-1">
                  {loadingStudents ? 'Loading…' : `${sortedStudents.length} student${sortedStudents.length !== 1 ? 's' : ''} found`}
                </span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Step 2: Student List */}
      {selectedClass && !selectedStudent && (
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4 pb-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Step 2 — Select Student</p>
            {loadingStudents ? (
              <div className="text-center py-8 text-slate-400">Loading students…</div>
            ) : sortedStudents.length === 0 ? (
              <div className="text-center py-8 text-slate-400">No students found for {selectedClass}-{selectedSection}</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {sortedStudents.map(s => (
                  <button key={s.id} onClick={() => setSelectedStudent(s)}
                    className="w-full flex items-center gap-3 px-2 py-3 hover:bg-blue-50 rounded-lg transition-colors text-left group">
                    <div className="h-10 w-10 rounded-full bg-[#e8eaf6] flex items-center justify-center flex-shrink-0">
                      <User className="h-5 w-5 text-[#3949ab]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 text-base truncate">{s.name}</p>
                      <p className="text-xs text-slate-400">ID: {s.student_id || '—'} {s.roll_no ? `· Roll No: ${s.roll_no}` : ''}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-300 group-hover:text-[#3949ab] flex-shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Filters (shown only after student selected) */}
      {selectedStudent && (
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-3 pb-3">
            <div className="flex flex-wrap gap-3 items-end">
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
              <div className="pt-5">
                <Button variant="outline" size="sm" onClick={() => setSelectedStudent(null)} className="text-slate-500">
                  ← Change Student
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Student info strip */}
      {selectedStudent && (
        <div className="bg-[#e8eaf6] dark:bg-gray-800 rounded-xl px-4 py-3 flex flex-wrap gap-4 items-center text-sm">
          <div>
            <span className="text-[11px] text-[#3949ab] font-semibold uppercase tracking-wide">Student</span>
            <p className="font-bold text-[#1a237e]">{selectedStudent.name}</p>
          </div>
          <div>
            <span className="text-[11px] text-slate-500 dark:text-gray-400 uppercase tracking-wide">ID</span>
            <p className="font-mono text-slate-700 dark:text-gray-300">{selectedStudent.student_id}</p>
            </div>
            <div>
            <span className="text-[11px] text-slate-500 dark:text-gray-400 uppercase tracking-wide">Class</span>
            <p className="text-slate-700 dark:text-gray-300">Class {selectedStudent.class_name}-{selectedStudent.section}</p>
            </div>
            {selectedStudent.parent_phone && (
            <div>
             <span className="text-[11px] text-slate-500 dark:text-gray-400 uppercase tracking-wide">Phone</span>
             <p className="text-slate-700 dark:text-gray-300">{selectedStudent.parent_phone}</p>
            </div>
          )}
        </div>
      )}

      {/* Invoices List (when student selected) */}
      {selectedStudent && !showInvoicesList === false && (
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardContent className="p-0 overflow-x-auto">
            {invoicesLoading ? (
              <div className="text-center py-12 text-slate-400 dark:text-gray-500">Loading invoices…</div>
            ) : invoices.length === 0 ? (
              <div className="text-center py-12 text-slate-400 dark:text-gray-500">No invoices found for this student.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-gray-700">
                    <TableHead className="text-xs font-semibold">Installment</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Gross</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Discount</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Net</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Paid</TableHead>
                    <TableHead className="text-xs font-semibold text-right">Balance</TableHead>
                    <TableHead className="text-xs font-semibold">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((invoice) => {
                    const grossAmt = invoice.gross_total || invoice.total_amount || 0;
                    const discountAmt = invoice.discount_total || 0;
                    const netAmt = invoice.total_amount || grossAmt - discountAmt;
                    const paidAmt = invoice.paid_amount || 0;
                    const balanceAmt = invoice.balance || Math.max(netAmt - paidAmt, 0);
                    
                    return (
                      <TableRow key={invoice.id} className="text-xs hover:bg-slate-50 dark:hover:bg-gray-700 transition-colors border-b border-slate-100 dark:border-gray-700">
                        <TableCell className="text-slate-700 dark:text-gray-300 font-medium">{invoice.installment_name}</TableCell>
                        <TableCell className="text-right font-mono text-slate-700 dark:text-gray-300">₹{fmt(grossAmt)}</TableCell>
                        <TableCell className="text-right font-mono text-emerald-600">{discountAmt > 0 ? `−₹${fmt(discountAmt)}` : '—'}</TableCell>
                        <TableCell className="text-right font-mono font-semibold text-slate-900 dark:text-white">₹{fmt(netAmt)}</TableCell>
                        <TableCell className="text-right font-mono text-blue-600 font-semibold">₹{fmt(paidAmt)}</TableCell>
                        <TableCell className={`text-right font-mono font-bold ${balanceAmt > 0 ? 'text-red-600' : 'text-emerald-600'}`}>₹{fmt(balanceAmt)}</TableCell>
                        <TableCell>
                          {balanceAmt > 0 && (
                            <Button
                              size="sm"
                              className="gap-1 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold min-h-[32px]"
                              onClick={() => handlePayClick(invoice)}
                            >
                              <CreditCard className="h-3 w-3" />
                              Pay
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      {selectedStudent && data && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-3 pb-3">
              <p className="text-[11px] text-slate-500 dark:text-gray-400">Opening Balance</p>
              <p className="text-lg font-bold text-slate-700 dark:text-gray-200 mt-0.5">₹{fmt(data.openingBalance)}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-3 pb-3">
              <p className="text-[11px] text-slate-500 dark:text-gray-400">Total Invoiced</p>
              <p className="text-lg font-bold text-blue-700 mt-0.5">₹{fmt(summary.totalInvoiced)}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="pt-3 pb-3">
              <p className="text-[11px] text-slate-500 dark:text-gray-400">Total Paid</p>
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
              <p className="text-[11px] text-slate-500 dark:text-gray-400">Entries</p>
              <p className="text-lg font-bold text-slate-700 dark:text-gray-200 mt-0.5">{data.meta?.totalRows ?? 0}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Ledger Table */}
      {selectedStudent ? (
        <Card className="border-0 shadow-sm overflow-hidden">
          <CardContent className="p-0 overflow-x-auto">
            {isLoading ? (
              <div className="text-center py-12 text-slate-400 dark:text-gray-500">Loading ledger…</div>
              ) : rows.length === 0 ? (
              <div className="text-center py-12 text-slate-400 dark:text-gray-500">No ledger entries found for this student.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-gray-700">
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
                      className={`text-xs cursor-pointer border-b border-slate-100 dark:border-gray-700 transition-colors ${
                       row.status === 'VOID' ? 'opacity-50' : 'hover:bg-slate-50 dark:hover:bg-gray-700'
                      }`}
                      onClick={() => setSelectedRow(row)}
                    >
                      <TableCell className="text-slate-600 dark:text-gray-400 whitespace-nowrap">
                        {row.date ? moment(row.date).format('DD MMM YY') : '—'}
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] ${TYPE_STYLES[row.type] || 'bg-slate-100 text-slate-500'}`}>
                          {row.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-[10px] text-slate-400 dark:text-gray-500">{row.refNo || '—'}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-slate-700 dark:text-gray-300">{row.description}</TableCell>
                      <TableCell className={`text-right font-medium ${row.debit > 0 ? 'text-red-600' : 'text-slate-300'}`}>
                        {row.debit > 0 ? `₹${fmt(row.debit)}` : '—'}
                      </TableCell>
                      <TableCell className={`text-right font-medium ${row.credit > 0 ? 'text-emerald-600' : 'text-slate-300'}`}>
                        {row.credit > 0 ? `₹${fmt(row.credit)}` : '—'}
                      </TableCell>
                      <TableCell className={`text-right font-bold ${row.runningBalance > 0 ? 'text-slate-800' : 'text-emerald-600'}`}>
                        ₹{fmt(row.runningBalance)}
                      </TableCell>
                      <TableCell className="text-slate-500 dark:text-gray-400">{row.mode || '—'}</TableCell>
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
                  <TableRow className="bg-slate-50 dark:bg-gray-700 font-semibold text-xs">
                   <TableCell colSpan={6} className="text-right text-slate-600 dark:text-gray-400">Closing Balance</TableCell>
                   <TableCell className="text-right font-bold text-slate-900 dark:text-white">₹{fmt(data?.closingBalance)}</TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="text-center py-16 text-slate-400 dark:text-gray-500">
          <User className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-base">Select a class and student above to view their ledger</p>
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