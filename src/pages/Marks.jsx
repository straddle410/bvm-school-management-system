import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/utils';
import LoginRequired from '@/components/LoginRequired';
import { getStaffSession } from '@/components/useStaffSession';
import { useAcademicYear } from '@/components/AcademicYearContext';
import PastYearWarning, { isPastAcademicYear } from '@/components/PastYearWarning';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  BookOpen, Save, Send, Settings, FileText, Plus, Check, Download, Eye, Lock, Unlock, AlertTriangle
} from 'lucide-react';
import { toast } from "sonner";
import MarksTable from '@/components/marks/MarksTable';
import MobileMarksEntry from '@/components/marks/MobileMarksEntry';
import MarksImportExport from '@/components/marks/MarksImportExport';

import { getSubjectsForClass, getSubjectSourceLabel } from '@/components/subjectHelper';
import { getClassesForYear, getSectionsForClass } from '@/components/classSectionHelper';

const DEFAULT_SUBJECTS = ['Mathematics', 'Science', 'English', 'Hindi', 'Social Studies'];

export default function Marks() {
  const { academicYear } = useAcademicYear();
  const [user, setUser] = useState(null);
  const [schoolProfile, setSchoolProfile] = useState(null);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedExam, setSelectedExam] = useState('');
  const [marksData, setMarksData] = useState({});
  const [saveMode, setSaveMode] = useState('draft'); // 'draft' or 'submit'
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [viewMode, setViewMode] = useState('entry'); // 'entry' or 'review'
  const [reviewSortBy, setReviewSortBy] = useState('rank'); // 'rank', 'name', 'total'
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
   const [showRevokeConfirm, setShowRevokeConfirm] = useState(false);
    const [revokeExamType, setRevokeExamType] = useState(null);
    const [showPastYearWarning, setShowPastYearWarning] = useState(false);
    const [showValidationError, setShowValidationError] = useState(false);
    const [validationError, setValidationError] = useState(null);
    const [showSuccessPopup, setShowSuccessPopup] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
  
  const queryClient = useQueryClient();

  useEffect(() => {
    setUser(getStaffSession());
    base44.entities.SchoolProfile.list().then(profiles => {
      if (profiles.length > 0) setSchoolProfile(profiles[0]);
    }).catch(() => {});
  }, []);

  // Dynamic class/section from SectionConfig (with fallback)
  const { data: classSectionData } = useQuery({
    queryKey: ['classes-for-year', academicYear],
    queryFn: () => getClassesForYear(academicYear),
    enabled: !!academicYear,
    staleTime: 5 * 60 * 1000,
  });
  const availableClasses = classSectionData?.classes || [];

  const { data: sectionData } = useQuery({
    queryKey: ['sections-for-class', academicYear, selectedClass],
    queryFn: () => getSectionsForClass(academicYear, selectedClass),
    enabled: !!academicYear && !!selectedClass,
    staleTime: 5 * 60 * 1000,
  });
  const availableSections = sectionData?.sections || [];

  // Reset section safely when class or available sections change
  useEffect(() => {
    if (availableSections.length > 0 && selectedSection && !availableSections.includes(selectedSection)) {
      setSelectedSection('');
    }
    if (availableSections.length === 1 && !selectedSection) {
      setSelectedSection(availableSections[0]);
    }
  }, [availableSections, selectedSection]);

  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ['students-published', academicYear],
    queryFn: () => base44.entities.Student.filter({ status: 'Published', academic_year: academicYear, is_deleted: false }),
    staleTime: 5 * 60 * 1000
  });

  const { data: examTypes = [], isLoading: examTypesLoading } = useQuery({
    queryKey: ['exam-types', academicYear],
    queryFn: async () => {
      const types = await base44.entities.ExamType.filter({ academic_year: academicYear });
      // Fetch timetable to get exam order
      const timetable = await base44.entities.ExamTimetable.filter({ academic_year: academicYear });
      if (timetable.length === 0) return types;
      // Create a map of exam_type to min date for ordering
      const examDates = {};
      timetable.forEach(t => {
        const key = t.exam_type;
        if (!examDates[key] || new Date(t.exam_date) < new Date(examDates[key])) {
          examDates[key] = t.exam_date;
        }
      });
      // Sort exam types by their schedule date
      return types.sort((a, b) => {
        const dateA = examDates[a.id] || examDates[a.name] || '9999-12-31';
        const dateB = examDates[b.id] || examDates[b.name] || '9999-12-31';
        return new Date(dateA) - new Date(dateB);
      });
    },
    staleTime: 5 * 60 * 1000
  });

  const { data: subjects = [], isLoading: subjectsLoading } = useQuery({
    queryKey: ['class-subjects', academicYear, selectedClass],
    queryFn: async () => {
      if (!selectedClass) {
        console.log('[SUBJECT_CALLSITE] pages/Marks:113');
        return [];
      }
      console.log('[MARKS_PAGE]', { year: academicYear, classRaw: selectedClass });
      const result = await getSubjectsForClass(academicYear, selectedClass);
      console.log('[MARKS_PAGE_RESULT]', { source: result.source, subjects: result.subjects });
      return result.subjects;
    },
    enabled: !!academicYear,
    staleTime: 5 * 60 * 1000
  });

  const { data: timetableEntries = [] } = useQuery({
    queryKey: ['timetable', selectedClass, selectedExam, academicYear],
    queryFn: () => {
      const selectedExamObj = examTypes.find(e => e.name === selectedExam);
      return base44.entities.ExamTimetable.filter({
        class_name: selectedClass,
        exam_type: selectedExamObj?.id || selectedExam,
        academic_year: academicYear
      });
    },
    enabled: !!(selectedClass && selectedExam && academicYear)
  });

  const { data: existingMarks = [] } = useQuery({
    queryKey: ['marks', selectedClass, selectedSection, selectedExam, academicYear],
    queryFn: () => {
      const selectedExamObj = examTypes.find(e => e.name === selectedExam);
      return base44.entities.Marks.filter({
        class_name: selectedClass,
        section: selectedSection,
        exam_type: selectedExamObj?.id || selectedExam,
        academic_year: academicYear
      });
    },
    enabled: !!(selectedClass && selectedSection && selectedExam),
    staleTime: 0,
    refetchOnWindowFocus: true
  });

  // For review mode - fetch marks for the class/section/year directly from DB
  const { data: reviewMarks = [] } = useQuery({
    queryKey: ['reviewMarks', selectedClass, selectedSection, academicYear],
    queryFn: () => base44.entities.Marks.filter({
      class_name: selectedClass,
      section: selectedSection,
      academic_year: academicYear
    }),
    enabled: !!(selectedClass && selectedSection && viewMode === 'review' && academicYear),
    staleTime: 2 * 60 * 1000
  });

  useEffect(() => {
    if (existingMarks.length > 0) {
      const data = {};
      existingMarks.forEach(m => {
        if (!data[m.student_id]) data[m.student_id] = {};
        data[m.student_id][m.subject] = { 
          marks_obtained: m.marks_obtained, 
          id: m.id, 
          status: m.status,
          remarks: m.remarks 
        };
      });
      setMarksData(data);
    } else {
      setMarksData({});
    }
  }, [existingMarks]);

  const filteredStudents = students.filter(s => 
    s.class_name === selectedClass && s.section === selectedSection
  ).sort((a, b) => (a.roll_no || 0) - (b.roll_no || 0));

  // Get subjects from timetable ordered by exam date, fall back to all subjects if no timetable
  const timetableSubjects = timetableEntries.length > 0 
    ? timetableEntries
        .sort((a, b) => new Date(a.exam_date) - new Date(b.exam_date))
        .reduce((acc, t) => {
          if (!acc.includes(t.subject_name)) {
            acc.push(t.subject_name);
          }
          return acc;
        }, [])
    : [];
  
  // subjects is now already an array of strings (names) from getSubjectsForClass
  const subjectList = timetableSubjects.length > 0 
    ? timetableSubjects 
    : (subjects.length > 0 ? subjects : DEFAULT_SUBJECTS);

  const selectedExamType = examTypes.find(e => e.name === selectedExam);
  const maxMarks = selectedExamType?.max_marks || 100;
  const passingMarks = selectedExamType?.min_marks_to_pass || 40;

  const saveMutation = useMutation({
     mutationFn: async () => {
       if (isPastAcademicYear(academicYear) && schoolProfile?.academic_year !== academicYear) {
         throw new Error('PAST_YEAR_WARNING');
       }

       // Validation: check if all students have marks for submit mode
       if (saveMode === 'submit') {
         const missingStudents = filteredStudents.filter(student => {
           const studentMarks = marksData[student.student_id || student.id];
           if (!studentMarks) return true;
           return subjectList.some(subject => {
             const existing = studentMarks[subject];
             return existing?.marks_obtained === undefined || existing.marks_obtained === '';
           });
         });

         if (missingStudents.length > 0) {
           setValidationError({
             missingCount: missingStudents.length,
             missingStudents: missingStudents.slice(0, 10).map(s => s.name || s.student_id)
           });
           setShowValidationError(true);
           throw new Error('VALIDATION_ERROR');
         }
       }

       const promises = [];
       let enteredCount = 0;

       filteredStudents.forEach(student => {
         const studentMarks = marksData[student.student_id || student.id];
         if (!studentMarks) return;

         subjectList.forEach(subject => {
           const existing = studentMarks[subject];
           if (existing?.marks_obtained === undefined || existing.marks_obtained === '') return;

           enteredCount++;
           const marks = parseFloat(existing.marks_obtained);
           const percentage = (marks / maxMarks) * 100;
           let grade = 'F';
           if (percentage >= 90) grade = 'A+';
           else if (percentage >= 80) grade = 'A';
           else if (percentage >= 70) grade = 'B+';
           else if (percentage >= 60) grade = 'B';
           else if (percentage >= 50) grade = 'C';
           else if (percentage >= (selectedExamType?.min_marks_to_pass || passingMarks)) grade = 'D';

           const data = {
             student_id: student.student_id || student.id,
             student_name: student.name,
             class_name: selectedClass,
             section: selectedSection,
             subject: subject,
             exam_type: selectedExamType?.id || selectedExam,
             marks_obtained: marks,
             max_marks: maxMarks,
             grade,
             academic_year: academicYear,
             entered_by: user?.email,
             status: saveMode === 'submit' ? 'Submitted' : 'Draft',
             remarks: existing.remarks
           };

           const backendPromise = base44.functions.invoke('createOrUpdateMarksWithValidation', {
             markData: data,
             markId: existing?.id,
             operation: existing?.id ? 'update' : 'create'
           }).then(res => {
             if (res.status >= 400) {
               throw new Error(res.data?.error || 'Failed to save mark');
             }
             return res.data;
           });

           promises.push(backendPromise);
         });
       });

       if (enteredCount === 0) {
         throw new Error('No marks entered');
       }

       return Promise.all(promises);
     },
     onSuccess: () => {
       queryClient.invalidateQueries(['marks']);
       if (saveMode === 'submit') {
         setSuccessMessage('Marks submitted successfully!');
       } else {
         setSuccessMessage('Marks saved as draft');
       }
       setShowSuccessPopup(true);
       setSaveMode('draft');
       setShowSubmitConfirm(false);
       setTimeout(() => setShowSuccessPopup(false), 3000);
     },
     onError: (error) => {
       if (error.message === 'PAST_YEAR_WARNING') {
         setShowPastYearWarning(true);
       } else if (error.message !== 'VALIDATION_ERROR') {
         toast.error(error.message || 'Failed to save marks');
       }
     }
   });

  const updateMarks = (studentId, subject, value) => {
    setMarksData(prev => ({
      ...prev,
      [studentId]: { 
        ...prev[studentId], 
        [subject]: { ...prev[studentId]?.[subject], marks_obtained: value }
      }
    }));
  };

  const addNewSubject = () => {
    // Subjects are now managed only from Settings → Subjects tab
    toast.info('Please add subjects from Settings → Subjects');
    setShowAddSubject(false);
  };

  const currentStatus = existingMarks[0]?.status || 'Not Entered';
  const isSubmitted = currentStatus === 'Submitted';
  const isPublished = currentStatus === 'Published';
  const isAdmin = ['admin', 'principal'].includes((user?.role || '').toLowerCase());
  const canEdit = currentStatus === 'Not Entered' || currentStatus === 'Draft' || (isSubmitted && isAdmin && !isPublished);
  const canSave = !isPublished;

  const unlockMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('unlockMarksForEditing', {
        marksIds: existingMarks.map(m => m.id),
        className: selectedClass,
        section: selectedSection,
        examType: selectedExamType?.id || selectedExam,
        academicYear
      });
      if (res.status >= 400) {
        throw new Error(res.data?.error || 'Failed to unlock marks');
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['marks']);
      toast.success('Marks unlocked for editing');
    },
    onError: (error) => {
      toast.error('Failed to unlock marks');
    }
  });

  const revokePublicationMutation = useMutation({
    mutationFn: async (examTypeId) => {
      const marksToRevoke = reviewMarks.filter(m => m.exam_type === examTypeId || m.exam_type === revokeExamType);
      const res = await base44.functions.invoke('revokeMarksPublication', {
        marksIds: marksToRevoke.map(m => m.id),
        className: selectedClass,
        section: selectedSection,
        examType: examTypeId || revokeExamType,
        academicYear
      });
      if (res.status >= 400) {
        throw new Error(res.data?.error || 'Failed to revoke publication');
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['reviewMarks']);
      queryClient.invalidateQueries(['marks']);
      toast.success('Publication revoked. Admin can now edit marks.');
      setShowRevokeConfirm(false);
      setRevokeExamType(null);
    },
    onError: (error) => {
      toast.error('Failed to revoke publication');
    }
  });

  // Group marks by exam type for review - get exam name from examTypes
  const reviewGroupedData = React.useMemo(() => {
    let marksToUse = reviewMarks;
    
    // If an exam is selected in review mode, filter to only that exam
    if (selectedExam) {
      const selectedExamObj = examTypes.find(e => e.name === selectedExam);
      const examId = selectedExamObj?.id || selectedExam;
      marksToUse = reviewMarks.filter(m => m.exam_type === examId || m.exam_type === selectedExam);
    }

    const grouped = {};
    marksToUse.forEach(mark => {
      const examTypeId = mark.exam_type;
      if (!grouped[examTypeId]) {
        const examObj = examTypes.find(e => e.id === examTypeId);
        grouped[examTypeId] = {
          exam_type: examTypeId,
          exam_name: examObj?.name || mark.exam_type,
          studentMarks: {}
        };
      }
      if (!grouped[examTypeId].studentMarks[mark.student_id]) {
        const student = filteredStudents.find(s => s.student_id === mark.student_id || s.id === mark.student_id);
        grouped[examTypeId].studentMarks[mark.student_id] = {
          student_id: mark.student_id,
          student_name: mark.student_name,
          roll_no: student?.roll_no,
          subjects: {}
        };
      }
      grouped[examTypeId].studentMarks[mark.student_id].subjects[mark.subject] = mark;
    });

    return Object.values(grouped).map(group => {
      const studentArray = Object.values(group.studentMarks);
      const groupMarks = marksToUse.filter(m => m.exam_type === group.exam_type);
      
      // Get subjects in exact same order as subjectList (entry order)
      const subjects = subjectList.filter(s => 
        groupMarks.some(m => m.subject === s)
      );

      const studentsWithTotals = studentArray.map(student => {
        const total = subjects.reduce((sum, subj) => {
          const mark = student.subjects[subj];
          return sum + (mark ? mark.marks_obtained : 0);
        }, 0);
        return { ...student, total };
      });

      studentsWithTotals.sort((a, b) => b.total - a.total);
      const studentsWithRanks = studentsWithTotals.map((student, idx) => ({
        ...student,
        rank: idx + 1
      }));

      return { ...group, subjects, students: studentsWithRanks };
    });
  }, [reviewMarks, filteredStudents, subjectList, selectedExam, examTypes]);

  const publishMutation = useMutation({
    mutationFn: async (marksIds) => {
      // Route exclusively through backend function (includes audit log creation)
      const groupData = reviewGroupedData.find(g => g.students.flatMap(s => Object.values(s.subjects).map(m => m.id)).some(id => marksIds.includes(id)));
      
      const res = await base44.functions.invoke('publishMarksWithValidation', {
        marksIds,
        examType: groupData?.exam_name || groupData?.exam_type,
        className: selectedClass,
        section: selectedSection,
        academicYear: academicYear
      });

      if (res.status >= 400) {
        throw new Error(res.data?.error || 'Failed to publish marks');
      }
      
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['marks']);
      toast.success('Results published successfully with audit trail');
    }
  });

  const handlePublish = (marksIds) => {
    if (window.confirm('Publish these results? Students will be able to see them.')) {
      publishMutation.mutate(marksIds);
    }
  };

  const handleDownloadExcel = async (examType) => {
    try {
      const group = reviewGroupedData.find(g => g.exam_type === examType);
      if (!group) return;

      const marks = group.students.flatMap(student =>
        Object.values(student.subjects).map(mark => ({
          ...mark,
          student_name: student.student_name,
          rank: student.rank
        }))
      );

      const response = await base44.functions.invoke('exportMarksToExcel', {
        marks,
        className: selectedClass,
        section: selectedSection,
        examType
      });

      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Marks_${selectedClass}_${selectedSection}_${examType}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (error) {
      toast.error('Failed to download Excel');
    }
  };

  return (
    <LoginRequired allowedRoles={['admin', 'principal', 'teacher', 'staff']} pageName="Exams & Marks">
      <div className="min-h-screen bg-slate-50 w-full overflow-x-hidden">
      <PageHeader 
        title={viewMode === 'entry' ? "Enter Marks" : "Review Marks"}
        subtitle={viewMode === 'entry' ? "Enter and manage student marks" : "Review and publish student results"}
      />

      <div className="px-3 sm:px-4 lg:px-8 py-4 space-y-6 max-w-full">

            {/* Mode Toggle - Admin Only */}
            {isAdmin && (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex gap-2">
                    <Button
                      variant={viewMode === 'entry' ? 'default' : 'outline'}
                      onClick={() => setViewMode('entry')}
                      className="gap-2"
                    >
                      <FileText className="h-4 w-4" />
                      Entry
                    </Button>
                    <Button
                      variant={viewMode === 'review' ? 'default' : 'outline'}
                      onClick={() => setViewMode('review')}
                      className="gap-2"
                    >
                      <Eye className="h-4 w-4" />
                      Review & Publish
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Selection */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-3 sm:p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <Select value={selectedClass} onValueChange={(v) => { setSelectedClass(v); setSelectedSection(''); }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Class" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableClasses.map(c => (
                        <SelectItem key={c} value={c}>Class {c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedSection} onValueChange={setSelectedSection} disabled={!selectedClass || availableSections.length === 0}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Section" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSections.map(s => (
                        <SelectItem key={s} value={s}>Section {s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={selectedExam} onValueChange={setSelectedExam}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Exam" />
                    </SelectTrigger>
                    <SelectContent>
                      {examTypes.filter(e => e.is_active !== false).map(e => (
                        <SelectItem key={e.id} value={e.name}>{e.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {viewMode === 'entry' && selectedClass && selectedSection && selectedExam && timetableEntries.length > 0 && (
              <>
                <Card className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div>
                          <h3 className="font-semibold text-base">{selectedExam}</h3>
                          <p className="text-xs text-slate-500">
                            Max Marks: <span className="font-semibold">{maxMarks}</span> | 
                            Pass: <span className="font-semibold">{passingMarks}</span>
                          </p>
                        </div>
                        <StatusBadge status={currentStatus} />
                      </div>
                      <MarksImportExport
                        students={filteredStudents}
                        subjects={subjectList}
                        marksData={marksData}
                        onImport={(importedData) => {
                          setMarksData(prev => ({
                            ...prev,
                            ...Object.entries(importedData).reduce((acc, [stdId, subjectMarks]) => {
                              acc[stdId] = { ...prev[stdId], ...subjectMarks };
                              return acc;
                            }, {})
                          }));
                        }}
                        examInfo={{ exam: selectedExam }}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-0 shadow-sm">
                   <CardContent className="p-4">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="font-semibold">Subject Columns</h3>
                        {viewMode === 'entry' && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="gap-2"
                            onClick={() => setShowAddSubject(true)}
                          >
                            <Plus className="h-4 w-4" />
                            Add Subject
                          </Button>
                        )}
                      </div>
                      {isPublished && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-4 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-red-900 flex items-center gap-2">
                              <Lock className="h-4 w-4" /> Marks Published
                            </p>
                            <p className="text-xs text-red-700 mt-1">Published marks cannot be edited. Admin must revoke publication first.</p>
                          </div>
                          {isAdmin && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                setRevokeExamType(selectedExamType?.id || selectedExam);
                                setShowRevokeConfirm(true);
                              }}
                              className="whitespace-nowrap"
                            >
                              Revoke Publication
                            </Button>
                          )}
                        </div>
                      )}

                      {isSubmitted && !isPublished && !isAdmin && (
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-4 text-center">
                          <p className="text-sm font-medium text-blue-900">✓ Marks Submitted</p>
                          <p className="text-xs text-blue-700 mt-1">Editing is not allowed for submitted marks</p>
                        </div>
                      )}

                      {isSubmitted && !isPublished && isAdmin && (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-4 flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-amber-900">✓ Marks Submitted</p>
                            <p className="text-xs text-amber-700 mt-1">These marks are locked. Click unlock to allow editing.</p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => unlockMutation.mutate()}
                            disabled={unlockMutation.isPending}
                            className="whitespace-nowrap"
                          >
                            {unlockMutation.isPending ? 'Unlocking...' : 'Unlock for Editing'}
                          </Button>
                        </div>
                      )}

                      {/* Desktop Table View */}
                      <div className="hidden md:block">
                        <MarksTable
                          students={filteredStudents}
                          subjects={subjectList}
                          marksData={marksData}
                          onMarkChange={canEdit ? updateMarks : undefined}
                          maxMarks={maxMarks}
                          passingMarks={passingMarks}
                          isLocked={!canEdit}
                        />
                      </div>
                      {/* Mobile Subject Tabs View */}
                      <div className="md:hidden">
                        <MobileMarksEntry
                          students={filteredStudents}
                          subjects={subjectList}
                          marksData={marksData}
                          onMarkChange={canEdit ? updateMarks : undefined}
                          maxMarks={maxMarks}
                          passingMarks={passingMarks}
                          isLocked={!canEdit}
                        />
                      </div>
                    </CardContent>
                  </Card>

                {filteredStudents.length > 0 && canSave && (
                   <div className="flex justify-end gap-3">
                     <Button 
                       variant="outline"
                       onClick={() => {
                         setSaveMode('draft');
                         saveMutation.mutate();
                       }}
                       disabled={saveMutation.isPending || !canEdit}
                       className="gap-2"
                     >
                       <FileText className="h-4 w-4" />
                       {saveMutation.isPending ? 'Saving...' : 'Save as Draft'}
                     </Button>
                     <Button 
                       onClick={() => {
                         if (!canEdit) {
                           toast.error('Cannot submit. Marks are locked.');
                           return;
                         }
                         setShowSubmitConfirm(true);
                       }}
                       disabled={saveMutation.isPending || !canEdit}
                       className="gap-2"
                     >
                       <Send className="h-4 w-4" />
                       {saveMutation.isPending ? 'Submitting...' : 'Submit Marks'}
                     </Button>
                   </div>
                 )}
              </>
            )}

            {viewMode === 'review' && selectedClass && selectedSection ? (
              reviewGroupedData.length > 0 ? (
                <div className="space-y-4">
                  {reviewGroupedData.map((group, idx) => {
                    const allMarkIds = group.students.flatMap(s => 
                      Object.values(s.subjects).map(m => m.id)
                    );
                    return (
                      <Card key={idx} className="border-0 shadow-sm overflow-hidden">
                        <div className="bg-gradient-to-r from-[#1a237e] to-[#283593] px-4 py-3">
                          <h3 className="text-white font-semibold flex items-center justify-between">
                            <span>{group.exam_name || group.exam_type}</span>
                            <span className="text-sm">({group.students.length} students)</span>
                          </h3>
                        </div>
                        <CardContent className="p-4 space-y-4">
                           <div className="flex gap-2 mb-4">
                            <Button
                              variant={reviewSortBy === 'rank' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setReviewSortBy('rank')}
                            >
                              Sort by Rank
                            </Button>
                            <Button
                              variant={reviewSortBy === 'name' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setReviewSortBy('name')}
                            >
                              Sort by Name
                            </Button>
                            <Button
                              variant={reviewSortBy === 'total' ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setReviewSortBy('total')}
                            >
                              Sort by Total
                            </Button>
                          </div>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-slate-200 bg-slate-50">
                                  <th className="text-center p-2 font-semibold text-slate-700 w-16">Roll No</th>
                                  <th className="text-left p-2 font-semibold text-slate-700 w-16">Rank</th>
                                  <th className="text-left p-2 font-semibold text-slate-700 min-w-40">Student Name</th>
                                  {group.subjects.map(subject => (
                                    <th key={subject} className="text-center p-2 font-semibold text-slate-700 min-w-24">
                                      {subject}
                                    </th>
                                  ))}
                                  <th className="text-center p-2 font-semibold text-slate-700 w-20">Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(() => {
                                  let sorted = [...group.students];
                                  if (reviewSortBy === 'name') {
                                    sorted.sort((a, b) => a.student_name.localeCompare(b.student_name));
                                  } else if (reviewSortBy === 'total') {
                                    sorted.sort((a, b) => b.total - a.total);
                                  }
                                  return sorted.map((student) => (
                                    <tr key={student.student_id} className="border-b border-slate-100 hover:bg-slate-50">
                                      <td className="text-center p-2 text-slate-700">{student.roll_no || '-'}</td>
                                      <td className="p-2 font-semibold text-slate-700">{student.rank}</td>
                                      <td className="p-2">{student.student_name}</td>
                                      {group.subjects.map(subject => {
                                        const mark = student.subjects[subject];
                                        return (
                                          <td key={subject} className="text-center p-2">
                                            {mark ? mark.marks_obtained : '-'}
                                          </td>
                                        );
                                      })}
                                      <td className="text-center p-2 font-semibold text-slate-700">{student.total}</td>
                                    </tr>
                                  ));
                                })()}
                              </tbody>
                            </table>
                          </div>
                          <div className="flex flex-wrap gap-2 pt-2 items-center">
                            {group.students.length > 0 && Object.values(group.students[0].subjects).length > 0 && Object.values(group.students[0].subjects)[0].status === 'Published' ? (
                              <StatusBadge status="Published" />
                            ) : (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDownloadExcel(group.exam_type)}
                                  className="gap-2"
                                >
                                  <Download className="h-4 w-4" />
                                  Export to Excel
                                </Button>
                                <Button
                                  onClick={() => handlePublish(allMarkIds)}
                                  disabled={publishMutation.isPending}
                                  className="bg-green-600 hover:bg-green-700 gap-2"
                                  size="sm"
                                >
                                  <Check className="h-4 w-4" />
                                  {publishMutation.isPending ? 'Publishing...' : 'Publish Results'}
                                </Button>
                              </>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card className="border-0 shadow-sm">
                  <CardContent className="py-16 text-center">
                    <Eye className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-700">No marks to review</h3>
                    <p className="text-slate-500 mt-2">No submitted marks for this class and section</p>
                  </CardContent>
                </Card>
              )
            ) : viewMode === 'review' ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-16 text-center">
                  <Eye className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-700">Select Class & Section</h3>
                  <p className="text-slate-500 mt-2">Choose a class and section to review marks</p>
                </CardContent>
              </Card>
            ) : (!selectedClass || !selectedSection || !selectedExam) && (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-16 text-center">
                  <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-700">Select Options</h3>
                  <p className="text-slate-500 mt-2">Choose class, section and exam type to enter marks</p>
                </CardContent>
              </Card>
            )}

            {viewMode === 'entry' && selectedClass && selectedSection && selectedExam && timetableEntries.length === 0 && (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-16 text-center">
                  <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-700">No Timetable Created</h3>
                  <p className="text-slate-500 mt-2">Timetable must be created for this class and exam before entering marks</p>
                </CardContent>
              </Card>
            )}
      </div>

      {/* Add Subject Info - Moved to Settings */}
      <Dialog open={showAddSubject} onOpenChange={setShowAddSubject}>
      <DialogContent>
      <DialogHeader>
      <DialogTitle>Add Subjects in Settings</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
      <p className="text-sm text-slate-600">
      Subjects are managed in <strong>Settings → Subjects</strong>. Please navigate to Settings to add or edit subjects.
      </p>
      <Button 
      onClick={() => {
      setShowAddSubject(false);
      window.location.href = createPageUrl('Settings') + '?tab=subjects';
      }}
      className="w-full"
      >
      Go to Settings → Subjects
      </Button>
      <Button variant="outline" onClick={() => setShowAddSubject(false)}>
      Close
      </Button>
      </div>
      </DialogContent>
      </Dialog>

      {/* Submit Marks Confirmation Dialog */}
      <AlertDialog open={showSubmitConfirm} onOpenChange={setShowSubmitConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirm Mark Submission
            </AlertDialogTitle>
            <AlertDialogDescription>
              Once submitted, marks cannot be edited unless Admin grants permission.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setSaveMode('submit');
                saveMutation.mutate();
              }}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              Submit Marks
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revoke Publication Dialog */}
       <AlertDialog open={showRevokeConfirm} onOpenChange={setShowRevokeConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Revoke Publication
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will revert published marks to Verified status, allowing you to make edits. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                revokePublicationMutation.mutate(revokeExamType);
              }}
              disabled={revokePublicationMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {revokePublicationMutation.isPending ? 'Revoking...' : 'Revoke Publication'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Validation Error Modal */}
      <AlertDialog open={showValidationError} onOpenChange={setShowValidationError}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Cannot Submit - Missing Marks
            </AlertDialogTitle>
            <AlertDialogDescription>
              {validationError?.missingCount} student{validationError?.missingCount !== 1 ? 's' : ''} {validationError?.missingCount === 1 ? 'is' : 'are'} missing marks:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-40 overflow-y-auto">
              <ul className="text-sm text-red-700 space-y-1">
                {validationError?.missingStudents?.map((name, idx) => (
                  <li key={idx}>• {name}</li>
                ))}
              </ul>
              {validationError?.missingCount > 10 && (
                <p className="text-xs text-red-600 mt-2">...and {validationError.missingCount - 10} more</p>
              )}
            </div>
            <AlertDialogCancel className="w-full">Close</AlertDialogCancel>
          </div>
        </AlertDialogContent>
      </AlertDialog>

      {/* Past Year Warning */}
      <PastYearWarning
        open={showPastYearWarning}
        academicYear={academicYear}
        onConfirm={() => {
          setShowPastYearWarning(false);
          saveMutation.mutate();
        }}
        onCancel={() => setShowPastYearWarning(false)}
      />

      </div>
      </LoginRequired>
      );
      }