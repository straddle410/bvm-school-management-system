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

const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

export default function Diary() {
  const { academicYear } = useAcademicYear();
  const [user, setUser] = useState(null);
  const [userStudent, setUserStudent] = useState(null);
  const [filters, setFilters] = useState({ class: '', subject: '' });
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    const session = getStaffSession();
    setUser(session);
    
    if (!session) {
      // Try to get student from local storage (student session)
      try {
        const studentData = JSON.parse(localStorage.getItem('student_session'));
        if (studentData) {
          setUserStudent(studentData);
          // Mark diary notifications as read
          markDiaryNotificationsAsRead(studentData.student_id);
        }
      } catch (e) {
        console.error('Failed to parse student session:', e);
      }
    }
  }, []);

  const markDiaryNotificationsAsRead = async (studentId) => {
    try {
      const unreadNotifications = await base44.entities.Notification.filter({
        recipient_student_id: studentId,
        type: 'diary_published',
        is_read: false
      });
      
      for (const notif of unreadNotifications) {
        await base44.entities.Notification.update(notif.id, { is_read: true });
      }
    } catch (error) {
      console.debug('Error marking notifications as read:', error);
    }
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

  // Filter based on user role
  let visibleDiaries = diaries;

  if (userStudent && !user) {
    // Student - see only their class entries
    visibleDiaries = diaries.filter(d => 
      d.class_name === userStudent.class_name && d.section === userStudent.section
    );
  } else if (user && !['admin', 'principal'].includes(user.role)) {
    // Teachers - see all published entries
    visibleDiaries = diaries;
  }
  // Admin/Principal can see all

  // Apply filters
  if (filters.class) {
    visibleDiaries = visibleDiaries.filter(d => d.class_name === filters.class);
  }
  if (filters.subject) {
    visibleDiaries = visibleDiaries.filter(d => d.subject === filters.subject);
  }
  if (selectedDate) {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    visibleDiaries = visibleDiaries.filter(d => d.diary_date === dateStr);
  }

  const uniqueClasses = [...new Set(visibleDiaries.map(d => d.class_name))].sort();
  const uniqueSubjects = [...new Set(visibleDiaries.map(d => d.subject))].sort();

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <PageHeader
        title="Class Diary"
        subtitle={userStudent ? `View activities for Class ${userStudent.class_name}` : 'View class activities and assignments'}
      />

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Filters — only for staff/admin, not students */}
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

        <DiaryList
          entries={visibleDiaries.sort((a, b) => new Date(b.diary_date) - new Date(a.diary_date) || new Date(b.created_date) - new Date(a.created_date))}
          canEdit={false}
        />
      </div>
    </div>
  );
}