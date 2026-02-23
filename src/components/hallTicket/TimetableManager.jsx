import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, PlusCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAcademicYear } from '@/components/AcademicYearContext';
import { format, parse } from 'date-fns';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

const emptyRow = () => ({ subject_name: '', exam_date: '', start_time: '', end_time: '', room_number: '' });

export default function TimetableManager() {
  const { academicYear } = useAcademicYear();
  const [showForm, setShowForm] = useState(false);
  const [filterClass, setFilterClass] = useState('');
  const [filterExamType, setFilterExamType] = useState('');
  const [examType, setExamType] = useState('');
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [rows, setRows] = useState([emptyRow()]);
  const [selectedEntries, setSelectedEntries] = useState([]);
  const queryClient = useQueryClient();

  const { data: examTypes = [] } = useQuery({
    queryKey: ['examTypes', academicYear],
    queryFn: () => base44.entities.ExamType.filter({ academic_year: academicYear, is_active: true })
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => base44.entities.Subject.list()
  });

  const { data: timetable = [] } = useQuery({
    queryKey: ['timetable', academicYear],
    queryFn: () => base44.entities.ExamTimetable.filter({ academic_year: academicYear }, 'exam_date')
  });

  // Filter subjects by selected classes
  const filteredSubjects = selectedClasses.length > 0
    ? subjects.filter(s => !s.classes || s.classes.length === 0 || s.classes.some(c => selectedClasses.includes(c)))
    : subjects;

  const toggleClass = (cls) => {
    setSelectedClasses(prev =>
      prev.includes(cls) ? prev.filter(c => c !== cls) : [...prev, cls]
    );
    setRows([emptyRow()]);
  };

  const updateRow = (idx, field, value) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const addRow = () => {
    const firstRow = rows[0] || emptyRow();
    setRows(prev => [...prev, { ...emptyRow(), start_time: firstRow.start_time, end_time: firstRow.end_time }]);
  };

  const removeRow = (idx) => setRows(prev => prev.filter((_, i) => i !== idx));

  const createMutation = useMutation({
    mutationFn: async ({ examType, selectedClasses, rows }) => {
      const entries = [];
      for (const row of rows) {
        const date = parse(row.exam_date, 'yyyy-MM-dd', new Date());
        const day = DAYS[date.getDay()];
        for (const cls of selectedClasses) {
          entries.push({
            exam_type: examType,
            class_name: cls,
            subject_name: row.subject_name,
            exam_date: row.exam_date,
            start_time: row.start_time,
            end_time: row.end_time,
            room_number: row.room_number || '',
            day,
            academic_year: academicYear
          });
        }
      }
      await Promise.all(entries.map(e => base44.entities.ExamTimetable.create(e)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable'] });
      setShowForm(false);
      setExamType('');
      setSelectedClasses([]);
      setRows([emptyRow()]);
      toast.success('Timetable entries saved');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ExamTimetable.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable'] });
      setSelectedEntries([]);
      toast.success('Entry deleted');
    }
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: () => Promise.all(selectedEntries.map(id => base44.entities.ExamTimetable.delete(id))),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable'] });
      setSelectedEntries([]);
      toast.success('Selected entries deleted');
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!examType) { toast.error('Select an exam type'); return; }
    if (selectedClasses.length === 0) { toast.error('Select at least one class'); return; }
    for (const row of rows) {
      if (!row.subject_name || !row.exam_date || !row.start_time || !row.end_time) {
        toast.error('Fill all required fields in every row');
        return;
      }
    }
    createMutation.mutate({ examType, selectedClasses, rows });
  };

  const displayedTimetable = timetable.filter(entry => {
    if (filterClass && entry.class_name !== filterClass) return false;
    if (filterExamType && entry.exam_type !== filterExamType) return false;
    return true;
  });

  const getExamTypeName = (id) => examTypes.find(e => e.id === id)?.name || id;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row justify-between items-center">
          <CardTitle>Exam Timetable</CardTitle>
          <Button onClick={() => { setShowForm(!showForm); setRows([emptyRow()]); setSelectedClasses([]); setExamType(''); }} className="gap-2">
            <Plus className="w-4 h-4" /> Add Entries
          </Button>
        </CardHeader>
        <CardContent>
          {showForm && (
            <form onSubmit={handleSubmit} className="mb-6 p-4 bg-slate-50 rounded-xl border space-y-4">
              {/* Step 1: Exam Type */}
              <div>
                <p className="text-xs font-semibold text-slate-600 mb-1">Exam Type <span className="text-red-500">*</span></p>
                <select
                   value={examType}
                   onChange={(e) => setExamType(e.target.value)}
                   className="w-full px-3 py-2 border rounded-lg text-sm"
                   required
                 >
                   <option value="">{examTypes.length === 0 ? 'No exam types available' : 'Select Exam Type'}</option>
                   {examTypes.map(type => (
                      <option key={type.id} value={type.id}>{type.name}</option>
                    ))}
                 </select>
              </div>

              {/* Step 2: Multi-class selector */}
              <div>
                <p className="text-xs font-semibold text-slate-600 mb-1">Classes <span className="text-red-500">*</span></p>
                <div className="flex flex-wrap gap-2">
                  {CLASSES.map(c => (
                    <button
                      type="button"
                      key={c}
                      onClick={() => toggleClass(c)}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${selectedClasses.includes(c) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300 hover:border-blue-400'}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                {selectedClasses.length > 0 && (
                  <p className="text-xs text-blue-600 mt-1">Selected: {selectedClasses.join(', ')}</p>
                )}
              </div>

              {/* Step 3: Shared exam time */}
              <div>
                <p className="text-xs font-semibold text-slate-600 mb-1">Exam Time <span className="text-red-500">*</span> <span className="text-slate-400 font-normal">(applies to all subjects below)</span></p>
                <div className="flex gap-3 items-center bg-white p-3 rounded-lg border">
                  <div className="flex-1">
                    <label className="text-xs text-slate-500 block mb-1">Start Time</label>
                    <input
                      type="time"
                      value={rows[0]?.start_time || ''}
                      onChange={(e) => setRows(prev => prev.map(r => ({ ...r, start_time: e.target.value })))}
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-white text-slate-800 font-medium"
                      required
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-slate-500 block mb-1">End Time</label>
                    <input
                      type="time"
                      value={rows[0]?.end_time || ''}
                      onChange={(e) => setRows(prev => prev.map(r => ({ ...r, end_time: e.target.value })))}
                      className="w-full px-3 py-2 border rounded-lg text-sm bg-white text-slate-800 font-medium"
                      required
                    />
                  </div>
                  {rows[0]?.start_time && rows[0]?.end_time && (
                    <div className="text-sm text-blue-700 font-semibold whitespace-nowrap pt-4">
                      {rows[0].start_time} – {rows[0].end_time}
                    </div>
                  )}
                </div>
              </div>

              {/* Step 4: Subject rows */}
              <div>
                <p className="text-xs font-semibold text-slate-600 mb-2">Subject Schedule <span className="text-red-500">*</span></p>
                <div className="space-y-2">
                  {rows.map((row, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded-lg border">
                      {/* Subject */}
                      <div className="col-span-5">
                        <select
                          value={row.subject_name}
                          onChange={(e) => updateRow(idx, 'subject_name', e.target.value)}
                          className="w-full px-2 py-1.5 border rounded-lg text-sm"
                          required
                          disabled={selectedClasses.length === 0}
                        >
                          <option value="">{selectedClasses.length > 0 ? 'Select Subject' : 'Select class first'}</option>
                          {filteredSubjects.map(s => (
                            <option key={s.id} value={s.name}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                      {/* Date */}
                      <div className="col-span-4">
                        <input
                          type="date"
                          value={row.exam_date}
                          onChange={(e) => updateRow(idx, 'exam_date', e.target.value)}
                          className="w-full px-2 py-1.5 border rounded-lg text-sm"
                          required
                        />
                      </div>
                      {/* Day auto-display */}
                      <div className="col-span-2 text-xs text-slate-500 text-center">
                        {row.exam_date ? format(parse(row.exam_date, 'yyyy-MM-dd', new Date()), 'EEE') : '—'}
                      </div>
                      {/* Remove */}
                      <div className="col-span-1 flex justify-end">
                        {rows.length > 1 && (
                          <button type="button" onClick={() => removeRow(idx)} className="text-red-400 hover:text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={addRow}
                  className="mt-2 flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  <PlusCircle className="w-4 h-4" /> Add another subject
                </button>
              </div>

              <div className="flex gap-2 pt-1">
                <Button type="submit" className="bg-blue-600" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Saving...' : `Save ${rows.length * selectedClasses.length || ''} Entries`}
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          )}

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-2 mb-3 items-start sm:items-center">
            <div className="flex gap-2 flex-1">
              <select value={filterClass} onChange={e => setFilterClass(e.target.value)} className="px-3 py-1.5 border rounded-lg text-sm flex-1 sm:flex-none">
                <option value="">All Classes</option>
                {CLASSES.map(c => <option key={c} value={c}>Class {c}</option>)}
              </select>
              <select value={filterExamType} onChange={e => setFilterExamType(e.target.value)} className="px-3 py-1.5 border rounded-lg text-sm flex-1 sm:flex-none">
                <option value="">All Exam Types</option>
                {examTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
              </select>
            </div>
            {selectedEntries.length > 0 && (
              <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-2 items-start sm:items-center">
                <span className="text-sm text-slate-600">{selectedEntries.length} selected</span>
                <Button 
                  size="sm" 
                  variant="destructive" 
                  onClick={() => bulkDeleteMutation.mutate()}
                  disabled={bulkDeleteMutation.isPending}
                  className="w-full sm:w-auto"
                >
                  <Trash2 className="w-4 h-4 mr-1" />
                  Delete Selected
                </Button>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="p-2 text-left w-8">
                    <input 
                      type="checkbox" 
                      checked={selectedEntries.length === displayedTimetable.length && displayedTimetable.length > 0}
                      onChange={(e) => setSelectedEntries(e.target.checked ? displayedTimetable.map(t => t.id) : [])}
                      className="w-4 h-4 cursor-pointer"
                    />
                  </th>
                  <th className="p-2 text-left">Class</th>
                  <th className="p-2 text-left">Subject</th>
                  <th className="p-2 text-left">Exam Type</th>
                  <th className="p-2 text-left">Date</th>
                  <th className="p-2 text-left">Day</th>
                  <th className="p-2 text-left">Time</th>
                  <th className="p-2 text-left">Room</th>
                  <th className="p-2 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {displayedTimetable.map(entry => (
                  <tr key={entry.id} className={`border-b hover:bg-slate-50 ${selectedEntries.includes(entry.id) ? 'bg-blue-50' : ''}`}>
                    <td className="p-2 w-8">
                      <input 
                        type="checkbox" 
                        checked={selectedEntries.includes(entry.id)}
                        onChange={(e) => setSelectedEntries(e.target.checked ? [...selectedEntries, entry.id] : selectedEntries.filter(id => id !== entry.id))}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </td>
                    <td className="p-2 font-medium">{entry.class_name}</td>
                    <td className="p-2">{entry.subject_name}</td>
                    <td className="p-2 text-xs text-slate-500">{getExamTypeName(entry.exam_type)}</td>
                    <td className="p-2">{entry.exam_date ? format(parse(entry.exam_date, 'yyyy-MM-dd', new Date()), 'dd MMM yyyy') : '-'}</td>
                    <td className="p-2">{entry.day}</td>
                    <td className="p-2">{entry.start_time} - {entry.end_time}</td>
                    <td className="p-2">{entry.room_number || '-'}</td>
                    <td className="p-2">
                      <Button size="icon" variant="ghost" className="text-red-600" onClick={() => deleteMutation.mutate(entry.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
                {displayedTimetable.length === 0 && (
                  <tr><td colSpan={9} className="p-4 text-center text-slate-400">No entries found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}