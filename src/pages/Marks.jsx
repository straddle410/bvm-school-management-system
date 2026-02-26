import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import LoginRequired from '@/components/LoginRequired';
import { getStaffSession } from '@/components/useStaffSession';
import { useAcademicYear } from '@/components/AcademicYearContext';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  BookOpen, Save, Send, Settings, FileText, Plus, Check, Download, Eye
} from 'lucide-react';
import { toast } from "sonner";
import MarksTable from '@/components/marks/MarksTable';
import MobileMarksEntry from '@/components/marks/MobileMarksEntry';
import MarksImportExport from '@/components/marks/MarksImportExport';

const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
const SECTIONS = ['A'];
const DEFAULT_SUBJECTS = ['Mathematics', 'Science', 'English', 'Hindi', 'Social Studies'];

export default function Marks() {
  const { academicYear } = useAcademicYear();
  const [user, setUser] = useState(null);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('A');
  const [selectedExam, setSelectedExam] = useState('');
  const [marksData, setMarksData] = useState({});
  const [saveMode, setSaveMode] = useState('draft'); // 'draft' or 'submit'
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [viewMode, setViewMode] = useState('entry'); // 'entry' or 'review'
  const [reviewSortBy, setReviewSortBy] = useState('rank'); // 'rank', 'name', 'total'
  
  const queryClient = useQueryClient();

  useEffect(() => {
    setUser(getStaffSession());
  }, []);

  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ['students-published', academicYear],
    queryFn: () => base44.entities.Student.filter({ status: 'Published', academic_year: academicYear }),
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
    queryKey: ['subjects'],
    queryFn: async () => {
      const subs = await base44.entities.Subject.list();
      return subs.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
    },
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
  
  const subjectList = timetableSubjects.length > 0 
    ? timetableSubjects 
    : (subjects.length > 0 ? subjects.map(s => s.name) : DEFAULT_SUBJECTS);

  const selectedExamType = examTypes.find(e => e.name === selectedExam);
  const maxMarks = selectedExamType?.max_marks || 100;
  const passingMarks = selectedExamType?.min_marks_to_pass || 40;

  const saveMutation = useMutation({
    mutationFn: async () => {
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
          
          if (existing?.id) {
            promises.push(base44.entities.Marks.update(existing.id, data));
          } else {
            promises.push(base44.entities.Marks.create(data));
          }
        });
      });

      if (enteredCount === 0) {
        throw new Error('No marks entered');
      }

      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['marks']);
      const message = saveMode === 'submit' 
        ? 'Marks submitted successfully' 
        : 'Marks saved as draft';
      toast.success(message);
      setSaveMode('draft');
    },
    onError: (error) => {
      toast.error(error.message || 'Failed to save marks');
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

  const addNewSubject = async () => {
    if (!newSubjectName.trim()) {
      toast.error('Please enter subject name');
      return;
    }

    try {
      await base44.entities.Subject.create({ name: newSubjectName.trim() });
      queryClient.invalidateQueries(['subjects']);
      toast.success(`${newSubjectName} added successfully`);
      setNewSubjectName('');
      setShowAddSubject(false);
    } catch (error) {
      toast.error('Failed to add subject');
    }
  };

  const currentStatus = existingMarks[0]?.status || 'Not Entered';
  const isSubmitted = currentStatus === 'Submitted';
  const isAdmin = user?.role?.toLowerCase() === 'admin' || user?.role?.toLowerCase() === 'principal';
  const canEdit = !isSubmitted || isAdmin;

  const unlockMutation = useMutation({
    mutationFn: async () => {
      const promises = existingMarks.map(mark => 
        base44.entities.Marks.update(mark.id, { status: 'Draft' })
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['marks']);
      toast.success('Marks unlocked for editing');
    },
    onError: (error) => {
      toast.error('Failed to unlock marks');
    }
  });

  // Group marks by exam type for review
  const reviewGroupedData = React.useMemo(() => {
    const marks = existingMarks.filter(m => 
      m.status !== 'Draft' && 
      m.class_name === selectedClass && 
      m.section === selectedSection
    );

    const grouped = {};
    marks.forEach(mark => {
      const examTypeId = mark.exam_type;
      if (!grouped[examTypeId]) {
        grouped[examTypeId] = {
          exam_type: examTypeId,
          exam_name: mark.exam_type,
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
      const groupMarks = marks.filter(m => m.exam_type === group.exam_type);
      
      // Get subjects in same order as subjectList
      const subjects = subjectList.filter(s => 
        groupMarks.some(m => m.subject === s)
      );

      const studentsWithTotals = studentArray.map(student => {
        const total = Object.values(student.subjects).reduce((sum, mark) => sum + mark.marks_obtained, 0);
        return { ...student, total };
      });

      studentsWithTotals.sort((a, b) => b.total - a.total);
      const studentsWithRanks = studentsWithTotals.map((student, idx) => ({
        ...student,
        rank: idx + 1
      }));

      return { ...group, subjects, students: studentsWithRanks };
    });
  }, [existingMarks, selectedClass, selectedSection, filteredStudents, subjectList]);

  const publishMutation = useMutation({
    mutationFn: async (marksIds) => {
      const promises = marksIds.map(id =>
        base44.entities.Marks.update(id, { status: 'Published', verified_by: user?.email, approved_by: user?.email })
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['marks']);
      toast.success('Results published successfully');
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
                  <Select value={selectedClass} onValueChange={setSelectedClass}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Class" />
                    </SelectTrigger>
                    <SelectContent>
                      {CLASSES.map(c => (
                        <SelectItem key={c} value={c}>Class {c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedSection} onValueChange={setSelectedSection}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select Section" />
                    </SelectTrigger>
                    <SelectContent>
                      {SECTIONS.map(s => (
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
                      {isSubmitted && !isAdmin && (
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-4 text-center">
                          <p className="text-sm font-medium text-blue-900">✓ Marks Submitted</p>
                          <p className="text-xs text-blue-700 mt-1">Editing is not allowed for submitted marks</p>
                        </div>
                      )}

                      {isSubmitted && isAdmin && (
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

                {filteredStudents.length > 0 && canEdit && (
                   <div className="flex justify-end gap-3">
                     <Button 
                       variant="outline"
                       onClick={() => {
                         setSaveMode('draft');
                         saveMutation.mutate();
                       }}
                       disabled={saveMutation.isPending}
                       className="gap-2"
                     >
                       <FileText className="h-4 w-4" />
                       {saveMutation.isPending ? 'Saving...' : 'Save as Draft'}
                     </Button>
                     <Button 
                       onClick={() => {
                         setSaveMode('submit');
                         saveMutation.mutate();
                       }}
                       disabled={saveMutation.isPending}
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
                            <span>{group.exam_type}</span>
                            <span className="text-sm">({group.students.length} students)</span>
                          </h3>
                        </div>
                        <CardContent className="p-4 space-y-4">
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-slate-200 bg-slate-50">
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
                                {group.students.map((student) => (
                                  <tr key={student.student_id} className="border-b border-slate-100 hover:bg-slate-50">
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
                                ))}
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

      {/* Add Subject Dialog */}
      <Dialog open={showAddSubject} onOpenChange={setShowAddSubject}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Subject</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="subjectName">Subject Name</Label>
              <Input
                id="subjectName"
                placeholder="e.g., Computer Science"
                value={newSubjectName}
                onChange={(e) => setNewSubjectName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addNewSubject()}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowAddSubject(false)}>
                Cancel
              </Button>
              <Button onClick={addNewSubject}>
                Add Subject
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
    </LoginRequired>
  );
}