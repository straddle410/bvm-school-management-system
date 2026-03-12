import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, X } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAcademicYear } from '@/components/AcademicYearContext';
import { getClassesForYear, getSectionsForClass } from '@/components/classSectionHelper';

export default function HallTicketGenerator() {
  const { academicYear } = useAcademicYear();
  const [filters, setFilters] = useState({ exam_type: '', classes: [], section: '', assignment_type: 'sequential' });
  const [generating, setGenerating] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const [availableClasses, setAvailableClasses] = useState([]);
  const [availableSections, setAvailableSections] = useState([]);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingSections, setLoadingSections] = useState(false);

  // Load classes when academic year changes
  useEffect(() => {
    if (!academicYear) return;
    setLoadingClasses(true);
    getClassesForYear(academicYear)
      .then(res => setAvailableClasses(res.classes || []))
      .catch(() => setAvailableClasses([]))
      .finally(() => setLoadingClasses(false));
    // Reset selections when year changes
    setFilters(prev => ({ ...prev, classes: [], section: '' }));
  }, [academicYear]);

  // NOTE: Hall ticket generation supports multi-class but single section per batch.
  // When multiple classes are selected, the section applies to all selected classes.
  // Load sections based on the first selected class (or any class — sections are typically uniform).
  const representativeClass = filters.classes[0] || null;

  useEffect(() => {
    if (!academicYear || !representativeClass) {
      setAvailableSections([]);
      setFilters(prev => ({ ...prev, section: '' }));
      return;
    }
    setLoadingSections(true);
    getSectionsForClass(academicYear, representativeClass)
      .then(res => {
        const sections = res.sections || [];
        setAvailableSections(sections);
        // Auto-select if only one section
        if (sections.length === 1) {
          setFilters(prev => ({ ...prev, section: sections[0] }));
        } else {
          setFilters(prev => ({ ...prev, section: '' }));
        }
      })
      .catch(() => setAvailableSections([]))
      .finally(() => setLoadingSections(false));
  }, [academicYear, representativeClass]);

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
      setFilters(prev => ({ ...prev, exam_type: '', classes: [], section: '', assignment_type: 'sequential' }));
    },
    onError: (error) => {
      setGenerating(false);
      const errorMsg = error.response?.data?.error || error.message || 'Failed to generate hall tickets';
      const hasDuplicates = error.response?.data?.hasDuplicateRollNumbers;
      if (hasDuplicates) {
        toast.error(errorMsg, {
          duration: 6000,
          action: { label: 'Go to Students', onClick: () => window.location.href = '/Students' }
        });
      } else {
        toast.error(errorMsg);
      }
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
    if (!filters.section) {
      toast.error('Please select a section');
      return;
    }

    setGenerating(true);
    generateMutation.mutate({
      examTypeId: filters.exam_type,
      classes: filters.classes,
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
          {/* Exam Type */}
          <div>
            <label className="block text-sm font-medium dark:text-gray-300 mb-2">Exam Type *</label>
            <select
              value={filters.exam_type}
              onChange={(e) => setFilters({ ...filters, exam_type: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
            >
              <option value="">Select Exam Type</option>
              {examTypes.map(type => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </select>
          </div>

          {/* Classes — multi-select */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Classes * (Multi-select)
              {loadingClasses && <span className="text-xs text-gray-400 ml-2">Loading...</span>}
            </label>
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                disabled={loadingClasses}
                className="w-full px-3 py-2 border rounded-lg text-left bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
              >
                <span className="text-sm">
                  {filters.classes.length === 0 ? 'Select Classes' : `${filters.classes.length} selected`}
                </span>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-700 border dark:border-gray-600 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                  {availableClasses.map(className => (
                    <label key={className} className="flex items-center px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-600 dark:text-gray-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.classes.includes(className)}
                        onChange={() => handleClassToggle(className)}
                        className="rounded"
                      />
                      <span className="ml-2 text-sm">Class {className}</span>
                    </label>
                  ))}
                </div>
              )}

              {filters.classes.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {filters.classes.map(className => (
                    <div key={className} className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm flex items-center gap-1">
                      {className}
                      <button onClick={() => handleClassToggle(className)} className="hover:text-blue-900">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Section — dynamic */}
          <div>
            <label className="block text-sm font-medium dark:text-gray-300 mb-2">
              Section *
              {loadingSections && <span className="text-xs text-gray-400 ml-2">Loading...</span>}
            </label>
            {filters.classes.length === 0 ? (
              <div className="px-3 py-2 border rounded-lg bg-slate-50 text-sm text-slate-400">
                Select a class first
              </div>
            ) : (
              <select
                value={filters.section}
                onChange={(e) => setFilters({ ...filters, section: e.target.value })}
                disabled={loadingSections || availableSections.length === 0}
                className="w-full px-3 py-2 border rounded-lg disabled:bg-slate-50 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600 dark:disabled:bg-gray-600"
              >
                <option value="">Select Section</option>
                {availableSections.map(s => (
                  <option key={s} value={s}>Section {s}</option>
                ))}
              </select>
            )}
            {filters.classes.length > 1 && filters.section && (
              <p className="text-xs text-amber-600 mt-1">
                ⚠ Section {filters.section} will be applied to all {filters.classes.length} selected classes
              </p>
            )}
          </div>

          {/* Assignment Type */}
          <div>
            <label className="block text-sm font-medium dark:text-gray-300 mb-2">Assignment Type</label>
            <select
              value={filters.assignment_type}
              onChange={(e) => setFilters({ ...filters, assignment_type: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600"
            >
              <option value="sequential">Sequential (by Roll No)</option>
              <option value="random">Random</option>
            </select>
          </div>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={generating || !filters.exam_type || filters.classes.length === 0 || !filters.section}
          className="w-full bg-blue-600 hover:bg-blue-700 gap-2"
        >
          {generating && <Loader2 className="w-4 h-4 animate-spin" />}
          Generate Hall Tickets
        </Button>
      </CardContent>
    </Card>
  );
}