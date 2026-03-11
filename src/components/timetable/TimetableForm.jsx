import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { getSubjectsForClass } from '@/components/subjectHelper';
import { getClassesForYear, getSectionsForClass } from '@/components/classSectionHelper';
import { X } from 'lucide-react';
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const TIME_SLOTS = [];
const STATIC_SECTIONS = ['A', 'B', 'C', 'D']; // fallback only
for (let h = 8; h < 16; h++) {
  for (let m = 0; m < 60; m += 5) {
    TIME_SLOTS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
}

export default function TimetableForm({ entry, onSubmit, onCancel, academicYear }) {
  const [availableClasses, setAvailableClasses] = useState([]);
  const [availableSections, setAvailableSections] = useState([]);
  const [selectedDays, setSelectedDays] = useState(entry ? [entry.day] : []);
  const [formData, setFormData] = useState(entry || {
    class_name: '',
    section: '',
    day: 'Monday',
    start_time: '09:00',
    end_time: '10:00',
    subject: '',
    teacher_name: '',
    teacher_id: '',
    room_number: '',
    academic_year: academicYear,
    status: 'Draft',
    notes: ''
  });

  useEffect(() => {
    if (!academicYear) return;
    getClassesForYear(academicYear).then((result) => {
      setAvailableClasses(Array.isArray(result) ? result : (result?.classes ?? []));
    });
  }, [academicYear]);

  useEffect(() => {
    if (!formData.class_name || !academicYear) { setAvailableSections([]); return; }
    getSectionsForClass(academicYear, formData.class_name).then((result) => {
      const secs = Array.isArray(result) ? result : (result?.sections ?? []);
      setAvailableSections(secs);
      if (secs.length === 1) setFormData(f => ({ ...f, section: secs[0] }));
      else if (formData.section && !secs.includes(formData.section)) setFormData(f => ({ ...f, section: '' }));
    });
  }, [formData.class_name, academicYear]);

  const { data: subjects = [] } = useQuery({
    queryKey: ['class-subjects', academicYear, formData.class_name],
    queryFn: async () => {
      if (!formData.class_name) {
        return [];
      }
      console.log('[SUBJECT_FETCH]', {
        module: 'Timetable',
        year: academicYear,
        classRaw: formData.class_name,
      });
      const result = await getSubjectsForClass(academicYear, formData.class_name);
      console.log('[TIMETABLE_FORM_RESULT]', { source: result.source, subjects: result.subjects });
      return result.subjects;
    },
    enabled: !!academicYear
  });

  const { data: teachers = [] } = useQuery({
    queryKey: ['staff-teachers'],
    queryFn: async () => {
      const staffList = await base44.entities.StaffAccount.filter(
        { is_teacher: true, is_active: true },
        'name'
      );
      return staffList;
    }
  });

  const handleTeacherChange = (e) => {
    const staffId = e.target.value;
    const staff = teachers.find(t => t.id === staffId);
    setFormData({
      ...formData,
      teacher_id: staffId,
      teacher_name: staff?.name || ''
    });
  };

  const handleDayToggle = (day) => {
    if (entry) {
      // Editing: keep single day behavior
      setFormData({ ...formData, day });
      setSelectedDays([day]);
    } else {
      // Creating: allow multi-select
      setSelectedDays(prev =>
        prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
      );
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const daysToApply = entry ? [formData.day] : (selectedDays.length > 0 ? selectedDays : [formData.day]);
    onSubmit(formData, daysToApply);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{entry ? 'Edit Timetable Entry' : 'Add Timetable Entry'}</CardTitle>
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Class</label>
              <select
                value={formData.class_name}
                onChange={(e) => setFormData({ ...formData, class_name: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                required
              >
                <option value="">Select Class</option>
                {availableClasses.map(cls => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Section</label>
              <select
                value={formData.section}
                onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                required
              >
                <option value="">Select Section</option>
                {(availableSections.length > 0 ? availableSections : STATIC_SECTIONS).map(sec => (
                  <option key={sec} value={sec}>{sec}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="block text-sm font-medium mb-2">
                {entry ? 'Day' : 'Select Days (Multi-select)'}
              </label>
              {entry ? (
                <select
                  value={formData.day}
                  onChange={(e) => setFormData({ ...formData, day: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                  required
                >
                  {DAYS.map(day => (
                    <option key={day} value={day}>{day}</option>
                  ))}
                </select>
              ) : (
                <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                  {DAYS.map(day => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => handleDayToggle(day)}
                      className={`px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                        selectedDays.includes(day)
                          ? 'bg-blue-600 text-white border border-blue-600'
                          : 'bg-white text-gray-700 border border-gray-300 hover:border-blue-400'
                      }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
              )}
              {!entry && selectedDays.length === 0 && (
                <p className="text-xs text-red-500 mt-1">Select at least one day</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Start Time</label>
              <select
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                required
              >
                {TIME_SLOTS.map(time => (
                  <option key={time} value={time}>{time}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">End Time</label>
              <select
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                required
              >
                {TIME_SLOTS.map(time => (
                  <option key={time} value={time}>{time}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Room Number</label>
              <input
                type="text"
                placeholder="e.g., 101, A1"
                value={formData.room_number}
                onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Subject</label>
              <select
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                required
              >
                <option value="">Select Subject</option>
                {subjects.map(sub => (
                  <option key={sub} value={sub}>{sub}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Teacher</label>
              <select
                value={formData.teacher_id}
                onChange={handleTeacherChange}
                className="w-full px-3 py-2 border rounded-lg"
                required
              >
                <option value="">Select Teacher</option>
                {teachers.map(teacher => (
                  <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Status</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="Draft">Draft</option>
                <option value="Published">Published</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Notes</label>
            <textarea
              placeholder="Additional notes or special instructions"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg min-h-20"
            />
          </div>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
              {entry ? 'Update' : 'Add'} Entry
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}