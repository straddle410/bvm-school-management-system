import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Zap, AlertCircle, Calendar } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAcademicYear } from '@/components/AcademicYearContext';

export default function ExamTypeProgressCardGenerator() {
  const { academicYear } = useAcademicYear();
  const [selectedExamTypeId, setSelectedExamTypeId] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const queryClient = useQueryClient();

  // Check authentication
  React.useEffect(() => {
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

  const selectedExam = examTypes.find(e => e.id === selectedExamTypeId);

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('generateProgressCardsForExamType', {
        academicYear,
        examTypeId: selectedExamTypeId
      });
      return response.data;
    },
    onSuccess: (data) => {
      console.log('[GenerateProgressCards] Full backend response:', data);
      queryClient.invalidateQueries({ queryKey: ['progressCards'] });
      const generated = data.cardsGenerated ?? 0;
      const skipped = data.skippedCount ?? 0;
      const total = generated + skipped;
      console.log(`[GenerateProgressCards] cardsGenerated=${generated}, skippedCount=${skipped}, total=${total}`);
      toast.success(
        `${generated} cards generated, ${skipped} already existed, 0 duplicates created`,
        { description: `Total students processed: ${total}`, duration: 6000 }
      );
      setSelectedExamTypeId('');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || error.message || 'Failed to generate progress cards');
    }
  });

  const handleGenerate = () => {
    if (!selectedExamTypeId) {
      toast.error('Please select an exam type');
      return;
    }
    if (window.confirm(`Generate progress cards for exam "${selectedExam?.name}"?\n\nAttendance Range: ${selectedExam?.attendance_range_start} to ${selectedExam?.attendance_range_end}`)) {
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
            Generate Progress Card Report
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-2">Select Exam Type *</label>
              <select
                value={selectedExamTypeId}
                onChange={(e) => setSelectedExamTypeId(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="">Choose an exam type...</option>
                {examTypes.filter(e => e.attendance_range_start && e.attendance_range_end).map(exam => (
                  <option key={exam.id} value={exam.id}>
                    {exam.name}
                  </option>
                ))}
              </select>
              {examTypes.some(e => !e.attendance_range_start || !e.attendance_range_end) && (
                <p className="text-xs text-amber-600 mt-1">
                  ⚠️ Some exam types don't have attendance ranges configured.
                </p>
              )}
            </div>

            {selectedExam && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                <div className="font-medium text-blue-900">{selectedExam.name}</div>
                <div className="flex items-center gap-2 text-sm text-blue-800">
                  <Calendar className="h-4 w-4" />
                  <span>
                    Attendance Range: <strong>{selectedExam.attendance_range_start}</strong> to <strong>{selectedExam.attendance_range_end}</strong>
                  </span>
                </div>
                {selectedExam.description && (
                  <p className="text-sm text-blue-700">{selectedExam.description}</p>
                )}
              </div>
            )}
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-700">
            <p className="font-medium mb-1">What will be generated:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Marks for selected exam type only</li>
              <li>Attendance summary using the exam type's date range</li>
              <li>Month-wise attendance breakdown within the range</li>
              <li>Student ranks by class/section</li>
            </ul>
          </div>

          <Button
            onClick={handleGenerate}
            disabled={generateMutation.isPending || !selectedExamTypeId}
            className="w-full bg-blue-600 hover:bg-blue-700 gap-2"
          >
            {generateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {generateMutation.isPending ? 'Generating...' : 'Generate Progress Cards'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}