import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import PageHeader from '@/components/ui/PageHeader';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAcademicYear } from '@/components/AcademicYearContext';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import ProgressCardGenerator from '@/components/hallTicket/ProgressCardGenerator';
import ProgressCardsList from '@/components/hallTicket/ProgressCardsList';

const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

const gradeColor = (grade) => {
  const map = {
    'A+': 'bg-green-100 text-green-700',
    'A': 'bg-emerald-100 text-emerald-700',
    'B+': 'bg-blue-100 text-blue-700',
    'B': 'bg-sky-100 text-sky-700',
    'C': 'bg-yellow-100 text-yellow-700',
    'D': 'bg-orange-100 text-orange-700',
    'F': 'bg-red-100 text-red-700',
  };
  return map[grade] || 'bg-slate-100 text-slate-700';
};

export default function ExamManagement() {
  const [user, setUser] = useState(null);
  const { academicYear } = useAcademicYear();
  const [filterExamType, setFilterExamType] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [viewResults, setViewResults] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const session = localStorage.getItem('staff_session');
        if (session) {
          setUser(JSON.parse(session));
          return;
        }
        const currentUser = await base44.auth.me();
        setUser(currentUser);
      } catch (e) {
        console.error('Failed to load user');
      }
    };
    loadUser();
  }, []);

  const { data: examTypes = [] } = useQuery({
    queryKey: ['exam-types-results', academicYear],
    queryFn: () => base44.entities.ExamType.filter({ academic_year: academicYear, is_active: true })
  });

  const { data: classStudents = [] } = useQuery({
    queryKey: ['students-results', filterClass],
    queryFn: () => base44.entities.Student.filter({ class_name: filterClass }),
    enabled: !!filterClass
  });

  const { data: studentResults = [] } = useQuery({
    queryKey: ['student-marks-results', selectedStudentId, filterExamType, academicYear],
    queryFn: async () => {
      if (!selectedStudentId) return [];
      const filter = { student_id: selectedStudentId, status: 'Published', academic_year: academicYear };
      if (filterExamType) filter.exam_type = filterExamType;
      return base44.entities.Marks.filter(filter);
    },
    enabled: !!selectedStudentId
  });

  const getPercentage = (marks) => {
    const total = marks.reduce((s, m) => s + m.marks_obtained, 0);
    const max = marks.reduce((s, m) => s + m.max_marks, 0);
    return max > 0 ? Math.round((total / max) * 100) : 0;
  };

  const studentInfo = classStudents.find(s => s.student_id === selectedStudentId || s.id === selectedStudentId);

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6">
      <PageHeader
        title="Exam Management"
        subtitle={`Academic Year: ${academicYear}`}
      />

      <div className="mt-6">
        <Tabs defaultValue="generate" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="generate">Generate Cards</TabsTrigger>
            <TabsTrigger value="view">View Cards</TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="mt-6">
            <ProgressCardGenerator />
          </TabsContent>

          <TabsContent value="view" className="mt-6">
            <ProgressCardsList />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}