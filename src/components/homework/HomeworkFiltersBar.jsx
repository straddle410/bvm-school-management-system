import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

const submissionProgressOptions = [
  { value: 'all', label: 'All' },
  { value: 'not-started', label: 'Not Started' },
  { value: 'partially-submitted', label: 'Partially Submitted' },
  { value: 'fully-submitted', label: 'Fully Submitted' },
  { value: 'pending-review', label: 'Pending Review' },
  { value: 'graded', label: 'Graded' },
  { value: 'revision-required', label: 'Revision Required' },
  { value: 'late-submissions', label: 'Late Submissions' },
];

const homeworkStatusOptions = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
  { value: 'closed', label: 'Closed' },
];

const sortOptions = [
  { value: 'newest-due', label: 'Newest Due Date' },
  { value: 'oldest-due', label: 'Oldest Due Date' },
  { value: 'highest-pending', label: 'Highest Pending' },
  { value: 'lowest-completion', label: 'Lowest Completion %' },
  { value: 'most-late', label: 'Most Late Submissions' },
];

export default function HomeworkFiltersBar({
  academicYear,
  setAcademicYear,
  classFilter,
  setClassFilter,
  sectionFilter,
  setSectionFilter,
  subjectFilter,
  setSubjectFilter,
  homeworkStatusFilter,
  setHomeworkStatusFilter,
  submissionProgressFilter,
  setSubmissionProgressFilter,
  sortBy,
  setSortBy,
  academicYears,
  classes,
  sections,
  subjects,
  onClearFilters,
}) {
  const hasActiveFilters = classFilter || sectionFilter || subjectFilter || homeworkStatusFilter !== 'all' || submissionProgressFilter !== 'all';

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
      {/* Row 1: Academic Year, Class, Section, Subject */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <div>
          <label className="text-xs font-semibold text-gray-700 block mb-1">Academic Year</label>
          <Select value={academicYear} onValueChange={setAcademicYear}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {academicYears.map((year) => (
                <SelectItem key={year} value={year}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-700 block mb-1">Class</label>
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>All Classes</SelectItem>
              {classes.map((cls) => (
                <SelectItem key={cls} value={cls}>{cls}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-700 block mb-1">Section</label>
          <Select value={sectionFilter} onValueChange={setSectionFilter}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>All Sections</SelectItem>
              {sections.map((sec) => (
                <SelectItem key={sec} value={sec}>{sec}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-700 block mb-1">Subject</label>
          <Select value={subjectFilter} onValueChange={setSubjectFilter}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>All Subjects</SelectItem>
              {subjects.map((subj) => (
                <SelectItem key={subj} value={subj}>{subj}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Row 2: Homework Status, Submission Progress, Sort */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <label className="text-xs font-semibold text-gray-700 block mb-1">Homework Status</label>
          <Select value={homeworkStatusFilter} onValueChange={setHomeworkStatusFilter}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {homeworkStatusOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-700 block mb-1">Submission Progress</label>
          <Select value={submissionProgressFilter} onValueChange={setSubmissionProgressFilter}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {submissionProgressOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs font-semibold text-gray-700 block mb-1">Sort By</label>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Clear filters button */}
      {hasActiveFilters && (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={onClearFilters}
            className="text-xs"
          >
            <X className="h-3 w-3 mr-1" />
            Clear Filters
          </Button>
        </div>
      )}
    </div>
  );
}