import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Zap, AlertCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAcademicYear } from '@/components/AcademicYearContext';
import { getClassesForYear, getSectionsForClass } from '@/components/classSectionHelper';

export default function ProgressCardGenerator() {
  const { academicYear } = useAcademicYear();
  const [filters, setFilters] = useState({ class: '', section: '', exam_type: '' });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [availableClasses, setAvailableClasses] = useState([]);
  const [availableSections, setAvailableSections] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingSections, setLoadingSections] = useState(false);
  const queryClient = useQueryClient();

  // Auth check
  useEffect(() => {
    const checkAuth = async () => {
      setAuthLoading(true);
      try {
        const session = localStorage.getItem('staff_session');
        if (session) { setIsAuthenticated(true); setAuthLoading(false); return; }
        const isAuth = await base44.auth.isAuthenticated();
        setIsAuthenticated(isAuth);
      } catch { setIsAuthenticated(false); }
      finally { setAuthLoading(false); }
    };
    checkAuth();
  }, []);

  // Load classes
  useEffect(() => {
    if (!academicYear) return;
    setLoadingClasses(true);
    getClassesForYear(academicYear)
      .then(res => setAvailableClasses(res.classes || []))
      .catch(() => setAvailableClasses([]))
      .finally(() => setLoadingClasses(false));
  }, [academicYear]);

  // Load sections when class changes
  useEffect(() => {
    if (!academicYear || !filters.class) {
      setAvailableSections([]);
      setFilters(prev => ({ ...prev, section: '' }));
      return;
    }
    setLoadingSections(true);
    getSectionsForClass(academicYear, filters.class)
      .then(res => {
        setAvailableSections(res.sections || []);
        setFilters(prev => ({ ...prev, section: '' }));
      })
      .catch(() => setAvailableSections([]))
      .finally(() => setLoadingSections(false));
  }, [academicYear, filters.class]);

  const { data: examTypes = [] } = useQuery({
    queryKey: ['examTypes', academicYear],
    queryFn: () => base44.entities.ExamType.filter({ academic_year: academicYear, is_active: true })
  });

  const { data: publishedMarkStats = {} } = useQuery({
    queryKey: ['publishedMarkStats', academicYear],
    queryFn: async () => {
      const marks = await base44.entities.Marks.filter({ academic_year: academicYear });
      const approvedOrPublished = marks.filter(m => m.status === 'Published' || m.status === 'Approved');
      return {
        totalMarks: approvedOrPublished.length,
        students: new Set(approvedOrPublished.map(m => m.student_id)).size,
        exams: new Set(approvedOrPublished.map(m => m.exam_type)).size
      };
    }
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('generateProgressCards', {
        academicYear,
        classNameFilter: filters.class,
        sectionFilter: filters.section,
        examTypeIdOrName: filters.exam_type
      });
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['progressCards'] });
      const generated = data.cardsGenerated ?? 0;
      const skipped = data.skippedCount ?? 0;
      const total = generated + skipped;
      toast.success(
        `${generated} cards generated, ${skipped} already existed, 0 duplicates created`,
        { description: `Total students processed: ${total}`, duration: 6000 }
      );
      setFilters({ class: '', section: '', exam_type: '' });
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || error.message || 'Failed to generate progress cards');
    }
  });

  const handleGenerate = () => {
    generateMutation.mutate();
  };

  if (authLoading) return (
    <Card><CardContent className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></CardContent></Card>
  );

  if (!isAuthenticated) return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><AlertCircle className="h-5 w-5 text-red-600" />Authentication Required</CardTitle></CardHeader>
      <CardContent>
        <p className="text-sm text-gray-600 mb-4">You must be logged in to generate progress cards.</p>
        <Button onClick={() => window.location.href = '/StaffLogin'} className="w-full bg-blue-600 hover:bg-blue-700">Go to Staff Login</Button>
      </CardContent>
    </Card>
  );

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
            <div className="bg-blue-50 dark:bg-gray-800 p-4 rounded-lg border border-blue-200 dark:border-gray-600">
              <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">Published Marks</div>
              <div className="text-2xl font-bold text-blue-900 dark:text-gray-200">{publishedMarkStats.totalMarks || 0}</div>
              </div>
              <div className="bg-green-50 dark:bg-gray-800 p-4 rounded-lg border border-green-200 dark:border-gray-600">
              <div className="text-sm text-green-600 dark:text-green-400 font-medium">Students with Published Marks</div>
              <div className="text-2xl font-bold text-green-900 dark:text-gray-200">{publishedMarkStats.students || 0}</div>
              </div>
              <div className="bg-purple-50 dark:bg-gray-800 p-4 rounded-lg border border-purple-200 dark:border-gray-600">
              <div className="text-sm text-purple-600 dark:text-purple-400 font-medium">Exams Completed</div>
              <div className="text-2xl font-bold text-purple-900 dark:text-gray-200">{publishedMarkStats.exams || 0}</div>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium dark:text-gray-300 mb-2">
                Class <span className="text-red-600">*</span>
                {loadingClasses && <span className="text-xs text-gray-400 ml-1">Loading...</span>}
              </label>
              <select
                value={filters.class}
                onChange={(e) => setFilters({ ...filters, class: e.target.value })}
                disabled={loadingClasses}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
              >
                <option value="">-- Select Class --</option>
                {availableClasses.map(c => <option key={c} value={c}>Class {c}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium dark:text-gray-300 mb-2">
                Section <span className="text-red-600">*</span>
                {loadingSections && <span className="text-xs text-gray-400 ml-1">Loading...</span>}
              </label>
              <select
                value={filters.section}
                onChange={(e) => setFilters({ ...filters, section: e.target.value })}
                disabled={!filters.class || loadingSections}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
              >
                <option value="">-- Select Section --</option>
                {availableSections.map(s => <option key={s} value={s}>Section {s}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium dark:text-gray-300 mb-2">
                Exam Type <span className="text-red-600">*</span>
              </label>
              <select
                value={filters.exam_type}
                onChange={(e) => setFilters({ ...filters, exam_type: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
              >
                <option value="">-- Select Exam Type --</option>
                {examTypes.map(exam => <option key={exam.id} value={exam.id}>{exam.name}</option>)}
              </select>
            </div>
          </div>

          {!filters.class || !filters.section || !filters.exam_type ? (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-800 dark:text-red-300">
              <p className="font-medium">⚠️ Required Fields Missing</p>
              <p className="text-xs mt-1">Class, Section, and Exam Type must be selected to generate progress cards.</p>
            </div>
          ) : (
            <div className="bg-amber-50 dark:bg-gray-800 border border-amber-200 dark:border-gray-600 rounded-lg p-3 text-sm text-amber-800 dark:text-amber-300">
              <p className="font-medium dark:text-amber-400 mb-1">Ready to Generate</p>
              <p className="dark:text-gray-400">Progress cards will be generated only for Class {filters.class}, Section {filters.section}, and Exam Type {examTypes.find(e => e.id === filters.exam_type)?.name}.</p>
            </div>
          )}

          <Button
            onClick={handleGenerate}
            disabled={generateMutation.isPending || cleanupMutation.isPending || !filters.class || !filters.section || !filters.exam_type}
            className="w-full bg-blue-600 hover:bg-blue-700 gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {(generateMutation.isPending || cleanupMutation.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
            {cleanupMutation.isPending ? 'Cleaning up old cards...' : generateMutation.isPending ? 'Generating fresh cards...' : 'Delete & Generate Progress Cards'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}