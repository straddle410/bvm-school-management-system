import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowUpDown, Save, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
const SECTIONS = ['A', 'B', 'C', 'D'];

export default function ManageRollNumbers({ open, onClose, academicYear }) {
  const [step, setStep] = useState(1); // 1=select class, 2=edit rolls
  const [filterClass, setFilterClass] = useState('');
  const [filterSection, setFilterSection] = useState('A');
  const [filterYear, setFilterYear] = useState(academicYear || '');
  const [students, setStudents] = useState([]);
  const [rolls, setRolls] = useState({}); // { id: roll_no }
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleLoad = async () => {
    if (!filterClass || !filterSection || !filterYear) {
      toast.error('Please select class, section and academic year');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await base44.functions.invoke('getNextRollNo', {
        action: 'list',
        class_name: filterClass,
        section: filterSection,
        academic_year: filterYear
      });
      const list = (res.data.students || []).filter(s => s.is_active !== false);
      setStudents(list);
      const rollMap = {};
      list.forEach(s => { rollMap[s.id] = s.roll_no || ''; });
      setRolls(rollMap);
      setStep(2);
    } catch (err) {
      toast.error(err.message || 'Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const handleRollChange = (id, val) => {
    setRolls(prev => ({ ...prev, [id]: val === '' ? '' : parseInt(val) || '' }));
  };

  const handleAutoResequence = () => {
    if (!window.confirm('This will reassign roll numbers 1, 2, 3… based on current order. Continue?')) return;
    const newRolls = {};
    students.forEach((s, idx) => { newRolls[s.id] = idx + 1; });
    setRolls(newRolls);
    toast.success('Roll numbers resequenced. Click Save to apply.');
  };

  const handleSave = async () => {
    setError('');
    // Client-side duplicate check first
    const seen = new Map();
    for (const s of students) {
      const roll = parseInt(rolls[s.id]);
      if (!roll || roll < 1) {
        setError(`Roll number for "${s.name}" must be a positive number`);
        return;
      }
      if (seen.has(roll)) {
        setError(`Duplicate roll number: ${roll} — assigned to more than one student`);
        return;
      }
      seen.set(roll, s.id);
    }

    setSaving(true);
    try {
      const updates = students.map(s => ({ id: s.id, roll_no: parseInt(rolls[s.id]) }));
      const res = await base44.functions.invoke('getNextRollNo', {
        action: 'save_rolls',
        class_name: filterClass,
        section: filterSection,
        academic_year: filterYear,
        updates
      });
      if (res.data.success) {
        toast.success(`Roll numbers saved for ${res.data.updated} students`);
        onClose();
        resetState();
      } else {
        setError(res.data.error || 'Save failed');
      }
    } catch (err) {
      // Surface the exact server error message (axios puts it in err.response.data.error)
      const serverMsg = err?.response?.data?.error || err?.message || 'Save failed';
      setError(serverMsg);
    } finally {
      setSaving(false);
    }
  };

  const resetState = () => {
    setStep(1);
    setStudents([]);
    setRolls({});
    setError('');
    setFilterClass('');
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle>Manage Roll Numbers</DialogTitle>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Select class to view and edit roll numbers.</p>
            <p className="text-xs text-orange-600 bg-orange-50 px-3 py-2 rounded-lg border border-orange-200 mb-2">Only active students are shown. Archived students are excluded from roll number management.</p>
                 <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label className="text-xs">Class *</Label>
                      <Select value={filterClass} onValueChange={setFilterClass}>
                        <SelectTrigger className="mt-1 rounded-xl"><SelectValue placeholder="Class" /></SelectTrigger>
                        <SelectContent>{CLASSES.map(c => <SelectItem key={c} value={c}>Class {c}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
              <div>
                <Label className="text-xs">Section *</Label>
                <Select value={filterSection} onValueChange={setFilterSection}>
                  <SelectTrigger className="mt-1 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>{SECTIONS.map(s => <SelectItem key={s} value={s}>Section {s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Year *</Label>
                <Input value={filterYear} onChange={e => setFilterYear(e.target.value)} placeholder="2024-25" className="mt-1 rounded-xl" />
              </div>
            </div>
            <Button onClick={handleLoad} disabled={loading} className="w-full bg-[#1a237e] hover:bg-[#283593] rounded-xl">
              {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Loading...</> : 'Load Students'}
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-700">Class {filterClass}-{filterSection} · {filterYear}</p>
                <p className="text-xs text-gray-400">{students.length} students</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleAutoResequence} className="rounded-xl">
                <ArrowUpDown className="h-3.5 w-3.5 mr-1" /> Auto Reorder
              </Button>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
                <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {students.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No students found for this class.</p>
            ) : (
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs text-gray-500 font-medium">Name</th>
                      <th className="text-left px-3 py-2 text-xs text-gray-500 font-medium w-24">Roll No</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {students.map(s => (
                      <tr key={s.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2">
                          <p className="font-medium text-gray-800">{s.name}</p>
                          <p className="text-xs text-gray-400">{s.student_id}</p>
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            min="1"
                            value={rolls[s.id] || ''}
                            onChange={e => handleRollChange(s.id, e.target.value)}
                            className="h-8 rounded-lg text-center font-semibold"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="rounded-xl flex-1">Back</Button>
              {students.length > 0 && (
                <Button onClick={handleSave} disabled={saving} className="bg-[#1a237e] hover:bg-[#283593] rounded-xl flex-1">
                  {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</> : <><Save className="h-4 w-4 mr-1" />Save Roll Numbers</>}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}