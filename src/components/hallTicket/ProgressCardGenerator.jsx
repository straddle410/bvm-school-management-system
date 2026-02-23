import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Zap, AlertCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAcademicYear } from '@/components/AcademicYearContext';

const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
const SECTIONS = ['A', 'B', 'C', 'D'];

export default function ProgressCardGenerator() {
  const { academicYear } = useAcademicYear();
  const [filters, setFilters] = useState({ class: '', section: '', exam_type: '' });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const queryClient = useQueryClient();

  // Check authentication - staff session or platform login
  useEffect(() => {
    const checkAuth = async () => {
      setAuthLoading(true);
      try {
        const session = localStorage.getItem('staff_session');
        if (session) {
          const parsed = JSON.parse(session);
          setIsAuthenticated(true);
          setAuthLoading(false);
          return;
        }
        const isAuth = await base44.auth.isAuthenticated();
        setIsAuthenticated(isAuth);
      } catch (e) {
        console.error('Auth check failed:', e);
        setIsAuthenticated(false);
      } finally {
        setAuthLoading(false);
      }
    };
    checkAuth();
  }, []);

  const { data: examTypes = [] } = useQuery({
    queryKey: ['examTypes', academicYear],
    queryFn: () => base44.entities.ExamType.filter({ academic_year: academicYear, is_active: true })
  });

  const { data: publishedMarkStats = {} } = useQuery({
    queryKey: ['publishedMarkStats', academicYear],
    queryFn: async () => {
      const marks = await base44.entities.Marks.filter({
        status: 'Published',
        academic_year: academicYear
      });
      const stats = {
        totalMarks: marks.length,
        students: new Set(marks.map(m => m.student_id)).size,
        exams: new Set(marks.map(m => m.exam_type)).size
      };
      return stats;
    }
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('generateProgressCards', {
        academicYear,
        classNameFilter: filters.class || null,
        sectionFilter: filters.section || null,
        examTypeIdOrName: filters.exam_type || null
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['progressCards'] });
      toast.success(data.message || 'Progress cards generated successfully');
      setFilters({ class: '', section: '', exam_type: '' });
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || error.message || 'Failed to generate progress cards');
    }
  });

  const handleGenerate = () => {
    if (publishedMarkStats.students === 0) {
      toast.error('No published marks found. Please publish marks first.');
      return;
    }
    if (window.confirm('Generate progress cards for selected criteria?')) {
      generateMutation.mutate();
    }
  };

  if (authLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </CardContent>
      </Card>
    );
  }

  if (!isAuthenticated) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            Authentication Required
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">You must be logged in to generate progress cards.</p>
          <Button 
            onClick={() => window.location.href = '/StaffLogin'}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            Go to Staff Login
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-blue-600" />
            Generate Progress Cards
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="text-sm text-blue-600 font-medium">Published Marks</div>
              <div className="text-2xl font-bold text-blue-900">{publishedMarkStats.totalMarks || 0}</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="text-sm text-green-600 font-medium">Students with Published Marks</div>
              <div className="text-2xl font-bold text-green-900">{publishedMarkStats.students || 0}</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <div className="text-sm text-purple-600 font-medium">Exams Completed</div>
              <div className="text-2xl font-bold text-purple-900">{publishedMarkStats.exams || 0}</div>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Class (Optional)</label>
              <select
                value={filters.class}
                onChange={(e) => setFilters({ ...filters, class: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">All Classes</option>
                {CLASSES.map(c => (
                  <option key={c} value={c}>Class {c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Section (Optional)</label>
              <select
                value={filters.section}
                onChange={(e) => setFilters({ ...filters, section: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                disabled={!filters.class}
              >
                <option value="">All Sections</option>
                {SECTIONS.map(s => (
                  <option key={s} value={s}>Section {s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Exam Type (Optional)</label>
              <select
                value={filters.exam_type}
                onChange={(e) => setFilters({ ...filters, exam_type: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">All Exam Types</option>
                {examTypes.map(exam => (
                  <option key={exam.id} value={exam.id}>{exam.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            <p className="font-medium mb-1">Note:</p>
            <p>Progress cards will be generated for all students with published marks matching your filters. This will regenerate cards for the selected scope.</p>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={generateMutation.isPending || publishedMarkStats.students === 0}
            className="w-full bg-blue-600 hover:bg-blue-700 gap-2"
          >
            {generateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {generateMutation.isPending ? 'Generating...' : `Generate Progress Cards`}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}