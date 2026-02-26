import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useAcademicYear } from '@/components/AcademicYearContext';
import { getStaffSession } from '@/components/useStaffSession';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import DiaryList from '@/components/diary/DiaryList';

export default function Diary() {
  const { academicYear } = useAcademicYear();
  const [user, setUser] = useState(null);
  const [userStudent, setUserStudent] = useState(null);
  const [filters, setFilters] = useState({ class: '', subject: '' });
  const [selectedDate, setSelectedDate] = useState(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const session = getStaffSession();
    setUser(session);
    if (!session) {
      try {
        const studentData = JSON.parse(localStorage.getItem('student_session'));
        if (studentData) {
          setUserStudent(studentData);
          markDiaryNotificationsAsRead(studentData.student_id);
        }
      } catch (e) {}
    }
  }, []);

  const markDiaryNotificationsAsRead = async (studentId) => {
    try {
      const unread = await base44.entities.Notification.filter({
        recipient_student_id: studentId,
        type: 'diary_published',
        is_read: false
      });
      await Promise.all(unread.map(n => base44.entities.Notification.update(n.id, { is_read: true })));
    } catch {}
  };

  const { data: diaries = [] } = useQuery({
    queryKey: ['diaries', academicYear],
    queryFn: () => base44.entities.Diary.filter({
      academic_year: academicYear,
      status: 'Published'
    }),
  });

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects'],
    queryFn: async () => {
      const subs = await base44.entities.Subject.list();
      return subs.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    }
  });

  // For students: auto-select the latest diary_date on first load
  useEffect(() => {
    if (!initialized && userStudent && diaries.length > 0) {
      const studentDiaries = diaries
        .filter(d => d.class_name === userStudent.class_name && d.section === userStudent.section)
        .sort((a, b) => new Date(b.diary_date || b.created_date) - new Date(a.diary_date || a.created_date));
      if (studentDiaries.length > 0 && studentDiaries[0].diary_date) {
        setSelectedDate(new Date(studentDiaries[0].diary_date + 'T00:00:00'));
      }
      setInitialized(true);
    }
  }, [diaries, userStudent, initialized]);

  // Filter by role
  let visibleDiaries = diaries;
  if (userStudent && !user) {
    visibleDiaries = diaries.filter(d =>
      d.class_name === userStudent.class_name && d.section === userStudent.section
    );
  }

  // Apply staff filters
  if (filters.class) visibleDiaries = visibleDiaries.filter(d => d.class_name === filters.class);
  if (filters.subject) visibleDiaries = visibleDiaries.filter(d => d.subject === filters.subject);

  // Apply date filter (for students: always active; for staff: optional)
  if (selectedDate) {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    visibleDiaries = visibleDiaries.filter(d => d.diary_date === dateStr);
  }

  const uniqueClasses = [...new Set(diaries.map(d => d.class_name))].sort();
  const uniqueSubjects = [...new Set(diaries.map(d => d.subject))].sort();

  const sortedEntries = [...visibleDiaries].sort(
    (a, b) => new Date(b.diary_date || b.created_date) - new Date(a.diary_date || a.created_date)
  );

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <PageHeader
        title="Class Diary"
        subtitle={userStudent ? `View activities for Class ${userStudent.class_name}` : 'View class activities and assignments'}
      />

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Filters — only for staff/admin */}
        {!userStudent && (
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Class</label>
                  <Select value={filters.class} onValueChange={(val) => setFilters({ ...filters, class: val })}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Classes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>All Classes</SelectItem>
                      {uniqueClasses.map(cls => (
                        <SelectItem key={cls} value={cls}>Class {cls}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Subject</label>
                  <Select value={filters.subject} onValueChange={(val) => setFilters({ ...filters, subject: val })}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Subjects" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>All Subjects</SelectItem>
                      {uniqueSubjects.map(sub => (
                        <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Date</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <Calendar className="mr-2 h-4 w-4" />
                        {selectedDate ? format(selectedDate, 'MMM d, yyyy') : 'Select date'}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        disabled={(date) => date > new Date()}
                      />
                    </PopoverContent>
                  </Popover>
                  {selectedDate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedDate(null)}
                      className="mt-2 text-xs w-full"
                    >
                      Clear Date Filter
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* For students: date picker to browse previous diaries */}
        {userStudent && (
          <div className="flex items-center gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="justify-start text-left font-normal">
                  <Calendar className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, 'MMMM d, yyyy') : 'Select date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => date > new Date()}
                />
              </PopoverContent>
            </Popover>
            {selectedDate && (
              <span className="text-sm text-gray-500">
                Showing diary for {format(selectedDate, 'MMM d, yyyy')}
              </span>
            )}
          </div>
        )}

        <DiaryList
          entries={sortedEntries}
          canEdit={false}
        />
      </div>
    </div>
  );
}