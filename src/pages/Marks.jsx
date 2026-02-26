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
  BookOpen, Save, Send, Settings, FileText, Plus
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
    queryFn: () => base44.entities.ExamType.filter({ academic_year: academicYear }),
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

  // Get subjects from timetable for this exam/class, fall back to all subjects if no timetable
  const timetableSubjects = timetableEntries.length > 0 
    ? [...new Set(timetableEntries.map(t => t.subject_name))]
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
            exam_type: selectedExamObj?.id || selectedExam,
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

  return (
    <LoginRequired allowedRoles={['admin', 'principal', 'teacher', 'staff']} pageName="Exams & Marks">
      <div className="min-h-screen bg-slate-50 w-full overflow-x-hidden">
      <PageHeader 
        title="Enter Marks"
        subtitle="Enter and manage student marks"
      />

      <div className="px-3 sm:px-4 lg:px-8 py-4 space-y-6 max-w-full">
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

            {selectedClass && selectedSection && selectedExam && (
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
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="gap-2"
                          onClick={() => setShowAddSubject(true)}
                        >
                          <Plus className="h-4 w-4" />
                          Add Subject
                        </Button>
                      </div>
                      {/* Desktop Table View */}
                      <div className="hidden md:block">
                        <MarksTable
                          students={filteredStudents}
                          subjects={subjectList}
                          marksData={marksData}
                          onMarkChange={updateMarks}
                          maxMarks={maxMarks}
                          passingMarks={passingMarks}
                        />
                      </div>
                      {/* Mobile Subject Tabs View */}
                      <div className="md:hidden">
                        <MobileMarksEntry
                          students={filteredStudents}
                          subjects={subjectList}
                          marksData={marksData}
                          onMarkChange={updateMarks}
                          maxMarks={maxMarks}
                          passingMarks={passingMarks}
                        />
                      </div>
                    </CardContent>
                  </Card>

                {filteredStudents.length > 0 && (
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

            {(!selectedClass || !selectedSection || !selectedExam) && (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-16 text-center">
                  <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-700">Select Options</h3>
                  <p className="text-slate-500 mt-2">Choose class, section and exam type to enter marks</p>
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