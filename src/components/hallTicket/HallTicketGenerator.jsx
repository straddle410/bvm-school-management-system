import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAcademicYear } from '@/components/AcademicYearContext';

export default function HallTicketGenerator() {
  const { academicYear } = useAcademicYear();
  const [filters, setFilters] = useState({ exam_type: '', class: '', section: 'A', assignment_type: 'sequential' });
  const [generating, setGenerating] = useState(false);

  const { data: examTypes = [] } = useQuery({
    queryKey: ['examTypes'],
    queryFn: () => base44.entities.ExamType.list()
  });

  const generateMutation = useMutation({
    mutationFn: async (data) => {
      const staffSession = localStorage.getItem('staff_session');
      const res = await base44.functions.invoke('generateHallTickets', {
        ...data,
        staffSession
      });
      return res.data;
    },
    onSuccess: (data) => {
      setGenerating(false);
      toast.success(data.message || 'Hall tickets generated successfully');
      setFilters({ exam_type: '', class: '', section: 'A', assignment_type: 'sequential' });
    },
    onError: (error) => {
      setGenerating(false);
      console.error('Generation error:', error);
      toast.error(error.response?.data?.error || error.message || 'Failed to generate hall tickets');
    }
  });

  const handleGenerate = async () => {
    if (!filters.exam_type || !filters.class) {
      toast.error('Please select exam type and class');
      return;
    }

    setGenerating(true);
    generateMutation.mutate({
      examTypeId: filters.exam_type,
      classname: filters.class,
      section: filters.section,
      academicYear,
      assignmentType: filters.assignment_type
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generate Hall Tickets</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Exam Type *</label>
            <select
              value={filters.exam_type}
              onChange={(e) => setFilters({ ...filters, exam_type: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="">Select Exam Type</option>
              {examTypes.map(type => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Class *</label>
            <Input
              type="text"
              placeholder="e.g., 8, 9, 10"
              value={filters.class}
              onChange={(e) => setFilters({ ...filters, class: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Section</label>
            <div className="px-3 py-2 border rounded-lg bg-slate-50">Section A</div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Assignment Type</label>
            <select
              value={filters.assignment_type}
              onChange={(e) => setFilters({ ...filters, assignment_type: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="sequential">Sequential (by Roll No)</option>
              <option value="random">Random</option>
            </select>
          </div>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={generating || !filters.exam_type || !filters.class}
          className="w-full bg-blue-600 hover:bg-blue-700 gap-2"
        >
          {generating && <Loader2 className="w-4 h-4 animate-spin" />}
          Generate Hall Tickets
        </Button>
      </CardContent>
    </Card>
  );
}