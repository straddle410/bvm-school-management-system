import React, { useState, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import LoginRequired from '@/components/LoginRequired';
import PageHeader from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Download, ChevronDown, ChevronRight, Search } from 'lucide-react';
import DayBookDetailDrawer from '@/components/fees/DayBookDetailDrawer';
import { useAcademicYear } from '@/components/AcademicYearContext';

const PAYMENT_MODES = ['Cash', 'Cheque', 'Online', 'DD', 'UPI'];
const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const defaultDateFrom = () => {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  return d.toISOString().split('T')[0];
};
const today = () => new Date().toISOString().split('T')[0];

function SummaryCard({ label, value, color = 'slate' }) {
  const colors = {
    green: 'bg-green-50 border-green-200 text-green-700',
    red:   'bg-red-50 border-red-200 text-red-700',
    blue:  'bg-blue-50 border-blue-200 text-blue-800',
    slate: 'bg-slate-50 border-slate-200 text-slate-700',
  };
  return (
    <div className={`rounded-xl border px-4 py-3 ${colors[color]}`}>
      <div className="text-xs font-medium opacity-70 mb-1">{label}</div>
      <div className="text-xl font-bold tabular-nums">₹{fmt(value)}</div>
    </div>
  );
}

function DayRow({ day, filters, onDrillDown }) {
  const [expanded, setExpanded] = useState(false);
  const hasNegative = day.grossReversed > 0;

  return (
    <>
      <tr
        className="hover:bg-blue-50 cursor-pointer transition-colors border-b border-slate-100"
        onClick={() => setExpanded(v => !v)}
      >
        <td className="px-4 py-3 font-medium text-slate-800 flex items-center gap-2">
          {expanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
          {day.date}
        </td>
        <td className="px-4 py-3 text-right text-green-700 font-semibold tabular-nums">₹{fmt(day.grossCollected)}</td>
        <td className="px-4 py-3 text-right tabular-nums">
          {hasNegative ? <span className="text-red-500 font-semibold">−₹{fmt(day.grossReversed)}</span> : <span className="text-slate-300">—</span>}
        </td>
        <td className="px-4 py-3 text-right text-slate-800 font-bold tabular-nums">₹{fmt(day.netCollected)}</td>
        <td className="px-4 py-3 text-right">
          <button
            onClick={e => { e.stopPropagation(); onDrillDown(day.date); }}
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            View receipts
          </button>
        </td>
      </tr>

      {expanded && day.byMode?.map((m, i) => (
        <tr key={i} className="bg-slate-50 border-b border-slate-100 text-sm">
          <td className="pl-12 pr-4 py-2 text-slate-600">
            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-medium">{m.mode}</span>
            <span className="ml-2 text-slate-400 text-xs">{m.count} receipt{m.count !== 1 ? 's' : ''}</span>
          </td>
          <td className="px-4 py-2 text-right text-green-600 tabular-nums">₹{fmt(m.grossCollected)}</td>
          <td className="px-4 py-2 text-right tabular-nums">
            {m.grossReversed > 0 ? <span className="text-red-400">−₹{fmt(m.grossReversed)}</span> : <span className="text-slate-300">—</span>}
          </td>
          <td className="px-4 py-2 text-right text-slate-700 font-semibold tabular-nums">₹{fmt(m.netCollected)}</td>
          <td className="px-4 py-2 text-right">
            <button
              onClick={() => onDrillDown(day.date, m.mode)}
              className="text-xs text-blue-600 hover:text-blue-800 underline"
            >
              Details
            </button>
          </td>
        </tr>
      ))}
    </>
  );
}

export default function DayBookReport() {
  const { academicYear } = useAcademicYear();

  const [dateFrom, setDateFrom] = useState(defaultDateFrom());
  const [dateTo, setDateTo] = useState(today());
  const [selectedModes, setSelectedModes] = useState([]);
  const [className, setClassName] = useState('');
  const [includeVoided, setIncludeVoided] = useState(false);

  // Applied filters state (only update on Apply)
  const [applied, setApplied] = useState({
    dateFrom: defaultDateFrom(),
    dateTo: today(),
    academicYear,
    className: '',
    mode: [],
    includeVoided: false
  });

  const [drawerDate, setDrawerDate] = useState(null);
  const [drawerMode, setDrawerMode] = useState(null);
  const [exporting, setExporting] = useState(false);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['daybook', applied],
    queryFn: () => base44.functions.invoke('getDayBookReport', {
      reportMode: 'summary',
      dateFrom: applied.dateFrom,
      dateTo: applied.dateTo,
      academicYear: applied.academicYear || undefined,
      className: applied.className || undefined,
      mode: applied.mode?.length ? applied.mode : undefined,
      includeVoided: applied.includeVoided
    }).then(r => r.data),
    enabled: !!applied.dateFrom && !!applied.dateTo,
    staleTime: 0
  });

  const handleApply = () => {
    setApplied({
      dateFrom, dateTo, academicYear,
      className,
      mode: selectedModes,
      includeReversals,
      includeCancelled
    });
  };

  const handleDrillDown = (date, mode) => {
    setDrawerDate(date);
    setDrawerMode(mode || null);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await base44.functions.invoke('getDayBookReport', {
        reportMode: 'export',
        dateFrom: applied.dateFrom,
        dateTo: applied.dateTo,
        academicYear: applied.academicYear || undefined,
        className: applied.className || undefined,
        mode: applied.mode?.length ? applied.mode : undefined,
        includeReversals: applied.includeReversals,
        includeCancelled: applied.includeCancelled,
        exportCsv: true
      });
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `day-book-${applied.dateFrom}-to-${applied.dateTo}.csv`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      a.remove();
    } finally {
      setExporting(false);
    }
  };

  const toggleMode = (m) => {
    setSelectedModes(prev =>
      prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
    );
  };

  const summary = data?.summary;
  const days = data?.days || [];

  const drawerFilters = {
    ...applied,
    mode: drawerMode ? [drawerMode] : applied.mode
  };

  return (
    <LoginRequired allowedRoles={['admin', 'principal', 'accountant']} pageName="Day Book Report">
      <div className="min-h-screen bg-slate-50">
        <PageHeader
          title="Day Book Report"
          subtitle="Daily fee collections grouped by date and payment mode"
          actions={
            <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
              Export CSV
            </Button>
          }
        />

        <div className="p-4 lg:p-6 space-y-4">
          {/* Filters */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs text-slate-500 mb-1 block">From Date</Label>
                  <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9 text-sm" />
                </div>
                <div>
                  <Label className="text-xs text-slate-500 mb-1 block">To Date</Label>
                  <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9 text-sm" />
                </div>
                <div>
                  <Label className="text-xs text-slate-500 mb-1 block">Class (optional)</Label>
                  <Select value={className || '__all__'} onValueChange={v => setClassName(v === '__all__' ? '' : v)}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="All Classes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All Classes</SelectItem>
                      {CLASSES.map(c => <SelectItem key={c} value={c}>Class {c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button className="h-9 w-full bg-[#1a237e] hover:bg-[#283593]" onClick={handleApply}>
                    <Search className="h-4 w-4 mr-1" /> Apply
                  </Button>
                </div>
              </div>

              {/* Mode chips + toggles */}
              <div className="flex flex-wrap gap-3 items-center">
                <span className="text-xs text-slate-500 font-medium">Modes:</span>
                {PAYMENT_MODES.map(m => (
                  <button
                    key={m}
                    onClick={() => toggleMode(m)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      selectedModes.includes(m)
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'
                    }`}
                  >
                    {m}
                  </button>
                ))}
                <div className="ml-auto flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch checked={includeReversals} onCheckedChange={setIncludeReversals} id="inc-rev" />
                    <Label htmlFor="inc-rev" className="text-xs text-slate-600 cursor-pointer">Include Reversals</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={includeCancelled} onCheckedChange={setIncludeCancelled} id="inc-can" />
                    <Label htmlFor="inc-can" className="text-xs text-slate-600 cursor-pointer">Include Cancelled</Label>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Summary cards */}
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <SummaryCard label="Gross Collected" value={summary.grossCollected} color="green" />
              <SummaryCard label="Gross Reversed" value={summary.grossReversed} color="red" />
              <SummaryCard label="Net Collected" value={summary.netCollected} color="blue" />
            </div>
          )}

          {/* By-mode summary pills */}
          {summary?.byMode?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {summary.byMode.map(m => (
                <div key={m.mode} className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs shadow-sm">
                  <span className="font-semibold text-slate-700">{m.mode}</span>
                  <span className="mx-1 text-slate-400">·</span>
                  <span className="text-green-600">₹{fmt(m.netCollected)}</span>
                  <span className="text-slate-400 ml-1">({m.count})</span>
                </div>
              ))}
            </div>
          )}

          {/* Main table */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              {isLoading || isFetching ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : days.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-sm">
                  No collections found for the selected date range.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-100 text-slate-500 text-xs uppercase tracking-wide">
                        <th className="px-4 py-3 text-left">Date</th>
                        <th className="px-4 py-3 text-right">Gross Collected</th>
                        <th className="px-4 py-3 text-right">Reversed</th>
                        <th className="px-4 py-3 text-right">Net</th>
                        <th className="px-4 py-3 text-right">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {days.map(day => (
                        <DayRow
                          key={day.date}
                          day={day}
                          filters={applied}
                          onDrillDown={handleDrillDown}
                        />
                      ))}
                    </tbody>
                    {/* Footer totals */}
                    {summary && (
                      <tfoot>
                        <tr className="bg-slate-100 font-bold text-sm border-t-2 border-slate-300">
                          <td className="px-4 py-3 text-slate-700">Total</td>
                          <td className="px-4 py-3 text-right text-green-700 tabular-nums">₹{fmt(summary.grossCollected)}</td>
                          <td className="px-4 py-3 text-right text-red-500 tabular-nums">
                            {summary.grossReversed > 0 ? `−₹${fmt(summary.grossReversed)}` : '—'}
                          </td>
                          <td className="px-4 py-3 text-right text-slate-800 tabular-nums">₹{fmt(summary.netCollected)}</td>
                          <td />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <DayBookDetailDrawer
        open={!!drawerDate}
        onClose={() => { setDrawerDate(null); setDrawerMode(null); }}
        date={drawerDate}
        filters={drawerFilters}
      />
    </LoginRequired>
  );
}