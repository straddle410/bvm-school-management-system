import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { getStaffSession } from '@/components/useStaffSession';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAcademicYear } from '@/components/AcademicYearContext';
import { getSubjectsForClass } from '@/components/subjectHelper';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, BookMarked, Trash2, CheckCircle2, Circle, Check, Sparkles, Users, BarChart2 } from 'lucide-react';
import HomeworkSubmissions from '@/components/homework/HomeworkSubmissions';
import HomeworkReportTab from '@/components/homework/HomeworkReportTab';
import { toast } from 'sonner';
import LoginRequired from '@/components/LoginRequired';
import { format, isPast } from 'date-fns';
import AIAssistDrawer from '@/components/AIAssistDrawer';
import HomeworkDashboardSummary from '@/components/homework/HomeworkDashboardSummary';
import HomeworkFiltersBar from '@/components/homework/HomeworkFiltersBar';
import HomeworkRowMetrics from '@/components/homework/HomeworkRowMetrics';
import { normalizeHomeworkSubmissionStatus } from '@/components/utils/homeworkStatusHelper';
import { getHomeworkAggregatedMetrics } from '@/components/homework/homeworkAggregationHelper';
import { canViewHomework, canManageHomework, isHomeworkAdmin, filterHomeworkByAccess, getHomeworkQueryFilter } from '@/components/homework/homeworkAccessControl';
import { getClassesForYear, getSectionsForClass } from '@/components/classSectionHelper';

export default function Homework() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'report'
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [selectedHomework, setSelectedHomework] = useState(null);
  const [showAIAssist, setShowAIAssist] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    class_name: '',
    section: '',
    subject_id: '',
    subject_name: '',
    due_date: '',
    submission_mode: 'VIEW_ONLY',
  });
  const [formErrors, setFormErrors] = useState({});
  const [selected, setSelected] = useState(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const { academicYear } = useAcademicYear();
  const queryClient = useQueryClient();

  // Dynamic class/section state for form
  const [availableClasses, setAvailableClasses] = useState([]);
  const [availableSections, setAvailableSections] = useState([]);

  // Filter state
  const [classFilter, setClassFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [homeworkStatusFilter, setHomeworkStatusFilter] = useState('all');
  const [submissionProgressFilter, setSubmissionProgressFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest-due');

  useEffect(() => {
    const staffData = getStaffSession();
    setUser(staffData);
  }, []);

  // Load classes for current academic year
  useEffect(() => {
    if (!academicYear) return;
    getClassesForYear(academicYear).then((result) => {
      setAvailableClasses(Array.isArray(result) ? result : (result?.classes ?? []));
    });
  }, [academicYear]);

  // Load sections when form class changes
  useEffect(() => {
    if (!form.class_name || !academicYear) { setAvailableSections([]); return; }
    getSectionsForClass(academicYear, form.class_name).then((result) => {
      const secs = Array.isArray(result) ? result : (result?.sections ?? []);
      setAvailableSections(secs);
      // Auto-select if only one section
      if (secs.length === 1) setForm(f => ({ ...f, section: secs[0] }));
      // Reset section if current is invalid
      else if (form.section && !secs.includes(form.section)) setForm(f => ({ ...f, section: '' }));
    });
  }, [form.class_name, academicYear]);

  const { data: subjects = [] } = useQuery({
    queryKey: ['subjects', academicYear, form.class_name],
    queryFn: async () => {
      console.log('[SUBJECT_CALLSITE] pages/Homework:39');
      if (!form.class_name || !academicYear) return [];
      const result = await getSubjectsForClass(academicYear, form.class_name);
      return result.subjects.map(name => ({ id: name, name }));
    },
    enabled: !!form.class_name && !!academicYear,
  });

  const { data: homeworkList = [], isLoading } = useQuery({
    queryKey: ['homework', academicYear, user?.name],
    queryFn: () => {
      const queryFilter = getHomeworkQueryFilter(user, { academic_year: academicYear });
      return base44.entities.Homework.filter(queryFilter, '-created_date');
    },
    enabled: !!academicYear && !!user,
  });

  const homeworkIds = homeworkList.map(h => h.id);

  const { data: submissions = [] } = useQuery({
    queryKey: ['homework-submissions', homeworkIds.join(',')],
    queryFn: () => base44.entities.HomeworkSubmission.filter({ homework_id: { $in: homeworkIds } }, '-created_date', 2000),
    enabled: homeworkIds.length > 0,
    staleTime: 0,
  });

  // Extract unique classes, sections, subjects from homework
  const uniqueClasses = [...new Set(homeworkList.map(h => h.class_name))].sort();
  const uniqueSections = [...new Set(homeworkList.map(h => h.section).filter(Boolean))].sort();
  const uniqueSubjects = [...new Set(homeworkList.map(h => h.subject).filter(Boolean))].sort();

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Homework.create({ ...data, assigned_by: user?.name, status: 'Draft' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homework'] });
      setShowForm(false);
      resetForm();
      toast.success('Homework saved as Draft');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Homework.update(editingItem.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homework'] });
      setShowForm(false);
      setEditingItem(null);
      resetForm();
      toast.success('Homework updated');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Homework.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homework'] });
      toast.success('Homework deleted');
    },
  });

  const bulkStatusMutation = useMutation({
    mutationFn: ({ homework_ids, status }) => base44.functions.invoke('bulkUpdateHomeworkStatus', { homework_ids, status }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['homework'] });
      setSelected(new Set());
      const action = res.data.status === 'Published' ? 'Published' : 'Moved to Draft';
      toast.success(`${action} ${res.data.updated_count} homework items`);
    },
  });

  const resetForm = () => {
    setForm({
      title: '',
      description: '',
      class_name: '',
      section: '',
      subject_id: '',
      subject_name: '',
      due_date: '',
      submission_mode: 'VIEW_ONLY',
      max_marks: '',
    });
    setFormErrors({});
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const errors = {};
    if (!form.subject_id) errors.subject = 'Please select a subject';
    if (!form.title) errors.title = 'Title is required';
    if (!form.description) errors.description = 'Description is required';
    if (!form.class_name) errors.class = 'Class is required';
    if (!form.due_date) errors.due_date = 'Due date is required';
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    const payload = {
      title: form.title,
      description: form.description,
      class_name: form.class_name,
      section: form.section,
      subject: form.subject_name,
      due_date: form.due_date,
      submission_mode: form.submission_mode,
      max_marks: form.max_marks ? Number(form.max_marks) : undefined,
      academic_year: academicYear,
    };
    console.log('HOMEWORK_PAYLOAD', payload);
    
    if (editingItem) {
      updateMutation.mutate(payload);
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleEdit = (item) => {
    if (!canManageHomework(item, user)) {
      toast.error('You cannot edit this homework');
      return;
    }
    setEditingItem(item);
    setForm({
      title: item.title,
      description: item.description,
      class_name: item.class_name,
      section: item.section || '',
      subject_id: item.subject_id || '',
      subject_name: item.subject_name || '',
      due_date: item.due_date,
      submission_mode: item.submission_mode || 'VIEW_ONLY',
      max_marks: item.max_marks || '',
    });
    setShowForm(true);
  };

  const toggleSelect = (id) => {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelected(newSelected);
  };

  const toggleSelectAll = () => {
    if (selected.size === homeworkList.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(homeworkList.map(hw => hw.id)));
    }
  };

  const handleBulkPublish = () => {
    const selectedItems = Array.from(selected).map(id => homeworkList.find(hw => hw.id === id)).filter(Boolean);
    const accessibleIds = selectedItems.filter(hw => canManageHomework(hw, user)).map(hw => hw.id);
    
    if (accessibleIds.length === 0) {
      toast.error('You cannot manage any of the selected homework');
      return;
    }
    if (accessibleIds.length < selectedItems.length) {
      toast.warning(`Publishing ${accessibleIds.length} homework (some were skipped due to access)`);
    }
    
    setBulkActionLoading(true);
    bulkStatusMutation.mutate({ homework_ids: accessibleIds, status: 'Published' });
    setBulkActionLoading(false);
  };

  const handleBulkUnpublish = () => {
    const selectedItems = Array.from(selected).map(id => homeworkList.find(hw => hw.id === id)).filter(Boolean);
    const accessibleIds = selectedItems.filter(hw => canManageHomework(hw, user)).map(hw => hw.id);
    
    if (accessibleIds.length === 0) {
      toast.error('You cannot manage any of the selected homework');
      return;
    }
    if (accessibleIds.length < selectedItems.length) {
      toast.warning(`Moving ${accessibleIds.length} homework to Draft (some were skipped due to access)`);
    }
    
    setBulkActionLoading(true);
    bulkStatusMutation.mutate({ homework_ids: accessibleIds, status: 'Draft' });
    setBulkActionLoading(false);
  };

  const handleQuickPublish = (id) => {
    const hw = homeworkList.find(h => h.id === id);
    if (!canManageHomework(hw, user)) {
      toast.error('You cannot manage this homework');
      return;
    }
    bulkStatusMutation.mutate({ homework_ids: [id], status: 'Published' });
  };

  const handleQuickUnpublish = (id) => {
    const hw = homeworkList.find(h => h.id === id);
    if (!canManageHomework(hw, user)) {
      toast.error('You cannot manage this homework');
      return;
    }
    bulkStatusMutation.mutate({ homework_ids: [id], status: 'Draft' });
  };

  // availableClasses and availableSections loaded dynamically above

  // Calculate statistics
  const calculateStats = async () => {
   let totalPublished = 0;
   let totalDraft = 0;
   let totalActive = 0;
   let totalClosed = 0;
   let totalPendingReview = 0;
   let totalGraded = 0;
   let totalRevisionRequired = 0;
   let totalLateSubmissions = 0;
   let overallTotalStudents = 0;
   let overallTotalSubmitted = 0;

   for (const hw of homeworkList) {
     const isOverdue = hw.due_date && isPast(new Date(hw.due_date));
     const isClosed = hw.status === 'Published' && isOverdue;

     if (hw.status === 'Published') totalPublished++;
     if (hw.status === 'Draft') totalDraft++;
     if (hw.status === 'Published' && !isClosed) totalActive++;
     if (isClosed) totalClosed++;

     // ✅ CRITICAL: Skip metrics for VIEW_ONLY homework
     if (hw.submission_mode === 'VIEW_ONLY') {
       continue;
     }

     // Get assigned students for this homework (global filter: status=Published, is_deleted=false, current AY)
     const studentFilter = {
       class_name: hw.class_name,
       status: 'Published',
       is_deleted: false,
       academic_year: academicYear,
     };
     if (hw.section && hw.section !== 'All') {
       studentFilter.section = hw.section;
     }
     const assignedStudents = await base44.entities.Student.filter(studentFilter, 'student_id', 500);

     // Use shared helper for consistent metrics (only for SUBMISSION_REQUIRED)
     const metrics = getHomeworkAggregatedMetrics(hw, submissions, assignedStudents);

     overallTotalStudents += metrics.totalStudents;
     overallTotalSubmitted += metrics.submittedCount;

     totalPendingReview += metrics.submittedCount > 0 ? (metrics.submittedCount - metrics.gradedCount - metrics.revisionRequiredCount) : 0;
     totalGraded += metrics.gradedCount;
     totalRevisionRequired += metrics.revisionRequiredCount;
     totalLateSubmissions += metrics.lateCount;
   }

    const overallSubmissionRate =
      overallTotalStudents > 0 ? (overallTotalSubmitted / overallTotalStudents) * 100 : 0;

    return {
      totalPublished,
      totalDraft,
      totalActive,
      totalClosed,
      overallSubmissionRate,
      totalPendingReview,
      totalGraded,
      totalRevisionRequired,
      totalLateSubmissions,
    };
  };

  const { data: stats = {} } = useQuery({
    queryKey: ['homework-stats', homeworkList, submissions],
    queryFn: calculateStats,
    enabled: homeworkList.length > 0,
  });

  // Apply filters and sorting
  let filteredList = homeworkList.filter((hw) => {
    if (classFilter && hw.class_name !== classFilter) return false;
    if (sectionFilter && hw.section !== sectionFilter) return false;
    if (subjectFilter && hw.subject !== subjectFilter) return false;

    if (homeworkStatusFilter !== 'all') {
      const isOverdue = hw.due_date && isPast(new Date(hw.due_date));
      if (homeworkStatusFilter === 'draft' && hw.status !== 'Draft') return false;
      if (homeworkStatusFilter === 'published' && (hw.status !== 'Published' || isOverdue)) return false;
      if (homeworkStatusFilter === 'closed' && !isOverdue) return false;
    }

    if (submissionProgressFilter !== 'all') {
      // ✅ Skip submission filters for VIEW_ONLY homework
      if (hw.submission_mode === 'VIEW_ONLY') {
        if (submissionProgressFilter !== 'all') return false; // Don't show VIEW_ONLY in submission filters
      } else {
        // Get assigned students for this homework (global filter: status=Published, is_deleted=false)
        const studentFilter = {
          class_name: hw.class_name,
          status: 'Published',
          is_deleted: false,
          academic_year: academicYear,
        };
        if (hw.section && hw.section !== 'All') {
          studentFilter.section = hw.section;
        }
        // Note: We'd need to load assigned students here for accurate filtering
        // For now, using submission-based filtering which is consistent

        const hwSubmissions = submissions.filter((s) => s.homework_id === hw.id);
        const metrics = getHomeworkAggregatedMetrics(hw, submissions, []);

        const hasPendingReview = metrics.submittedCount > 0;
        const hasFullySubmitted = metrics.pendingCount === 0 && metrics.submittedCount > 0;
        const hasLateSubmissions = metrics.lateCount > 0;

        if (submissionProgressFilter === 'not-started' && metrics.submittedCount > 0) return false;
        if (submissionProgressFilter === 'fully-submitted' && !hasFullySubmitted) return false;
        if (submissionProgressFilter === 'pending-review' && !hasPendingReview) return false;
        if (submissionProgressFilter === 'graded' && metrics.gradedCount === 0) return false;
        if (submissionProgressFilter === 'revision-required' && metrics.revisionRequiredCount === 0) return false;
        if (submissionProgressFilter === 'late-submissions' && !hasLateSubmissions) return false;
      }
    }

    return true;
  });

  // Apply sorting
  filteredList.sort((a, b) => {
    if (sortBy === 'newest-due') {
      return new Date(b.due_date || 0) - new Date(a.due_date || 0);
    }
    if (sortBy === 'oldest-due') {
      return new Date(a.due_date || 0) - new Date(b.due_date || 0);
    }
    if (sortBy === 'highest-pending') {
      // This would require calculating pending for each - for now use submitted count
      return 0;
    }
    if (sortBy === 'lowest-completion') {
      return 0;
    }
    if (sortBy === 'most-late') {
      const metricsA = getHomeworkAggregatedMetrics(a, submissions, []);
      const metricsB = getHomeworkAggregatedMetrics(b, submissions, []);
      return metricsB.lateCount - metricsA.lateCount;
    }
    return 0;
  });

  const handleClearFilters = () => {
    setClassFilter('');
    setSectionFilter('');
    setSubjectFilter('');
    setHomeworkStatusFilter('all');
    setSubmissionProgressFilter('all');
  };

  // Fetch metrics for each homework in filtered list (global filter: status=Published, is_deleted=false)
  const getHomeworkMetrics = async (hw) => {
    const studentFilter = {
      class_name: hw.class_name,
      status: 'Published',
      is_deleted: false,
      academic_year: academicYear,
    };
    if (hw.section && hw.section !== 'All') {
      studentFilter.section = hw.section;
    }
    const assignedStudents = await base44.entities.Student.filter(studentFilter, 'student_id', 500);

    // Use shared helper for consistent metrics
    const metrics = getHomeworkAggregatedMetrics(hw, submissions, assignedStudents);

    return {
      totalStudents: metrics.totalStudents,
      submitted: metrics.submittedCount,
      pending: metrics.pendingCount,
      graded: metrics.gradedCount,
      revisionRequired: metrics.revisionRequiredCount,
      lateSubmissions: metrics.lateCount,
    };
  };

  return (
    <LoginRequired allowedRoles={['admin', 'principal', 'teacher']} pageName="Homework">
      <div className="min-h-screen bg-gray-50 py-6 px-4">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BookMarked className="h-8 w-8 text-purple-600" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Homework Dashboard</h1>
                <p className="text-gray-600 text-sm">Track assignments and submission progress</p>
              </div>
            </div>
            <Button
              onClick={() => {
                setEditingItem(null);
                resetForm();
                setShowForm(true);
              }}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Plus className="h-4 w-4 mr-2" /> Add Homework
            </Button>
          </div>

          {/* Tab switcher */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'dashboard' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <BookMarked className="inline h-4 w-4 mr-1.5 -mt-0.5" />Dashboard
            </button>
            <button
              onClick={() => setActiveTab('report')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${activeTab === 'report' ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <BarChart2 className="inline h-4 w-4 mr-1.5 -mt-0.5" />Report
            </button>
          </div>

          {/* Report Tab */}
          {activeTab === 'report' && (
            <HomeworkReportTab homeworkList={homeworkList} submissions={submissions} />
          )}

          {/* Dashboard Tab */}
          {activeTab === 'dashboard' && <>

          {/* Dashboard Summary Cards */}
          {!isLoading && Object.keys(stats).length > 0 && (
            <HomeworkDashboardSummary
              totalPublished={stats.totalPublished || 0}
              totalDraft={stats.totalDraft || 0}
              totalActive={stats.totalActive || 0}
              totalClosed={stats.totalClosed || 0}
              overallSubmissionRate={stats.overallSubmissionRate || 0}
              totalPendingReview={stats.totalPendingReview || 0}
              totalGraded={stats.totalGraded || 0}
              totalRevisionRequired={stats.totalRevisionRequired || 0}
              totalLateSubmissions={stats.totalLateSubmissions || 0}
            />
          )}

          {/* Filters Bar */}
          <HomeworkFiltersBar
            academicYear={academicYear}
            setAcademicYear={() => {}}
            classFilter={classFilter}
            setClassFilter={setClassFilter}
            sectionFilter={sectionFilter}
            setSectionFilter={setSectionFilter}
            subjectFilter={subjectFilter}
            setSubjectFilter={setSubjectFilter}
            homeworkStatusFilter={homeworkStatusFilter}
            setHomeworkStatusFilter={setHomeworkStatusFilter}
            submissionProgressFilter={submissionProgressFilter}
            setSubmissionProgressFilter={setSubmissionProgressFilter}
            sortBy={sortBy}
            setSortBy={setSortBy}
            academicYears={[academicYear]}
            classes={uniqueClasses}
            sections={uniqueSections}
            subjects={uniqueSubjects}
            onClearFilters={handleClearFilters}
          />

          {/* Bulk Action Bar */}
          {selected.size > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-4 flex items-center justify-between">
              <span className="text-sm font-semibold text-blue-900">{selected.size} selected</span>
              <div className="flex gap-2">
                <Button
                  onClick={handleBulkPublish}
                  size="sm"
                  className="text-xs bg-green-600 hover:bg-green-700"
                  disabled={bulkActionLoading}
                >
                  Publish Selected
                </Button>
                <Button
                  onClick={handleBulkUnpublish}
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  disabled={bulkActionLoading}
                >
                  Move to Draft
                </Button>
                <Button
                  onClick={() => setSelected(new Set())}
                  size="sm"
                  variant="ghost"
                  className="text-xs"
                >
                  Clear
                </Button>
              </div>
            </div>
          )}

          {/* Homework List */}
          {isLoading ? (
            <div className="text-center py-12">
              <div className="inline-block w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
            </div>
          ) : filteredList.length === 0 && homeworkList.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
              <BookMarked className="h-12 w-12 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No homework assigned yet</p>
              <Button onClick={() => setShowForm(true)} className="bg-purple-600 hover:bg-purple-700">
                <Plus className="h-4 w-4 mr-2" /> Create First Homework
              </Button>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
              <BookMarked className="h-12 w-12 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No homework found with current filters</p>
              <Button onClick={handleClearFilters} variant="outline" className="text-sm">
                Clear Filters
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Select All Row */}
              <div className="bg-gray-100 rounded-lg p-4 flex items-center gap-3">
                <Checkbox
                  checked={selected.size === filteredList.length && filteredList.length > 0}
                  onCheckedChange={toggleSelectAll}
                  id="select-all"
                />
                <label htmlFor="select-all" className="text-sm font-semibold text-gray-900 cursor-pointer">
                  Select All ({filteredList.length})
                </label>
              </div>

              {/* Homework Cards with Metrics */}
              <div className="space-y-4">
                {filteredList.map((item) => (
                  <div
                    key={item.id}
                    className={`bg-white rounded-lg p-4 shadow-sm border border-gray-200 ${
                      selected.has(item.id) ? 'ring-2 ring-blue-500' : ''
                    }`}
                  >
                    <div className="flex gap-4 items-start">
                      {/* Checkbox */}
                      <div className="flex items-start pt-1 flex-shrink-0">
                        <Checkbox
                          checked={selected.has(item.id)}
                          onCheckedChange={() => toggleSelect(item.id)}
                          id={`hw-${item.id}`}
                        />
                      </div>

                      {/* Metrics Component */}
                              <div className="flex-1">
                                <HomeworkRowMetrics 
                                  homework={item} 
                                  submissions={submissions}
                                  assignedStudents={[]}
                                />
                              </div>

                      {/* Actions */}
                      <div className="flex gap-2 flex-shrink-0 flex-col">
                        {item.status === 'Published' ? (
                          <Button
                            onClick={() => handleQuickUnpublish(item.id)}
                            size="sm"
                            variant="outline"
                            className="text-xs whitespace-nowrap"
                            disabled={bulkActionLoading}
                          >
                            Unpublish
                          </Button>
                        ) : (
                          <Button
                            onClick={() => handleQuickPublish(item.id)}
                            size="sm"
                            className="text-xs bg-green-600 hover:bg-green-700 whitespace-nowrap"
                            disabled={bulkActionLoading}
                          >
                            Publish
                          </Button>
                        )}
                        {item.submission_mode === 'SUBMISSION_REQUIRED' && (
                          <Button
                            onClick={() => setSelectedHomework(item)}
                            size="sm"
                            variant="outline"
                            className="text-xs whitespace-nowrap text-indigo-700 border-indigo-300 hover:bg-indigo-50"
                          >
                            <Users className="h-3 w-3 mr-1" /> Grade
                          </Button>
                        )}
                        <Button
                          onClick={() => handleEdit(item)}
                          size="sm"
                          variant="outline"
                          className="text-xs whitespace-nowrap"
                        >
                          Edit
                        </Button>
                        <Button
                          onClick={() => {
                            if (!canManageHomework(item, user)) {
                              toast.error('You cannot delete this homework');
                              return;
                            }
                            if (confirm('Delete this homework?')) {
                              deleteMutation.mutate(item.id);
                            }
                          }}
                          size="sm"
                          variant="destructive"
                          className="text-xs whitespace-nowrap"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* End Dashboard Tab */}
          </>}

          {/* Form Dialog */}
          <Dialog open={showForm} onOpenChange={setShowForm}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle>{editingItem ? 'Edit Homework' : 'Add Homework'}</DialogTitle>
                  <Button
                    size="sm"
                    onClick={() => setShowAIAssist(true)}
                    className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium"
                  >
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" /> AI Assist
                  </Button>
                </div>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>Title *</Label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g., Chapter 5 Exercises"
                    required
                  />
                </div>
                <div>
                  <Label>Description *</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Assignment details"
                    rows={3}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Class *</Label>
                    <Select value={form.class_name} onValueChange={(v) => setForm({ ...form, class_name: v, section: '' })} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select class" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableClasses.map((cls) => (
                          <SelectItem key={cls} value={cls}>
                            Class {cls}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Section</Label>
                    <Select value={form.section} onValueChange={(v) => setForm({ ...form, section: v })} disabled={availableSections.length === 0}>
                      <SelectTrigger>
                        <SelectValue placeholder={form.class_name ? 'Select section' : 'Select class first'} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableSections.map((sec) => (
                          <SelectItem key={sec} value={sec}>{sec}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Subject *</Label>
                  {!form.class_name ? (
                    <div className="text-xs text-gray-500 py-2 px-3 bg-gray-100 rounded-lg">
                      Select class first
                    </div>
                  ) : subjects.length === 0 ? (
                    <div className="text-xs text-red-600 py-2 px-3 bg-red-50 rounded-lg">
                      No subjects configured. Contact admin.
                    </div>
                  ) : (
                    <Select
                      value={form.subject_id}
                      onValueChange={(v) => {
                        const selected = subjects.find((s) => s.id === v);
                        setForm({ ...form, subject_id: v, subject_name: selected?.name || '' });
                        setFormErrors({ ...formErrors, subject: '' });
                      }}
                    >
                      <SelectTrigger className={formErrors.subject ? 'border-red-500' : ''}>
                        <SelectValue placeholder="Select a subject" />
                      </SelectTrigger>
                      <SelectContent>
                        {subjects.map((subj) => (
                          <SelectItem key={subj.id} value={subj.id}>
                            {subj.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {formErrors.subject && <p className="text-xs text-red-600 mt-1">{formErrors.subject}</p>}
                </div>
                <div>
                  <Label>Due Date</Label>
                  <Input
                    type="date"
                    value={form.due_date}
                    onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Submission Mode</Label>
                  <Select value={form.submission_mode} onValueChange={(v) => setForm({ ...form, submission_mode: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="VIEW_ONLY">View Only</SelectItem>
                      <SelectItem value="SUBMISSION_REQUIRED">Students Must Submit</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowForm(false);
                      setEditingItem(null);
                      resetForm();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    className="bg-purple-600 hover:bg-purple-700"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {editingItem ? 'Update' : 'Add'} Homework
                  </Button>
                </div>
              </form>
              </DialogContent>
              </Dialog>

              {selectedHomework && (
                <HomeworkSubmissions
                  homework={selectedHomework}
                  onClose={() => setSelectedHomework(null)}
                />
              )}

              {showAIAssist && (
              <AIAssistDrawer
              type="homework"
              className={form.class_name}
              section={form.section}
              academicYear={academicYear}
              onInsert={(generated) => {
              setForm(f => ({
                ...f,
                title: generated.title || f.title,
                description: generated.instructions || f.description
              }));
              setShowAIAssist(false);
              toast.success('Content inserted!');
              }}
              onClose={() => setShowAIAssist(false)}
              />
              )}
              </div>
              </div>
              </LoginRequired>
              );
              }