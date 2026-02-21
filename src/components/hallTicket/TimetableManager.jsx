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

export default function TimetableManager() {
  const { academicYear } = useAcademicYear();
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ exam_type: '', subject_name: '', exam_date: '', start_time: '', end_time: '', room_number: '' });
  const queryClient = useQueryClient();

  const { data: examTypes = [] } = useQuery({
    queryKey: ['examTypes', academicYear],
    queryFn: () => base44.entities.ExamType.filter({ academic_year: academicYear })
  });

  const { data: timetable = [] } = useQuery({
    queryKey: ['timetable', academicYear],
    queryFn: () => base44.entities.ExamTimetable.filter({ academic_year: academicYear }, '-exam_date')
  });

  const createMutation = useMutation({
    mutationFn: (data) => {
      const date = parse(data.exam_date, 'yyyy-MM-dd', new Date());
      const day = DAYS[date.getDay()];
      return base44.entities.ExamTimetable.create({ 
        ...data, 
        day, 
        academic_year: academicYear 
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable'] });
      setShowForm(false);
      setFormData({ exam_type: '', subject_name: '', exam_date: '', start_time: '', end_time: '', room_number: '' });
      toast.success('Timetable entry added');
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
    if (!formData.exam_type || !formData.subject_name || !formData.exam_date || !formData.start_time || !formData.end_time) {
      toast.error('Please fill all required fields');
      return;
    }
    createMutation.mutate(formData);
  };

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

              <Input
                type="text"
                placeholder="Subject Name"
                value={formData.subject_name}
                onChange={(e) => setFormData({ ...formData, subject_name: e.target.value })}
                required
              />

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

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="p-2 text-left">Subject</th>
                  <th className="p-2 text-left">Date</th>
                  <th className="p-2 text-left">Day</th>
                  <th className="p-2 text-left">Time</th>
                  <th className="p-2 text-left">Room</th>
                  <th className="p-2 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {timetable.map(entry => (
                  <tr key={entry.id} className="border-b hover:bg-slate-50">
                    <td className="p-2">{entry.subject_name}</td>
                    <td className="p-2">{format(parse(entry.exam_date, 'yyyy-MM-dd', new Date()), 'dd MMM yyyy')}</td>
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
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}