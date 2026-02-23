import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, X } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAcademicYear } from '@/components/AcademicYearContext';

const CLASS_OPTIONS = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

export default function HallTicketGenerator() {
  const { academicYear } = useAcademicYear();
  const [filters, setFilters] = useState({ exam_type: '', classes: [], section: 'A', assignment_type: 'sequential' });
  const [generating, setGenerating] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const { data: examTypes = [] } = useQuery({
    queryKey: ['examTypes', academicYear],
    queryFn: () => base44.entities.ExamType.filter({ academic_year: academicYear, is_active: true })
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

  const handleClassToggle = (className) => {
    setFilters(prev => ({
      ...prev,
      classes: prev.classes.includes(className)
        ? prev.classes.filter(c => c !== className)
        : [...prev.classes, className]
    }));
  };

  const handleGenerate = async () => {
    if (!filters.exam_type || filters.classes.length === 0) {
      toast.error('Please select exam type and at least one class');
      return;
    }

    setGenerating(true);
    for (const className of filters.classes) {
      generateMutation.mutate({
        examTypeId: filters.exam_type,
        classname: className,
        section: filters.section,
        academicYear,
        assignmentType: filters.assignment_type
      });
    }
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
            <label className="block text-sm font-medium mb-2">Classes * (Multi-select)</label>
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="w-full px-3 py-2 border rounded-lg text-left bg-white flex items-center justify-between hover:bg-gray-50"
              >
                <span className="text-sm">
                  {filters.classes.length === 0 ? 'Select Classes' : `${filters.classes.length} selected`}
                </span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              </button>
              
              {showDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                  {CLASS_OPTIONS.map(className => (
                    <label
                      key={className}
                      className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={filters.classes.includes(className)}
                        onChange={() => handleClassToggle(className)}
                        className="rounded"
                      />
                      <span className="ml-2 text-sm">{className}</span>
                    </label>
                  ))}
                </div>
              )}
              
              {filters.classes.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {filters.classes.map(className => (
                    <div
                      key={className}
                      className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm flex items-center gap-1"
                    >
                      {className}
                      <button
                        onClick={() => handleClassToggle(className)}
                        className="hover:text-blue-900"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
          disabled={generating || !filters.exam_type || filters.classes.length === 0}
          className="w-full bg-blue-600 hover:bg-blue-700 gap-2"
        >
          {generating && <Loader2 className="w-4 h-4 animate-spin" />}
          Generate Hall Tickets
        </Button>
      </CardContent>
    </Card>
  );
}