import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAcademicYear } from '@/components/AcademicYearContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Save, Info } from 'lucide-react';
import { getClassesForYear } from '@/components/classSectionHelper';

const normalizeClassName = (cls) => {
  if (!cls) return '';
  const input = cls.toString().trim().toLowerCase();
  if (input === 'nursery') return 'Nursery';
  if (input === 'lkg') return 'LKG';
  if (input === 'ukg') return 'UKG';
  const stripped = input.replace(/^class\s*/, '').trim();
  const num = parseInt(stripped, 10);
  if (!isNaN(num) && num >= 1 && num <= 12) return String(num);
  return cls.toString().trim();
};

export default function ExamMarksConfigTab() {
  const { academicYear } = useAcademicYear();
  const queryClient = useQueryClient();
  const [availableClasses, setAvailableClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedExamTypeId, setSelectedExamTypeId] = useState('');
  const [form, setForm] = useState({ has_internal_marks: false, max_internal_marks: 0, max_external_marks: 100 });

  useEffect(() => {
    if (!academicYear) return;
    getClassesForYear(academicYear).then(r => {
      const classes = r?.classes || [];
      setAvailableClasses(classes);
      if (classes.length > 0) setSelectedClass(classes[0]);
    });
  }, [academicYear]);

  const { data: examTypes = [] } = useQuery({
    queryKey: ['examTypes', academicYear],
    queryFn: () => base44.entities.ExamType.filter({ academic_year: academicYear, is_active: true }),
    enabled: !!academicYear
  });

  const { data: existingConfig, refetch } = useQuery({
    queryKey: ['examMarksConfig', academicYear, selectedClass, selectedExamTypeId],
    queryFn: async () => {
      const results = await base44.entities.ExamMarksConfig.filter({
        academic_year: academicYear,
        class_name: normalizeClassName(selectedClass),
        exam_type_id: selectedExamTypeId
      });
      return results[0] || null;
    },
    enabled: !!academicYear && !!selectedClass && !!selectedExamTypeId
  });

  // Sync form with loaded config
  useEffect(() => {
    if (existingConfig) {
      setForm({
        has_internal_marks: existingConfig.has_internal_marks || false,
        max_internal_marks: existingConfig.max_internal_marks || 0,
        max_external_marks: existingConfig.max_external_marks || 100
      });
    } else if (selectedClass && selectedExamTypeId) {
      setForm({ has_internal_marks: false, max_internal_marks: 0, max_external_marks: 100 });
    }
  }, [existingConfig, selectedClass, selectedExamTypeId]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const selectedExam = examTypes.find(e => e.id === selectedExamTypeId);
      const data = {
        academic_year: academicYear,
        class_name: normalizeClassName(selectedClass),
        exam_type_id: selectedExamTypeId,
        exam_type_name: selectedExam?.name || '',
        has_internal_marks: form.has_internal_marks,
        max_internal_marks: form.has_internal_marks ? (parseFloat(form.max_internal_marks) || 0) : 0,
        max_external_marks: parseFloat(form.max_external_marks) || 100
      };
      if (existingConfig?.id) {
        return base44.entities.ExamMarksConfig.update(existingConfig.id, data);
      }
      return base44.entities.ExamMarksConfig.create(data);
    },
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries(['examMarksConfig']);
      toast.success('Configuration saved');
    },
    onError: () => toast.error('Failed to save configuration')
  });

  const totalMax = (form.has_internal_marks ? (parseFloat(form.max_internal_marks) || 0) : 0) + (parseFloat(form.max_external_marks) || 0);

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle>Exam Marks Configuration</CardTitle>
        <CardDescription>
          Configure whether each class and exam type uses internal + external marks or total marks only.
          This drives the progress card layout automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Class selector */}
        <div>
          <Label className="text-sm font-medium mb-2 block">Select Class</Label>
          <div className="flex flex-wrap gap-2">
            {availableClasses.map(cls => (
              <button
                key={cls}
                onClick={() => setSelectedClass(cls)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  selectedClass === cls
                    ? 'bg-[#1a237e] text-white border-[#1a237e]'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-[#1a237e]'
                }`}
              >
                Class {cls}
              </button>
            ))}
          </div>
        </div>

        {/* Exam type selector */}
        <div className="max-w-sm">
          <Label className="text-sm font-medium mb-2 block">Select Exam Type</Label>
          <Select value={selectedExamTypeId} onValueChange={setSelectedExamTypeId}>
            <SelectTrigger>
              <SelectValue placeholder="Choose an exam type..." />
            </SelectTrigger>
            <SelectContent>
              {examTypes.map(e => (
                <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedClass && selectedExamTypeId && (
          <div className="border rounded-xl p-5 space-y-5 bg-slate-50">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-slate-600">
                Configuring for <strong>Class {selectedClass}</strong> and <strong>{examTypes.find(e => e.id === selectedExamTypeId)?.name}</strong>.
                {existingConfig ? ' (Updating existing config)' : ' (New configuration)'}
              </p>
            </div>

            {/* Has internal marks toggle */}
            <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
              <div>
                <p className="text-sm font-medium text-slate-800">Internal + External Marks</p>
                <p className="text-xs text-slate-500 mt-0.5">Enable if this exam has separate internal and external marks</p>
              </div>
              <Switch
                checked={form.has_internal_marks}
                onCheckedChange={(v) => setForm(f => ({ ...f, has_internal_marks: v }))}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {form.has_internal_marks && (
                <div>
                  <Label>Max Internal Marks</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.max_internal_marks}
                    onChange={e => setForm(f => ({ ...f, max_internal_marks: e.target.value }))}
                    className="mt-1"
                  />
                </div>
              )}
              <div>
                <Label>{form.has_internal_marks ? 'Max External Marks' : 'Max Total Marks'}</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.max_external_marks}
                  onChange={e => setForm(f => ({ ...f, max_external_marks: e.target.value }))}
                  className="mt-1"
                />
              </div>
              {form.has_internal_marks && (
                <div>
                  <Label className="text-slate-500">Total Max Marks</Label>
                  <div className="mt-1 h-10 flex items-center px-3 border rounded-md bg-white text-sm font-semibold text-slate-700">
                    {totalMax}
                  </div>
                </div>
              )}
            </div>

            {/* Preview of progress card columns */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Progress Card Preview</p>
              <div className="border rounded overflow-hidden text-xs">
                <table className="w-full">
                  <thead className="bg-slate-200">
                    <tr>
                      <th className="px-2 py-1 text-left">S.No</th>
                      <th className="px-2 py-1 text-left">Subject</th>
                      {form.has_internal_marks && <th className="px-2 py-1 text-center">Internal ({form.max_internal_marks || 0})</th>}
                      {form.has_internal_marks && <th className="px-2 py-1 text-center">External ({form.max_external_marks || 0})</th>}
                      <th className="px-2 py-1 text-center">{form.has_internal_marks ? `Total (${totalMax})` : `Marks (${form.max_external_marks || 0})`}</th>
                      <th className="px-2 py-1 text-center">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="bg-white">
                      <td className="px-2 py-1 text-center">1</td>
                      <td className="px-2 py-1 font-medium">Mathematics</td>
                      {form.has_internal_marks && <td className="px-2 py-1 text-center text-slate-400">—</td>}
                      {form.has_internal_marks && <td className="px-2 py-1 text-center text-slate-400">—</td>}
                      <td className="px-2 py-1 text-center text-slate-400">—</td>
                      <td className="px-2 py-1 text-center text-slate-400">—</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="bg-[#1a237e] hover:bg-[#283593] gap-2">
              <Save className="h-4 w-4" />
              {saveMutation.isPending ? 'Saving...' : 'Save Configuration'}
            </Button>
          </div>
        )}

        {!selectedExamTypeId && (
          <div className="text-center py-8 text-slate-400 text-sm">
            Select a class and exam type to configure marks structure
          </div>
        )}
      </CardContent>
    </Card>
  );
}