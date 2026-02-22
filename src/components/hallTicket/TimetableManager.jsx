import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAcademicYear } from '@/components/AcademicYearContext';
import { format, parse } from 'date-fns';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

export default function TimetableManager() {
  const { academicYear } = useAcademicYear();
  const [showForm, setShowForm] = useState(false);
  const [filterClass, setFilterClass] = useState('');
  const [filterExamType, setFilterExamType] = useState('');
  const [formData, setFormData] = useState({ exam_type: '', selected_classes: [], subject_name: '', exam_date: '', start_time: '', end_time: '', room_number: '' });
  const queryClient = useQueryClient();

  const { data: examTypes = [] } = useQuery({
    queryKey: ['examTypes', academicYear],
    queryFn: () => base44.entities.ExamType.filter({ academic_year: academicYear })
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => base44.entities.Subject.list()
  });

  const { data: timetable = [] } = useQuery({
    queryKey: ['timetable', academicYear],
    queryFn: () => base44.entities.ExamTimetable.filter({ academic_year: academicYear }, 'exam_date')
  });

  // Filter subjects by selected classes (show union of subjects for all selected classes)
  const filteredSubjects = formData.selected_classes.length > 0
    ? subjects.filter(s => !s.classes || s.classes.length === 0 || s.classes.some(c => formData.selected_classes.includes(c)))
    : subjects;

  const toggleClass = (cls) => {
    setFormData(prev => {
      const already = prev.selected_classes.includes(cls);
      return {
        ...prev,
        selected_classes: already ? prev.selected_classes.filter(c => c !== cls) : [...prev.selected_classes, cls],
        subject_name: ''
      };
    });
  };

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const date = parse(data.exam_date, 'yyyy-MM-dd', new Date());
      const day = DAYS[date.getDay()];
      // Create one entry per selected class
      await Promise.all(data.selected_classes.map(cls =>
        base44.entities.ExamTimetable.create({
          exam_type: data.exam_type,
          class_name: cls,
          subject_name: data.subject_name,
          exam_date: data.exam_date,
          start_time: data.start_time,
          end_time: data.end_time,
          room_number: data.room_number,
          day,
          academic_year: academicYear
        })
      ));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable'] });
      setShowForm(false);
      setFormData({ exam_type: '', selected_classes: [], subject_name: '', exam_date: '', start_time: '', end_time: '', room_number: '' });
      toast.success('Timetable entries added');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ExamTimetable.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable'] });
      toast.success('Entry deleted');
    }
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.exam_type || !formData.class_name || !formData.subject_name || !formData.exam_date || !formData.start_time || !formData.end_time) {
      toast.error('Please fill all required fields');
      return;
    }
    createMutation.mutate(formData);
  };

  // Filter displayed timetable
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
          <Button onClick={() => setShowForm(!showForm)} className="gap-2">
            <Plus className="w-4 h-4" /> Add Entry
          </Button>
        </CardHeader>
        <CardContent>
          {showForm && (
            <form onSubmit={handleSubmit} className="mb-6 p-4 bg-slate-50 rounded-lg space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={formData.exam_type}
                  onChange={(e) => setFormData({ ...formData, exam_type: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                >
                  <option value="">Select Exam Type</option>
                  {examTypes.map(type => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>

                <select
                  value={formData.class_name}
                  onChange={(e) => setFormData({ ...formData, class_name: e.target.value, subject_name: '' })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                >
                  <option value="">Select Class</option>
                  {CLASSES.map(c => <option key={c} value={c}>Class {c}</option>)}
                </select>
              </div>

              <select
                value={formData.subject_name}
                onChange={(e) => setFormData({ ...formData, subject_name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                required
                disabled={!formData.class_name}
              >
                <option value="">{formData.class_name ? 'Select Subject' : 'Select class first'}</option>
                {filteredSubjects.map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>

              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="date"
                  value={formData.exam_date}
                  onChange={(e) => setFormData({ ...formData, exam_date: e.target.value })}
                  required
                />
                {formData.exam_date && (
                  <div className="px-3 py-2 bg-white border rounded-lg text-sm">
                    {format(parse(formData.exam_date, 'yyyy-MM-dd', new Date()), 'EEEE')}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                  required
                />
                <Input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                  required
                />
              </div>

              <Input
                type="text"
                placeholder="Room Number (optional)"
                value={formData.room_number}
                onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
              />

              <div className="flex gap-2">
                <Button type="submit" className="bg-blue-600">Add</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          )}

          {/* Filters */}
          <div className="flex gap-2 mb-3">
            <select
              value={filterClass}
              onChange={e => setFilterClass(e.target.value)}
              className="px-3 py-1.5 border rounded-lg text-sm"
            >
              <option value="">All Classes</option>
              {CLASSES.map(c => <option key={c} value={c}>Class {c}</option>)}
            </select>
            <select
              value={filterExamType}
              onChange={e => setFilterExamType(e.target.value)}
              className="px-3 py-1.5 border rounded-lg text-sm"
            >
              <option value="">All Exam Types</option>
              {examTypes.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100">
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
                  <tr key={entry.id} className="border-b hover:bg-slate-50">
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
                  <tr><td colSpan={8} className="p-4 text-center text-slate-400">No entries found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}