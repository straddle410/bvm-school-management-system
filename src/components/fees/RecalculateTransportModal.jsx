import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, Bus, Loader2, CheckCircle2, XCircle, RefreshCw, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';

const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

const ACTION_LABELS = {
  EDIT_INVOICE_ADD_TRANSPORT:    { label: 'Add transport line to invoice', color: 'bg-blue-100 text-blue-800' },
  EDIT_INVOICE_REMOVE_TRANSPORT: { label: 'Remove transport line from invoice', color: 'bg-orange-100 text-orange-800' },
  CREATE_DEBIT_ADJUSTMENT:       { label: 'Create debit adjustment (locked)', color: 'bg-yellow-100 text-yellow-800' },
  CREATE_CREDIT_ADJUSTMENT:      { label: 'Create credit adjustment (locked)', color: 'bg-purple-100 text-purple-800' },
  NO_CHANGE:                     { label: 'No change needed', color: 'bg-slate-100 text-slate-600' },
  SKIP:                          { label: 'Skip', color: 'bg-red-100 text-red-700' },
};

export default function RecalculateTransportModal({ open, onClose, academicYear, academicYears = [] }) {
  const [step, setStep] = useState('select'); // select | preview | confirm | done
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedYear, setSelectedYear] = useState(academicYear || '');
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [preview, setPreview] = useState([]);
  const [confirmPhrase, setConfirmPhrase] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const requiredPhrase = `RECALC TRANSPORT ${selectedYear}`;

  useEffect(() => {
    if (open) { setStep('select'); setSelectedClass(''); setSelectedStudentIds([]); setPreview([]); setConfirmPhrase(''); setResults([]); }
  }, [open]);

  useEffect(() => { setSelectedStudentIds([]); }, [selectedClass, selectedYear]);

  const { data: students = [], isFetching: loadingStudents } = useQuery({
    queryKey: ['transport-students', selectedClass, selectedYear],
    queryFn: () => base44.entities.Student.filter({ class_name: selectedClass, academic_year: selectedYear, status: 'Published', is_deleted: false }),
    enabled: !!selectedClass && !!selectedYear
  });

  const { data: schoolProfile } = useQuery({
    queryKey: ['school-profile-transport'],
    queryFn: () => base44.entities.SchoolProfile.list().then(r => r[0] || null)
  });

  const transportFeeAmount = schoolProfile?.transport_fee_amount || 0;

  const toggleAll = () => {
    if (selectedStudentIds.length === students.length) setSelectedStudentIds([]);
    else setSelectedStudentIds(students.map(s => s.student_id));
  };

  const toggleStudent = (sid) => {
    setSelectedStudentIds(prev =>
      prev.includes(sid) ? prev.filter(x => x !== sid) : [...prev, sid]
    );
  };

  const runPreview = async () => {
    if (!selectedStudentIds.length) return;
    setLoading(true);
    try {
      const res = await base44.functions.invoke('recalculateTransportFee', {
        studentIds: selectedStudentIds,
        academicYear: selectedYear,
        previewOnly: true
      });
      setPreview(res.data?.results || []);
      setStep('preview');
    } catch (e) {
      toast.error(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  const runExecution = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('recalculateTransportFee', {
        studentIds: selectedStudentIds,
        academicYear: selectedYear,
        previewOnly: false
      });
      setResults(res.data?.results || []);
      setStep('done');
      const s = res.data?.summary;
      toast.success(`Done: ${s?.done || 0} updated, ${s?.no_change || 0} unchanged, ${s?.skipped || 0} skipped`);
    } catch (e) {
      toast.error(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  const actionChanges = preview.filter(r => r.action && r.action !== 'NO_CHANGE' && r.status !== 'SKIP');
  const noChangeCount = preview.filter(r => r.status === 'NO_CHANGE').length;
  const skipCount = preview.filter(r => r.status === 'SKIP').length;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bus className="h-5 w-5 text-amber-600" />
            Recalculate Transport Fee
          </DialogTitle>
        </DialogHeader>

        {/* STEP: SELECT */}
        {step === 'select' && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2 text-sm text-amber-800">
              <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <div>
                Syncs existing annual invoices with each student's current <strong>transport_enabled</strong> flag.
                Transport fee rate: <strong>₹{transportFeeAmount.toLocaleString()}</strong> (from School Profile).
                <br />
                <strong>Locked invoices</strong> (have payments) → adjustment entry. <strong>Unlocked</strong> → invoice edited directly.
              </div>
            </div>

            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Academic Year</label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger><SelectValue placeholder="Select Year" /></SelectTrigger>
                  <SelectContent>
                    {academicYears.filter(y => y.status !== 'Archived').map(y =>
                      <SelectItem key={y.year} value={y.year}>{y.year}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Class</label>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger><SelectValue placeholder="Select Class" /></SelectTrigger>
                  <SelectContent>{CLASSES.map(c => <SelectItem key={c} value={c}>Class {c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {selectedClass && selectedYear && (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-slate-50 px-3 py-2 flex items-center justify-between border-b">
                  <span className="text-xs font-semibold text-slate-600">
                    {loadingStudents ? 'Loading...' : `${students.length} students in Class ${selectedClass}`}
                  </span>
                  <Button variant="ghost" size="sm" onClick={toggleAll} className="text-xs h-7">
                    {selectedStudentIds.length === students.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
                <div className="max-h-64 overflow-y-auto divide-y">
                  {students.map(s => (
                    <label key={s.student_id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                      <Checkbox
                        checked={selectedStudentIds.includes(s.student_id)}
                        onCheckedChange={() => toggleStudent(s.student_id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{s.name}</p>
                        <p className="text-xs text-slate-400">{s.student_id}</p>
                      </div>
                      <Badge className={s.transport_enabled ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'}>
                        <Bus className="h-3 w-3 mr-1" />
                        {s.transport_enabled ? 'Transport ON' : 'Transport OFF'}
                      </Badge>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button
                onClick={runPreview}
                disabled={selectedStudentIds.length === 0 || loading}
                className="bg-amber-600 hover:bg-amber-700"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Preview Changes ({selectedStudentIds.length} students)
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* STEP: PREVIEW */}
        {step === 'preview' && (
          <div className="space-y-4">
            <div className="flex gap-4 text-sm">
              <span className="text-blue-700 font-semibold">{actionChanges.length} will change</span>
              <span className="text-slate-500">{noChangeCount} no change</span>
              {skipCount > 0 && <span className="text-red-600">{skipCount} skipped</span>}
            </div>

            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                  <tr>
                    <th className="text-left px-3 py-2">Student</th>
                    <th className="text-center px-2 py-2">Transport</th>
                    <th className="text-right px-2 py-2">Old Total</th>
                    <th className="text-right px-2 py-2">New Total</th>
                    <th className="text-left px-2 py-2">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {preview.map((r, i) => {
                    const ac = ACTION_LABELS[r.action || r.status] || ACTION_LABELS.NO_CHANGE;
                    return (
                      <tr key={i} className={r.status === 'SKIP' ? 'opacity-50' : ''}>
                        <td className="px-3 py-2">
                          <p className="font-medium">{r.student_name}</p>
                          <p className="text-xs text-slate-400">{r.student_id}</p>
                        </td>
                        <td className="px-2 py-2 text-center">
                          <Badge className={r.transport_enabled ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'}>
                            {r.transport_enabled ? 'ON' : 'OFF'}
                          </Badge>
                        </td>
                        <td className="px-2 py-2 text-right font-mono text-slate-600">₹{(r.old_total || 0).toLocaleString()}</td>
                        <td className={`px-2 py-2 text-right font-mono font-semibold ${r.delta > 0 ? 'text-red-700' : r.delta < 0 ? 'text-green-700' : 'text-slate-500'}`}>
                          {r.status === 'SKIP' ? '—' : `₹${(r.new_total || r.old_total || 0).toLocaleString()}`}
                        </td>
                        <td className="px-2 py-2">
                          {r.status === 'SKIP'
                            ? <span className="text-xs text-red-600">{r.reason}</span>
                            : <span className={`text-xs px-2 py-0.5 rounded-full ${ac.color}`}>{ac.label}</span>
                          }
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {actionChanges.length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-600 uppercase">Confirm by typing:</label>
                <code className="block bg-slate-100 px-3 py-1.5 rounded text-sm text-slate-700">{requiredPhrase}</code>
                <Input
                  value={confirmPhrase}
                  onChange={e => setConfirmPhrase(e.target.value)}
                  placeholder={`Type: ${requiredPhrase}`}
                  className={confirmPhrase === requiredPhrase ? 'border-green-400' : ''}
                />
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('select')}>← Back</Button>
              {actionChanges.length === 0 ? (
                <Button onClick={onClose}>Close (Nothing to do)</Button>
              ) : (
                <Button
                  onClick={runExecution}
                  disabled={confirmPhrase !== requiredPhrase || loading}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <AlertTriangle className="h-4 w-4 mr-2" />}
                  Apply {actionChanges.length} Changes
                </Button>
              )}
            </DialogFooter>
          </div>
        )}

        {/* STEP: DONE */}
        {step === 'done' && (
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              {results.map((r, i) => (
                <div key={i} className={`flex items-start gap-2 p-3 rounded-lg text-sm border ${
                  r.status === 'DONE' ? 'bg-green-50 border-green-200' :
                  r.status === 'NO_CHANGE' ? 'bg-slate-50 border-slate-200' :
                  'bg-red-50 border-red-200'
                }`}>
                  {r.status === 'DONE'
                    ? <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                    : r.status === 'ERROR'
                    ? <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                    : <Info className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
                  }
                  <div className="flex-1">
                    <span className="font-medium">{r.student_name}</span>
                    {r.status === 'DONE' && (
                      <span className="text-slate-600 ml-1">
                        — {r.method === 'ADJUSTMENT' ? 'Adjustment created' : 'Invoice edited'} · ₹{(r.old_total || 0).toLocaleString()} → ₹{(r.new_total || 0).toLocaleString()}
                      </span>
                    )}
                    {r.status === 'NO_CHANGE' && <span className="text-slate-500 ml-1">— No change needed</span>}
                    {r.status === 'SKIP' && <span className="text-red-600 ml-1">— {r.reason}</span>}
                    {r.status === 'ERROR' && <span className="text-red-600 ml-1">— {r.error}</span>}
                  </div>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button onClick={onClose}>Close</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}