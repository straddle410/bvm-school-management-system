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
  BookOpen, Plus, Save, Send, Settings
} from 'lucide-react';
import { toast } from "sonner";

const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
const SECTIONS = ['A'];
const DEFAULT_SUBJECTS = ['Mathematics', 'Science', 'English', 'Hindi', 'Social Studies'];

export default function Marks() {
  const { academicYear } = useAcademicYear();
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('entry');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('A');
  const [selectedExam, setSelectedExam] = useState('');
  const [marksData, setMarksData] = useState({});
  const [showExamDialog, setShowExamDialog] = useState(false);
  const [examForm, setExamForm] = useState({ name: '', max_marks: 100, passing_marks: 33 });
  
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
    queryFn: () => base44.entities.Subject.list(),
    staleTime: 5 * 60 * 1000
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

  const selectedExamType = examTypes.find(e => e.name === selectedExam);
  const maxMarks = selectedExamType?.max_marks || 100;
  const passingMarks = selectedExamType?.passing_marks || 33;

  const createExamMutation = useMutation({
    mutationFn: (data) => base44.entities.ExamType.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['exam-types']);
      setShowExamDialog(false);
      setExamForm({ name: '', max_marks: 100, passing_marks: 33 });
      toast.success('Exam type created');
    }
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const promises = [];
      filteredStudents.forEach(student => {
        const studentMarks = marksData[student.student_id || student.id];
        if (!studentMarks) return;
        
        subjectList.forEach(subject => {
          const existing = studentMarks[subject];
          if (existing?.marks_obtained === undefined) return;
          
          const marks = parseFloat(existing.marks_obtained);
          const percentage = (marks / maxMarks) * 100;
          let grade = 'F';
          if (percentage >= 90) grade = 'A+';
          else if (percentage >= 80) grade = 'A';
          else if (percentage >= 70) grade = 'B+';
          else if (percentage >= 60) grade = 'B';
          else if (percentage >= 50) grade = 'C';
          else if (percentage >= passingMarks) grade = 'D';

          const data = {
            student_id: student.student_id || student.id,
            student_name: student.name,
            class_name: selectedClass,
            section: selectedSection,
            subject: subject,
            exam_type: selectedExam,
            marks_obtained: marks,
            max_marks: maxMarks,
            grade,
            academic_year: academicYear,
            entered_by: user?.email,
            status: 'Submitted',
            remarks: existing.remarks
          };
          
          if (existing?.id) {
            promises.push(base44.entities.Marks.update(existing.id, data));
          } else {
            promises.push(base44.entities.Marks.create(data));
          }
        });
      });
      return Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['marks']);
      toast.success('Marks saved successfully');
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

  const subjectList = subjects.length > 0 ? subjects.map(s => s.name) : DEFAULT_SUBJECTS;
  const currentStatus = existingMarks[0]?.status || 'Not Entered';

  return (
    <LoginRequired allowedRoles={['admin', 'principal', 'teacher', 'staff']} pageName="Exams & Marks">
      <div className="min-h-screen bg-slate-50">
      <PageHeader 
        title="Exams & Marks"
        subtitle="Manage exam types and enter marks"
        actions={
          <Button onClick={() => setShowExamDialog(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Exam Type
          </Button>
        }
      />

      <div className="p-4 lg:p-8 space-y-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white border shadow-sm">
            <TabsTrigger value="entry">Enter Marks</TabsTrigger>
            <TabsTrigger value="exams">Exam Types</TabsTrigger>
          </TabsList>

          <TabsContent value="entry" className="mt-6 space-y-6">
            {/* Selection */}
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <h3 className="font-semibold text-lg">
                      {selectedExam} - All Subjects
                    </h3>
                    <span className="text-slate-500">Max: {maxMarks} | Pass: {passingMarks}</span>
                    <StatusBadge status={currentStatus} />
                  </div>
                </div>

                <Card className="border-0 shadow-sm overflow-x-auto">
                  <CardContent className="p-0">
                    {filteredStudents.length === 0 ? (
                      <div className="py-12 text-center text-slate-400">
                        No students found in this class
                      </div>
                    ) : (
                      <div className="min-w-max">
                        {/* Header */}
                        <div className="flex bg-slate-100 border-b sticky left-0 z-10">
                          <div className="w-16 px-4 py-3 flex items-center text-sm font-semibold text-slate-600">Roll</div>
                          <div className="w-48 px-4 py-3 flex items-center text-sm font-semibold text-slate-600">Name</div>
                          {subjectList.map(subject => (
                            <div key={subject} className="w-28 px-2 py-3 text-center text-sm font-semibold text-slate-600">
                              {subject}
                            </div>
                          ))}
                        </div>
                        
                        {/* Student Rows */}
                        <div className="divide-y">
                          {filteredStudents.map((student, index) => (
                            <div key={student.id} className="flex">
                              <div className="w-16 px-4 py-3 text-sm text-slate-400">
                                {student.roll_no || index + 1}
                              </div>
                              <div className="w-48 px-4 py-3 flex items-center gap-2 text-sm">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={student.photo_url} />
                                  <AvatarFallback className="bg-blue-100 text-blue-700 text-xs">
                                    {student.name?.[0]}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <p className="font-medium text-slate-900 truncate">{student.name}</p>
                                  <p className="text-xs text-slate-500">{student.student_id}</p>
                                </div>
                              </div>
                              {subjectList.map(subject => {
                                const marks = marksData[student.student_id || student.id]?.[subject]?.marks_obtained;
                                const isPassing = marks !== undefined && marks >= passingMarks;
                                return (
                                  <div 
                                    key={subject}
                                    className={`w-28 px-2 py-3 flex items-center justify-center ${
                                      marks !== undefined ? (isPassing ? 'bg-green-50/50' : 'bg-red-50/50') : ''
                                    }`}
                                  >
                                    <div className="flex items-center gap-1">
                                      <Input
                                        type="number"
                                        min="0"
                                        max={maxMarks}
                                        value={marks ?? ''}
                                        onChange={(e) => updateMarks(student.student_id || student.id, subject, e.target.value)}
                                        className="w-16 text-center text-sm h-8"
                                        placeholder="0"
                                      />
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {filteredStudents.length > 0 && (
                  <div className="flex justify-end">
                    <Button 
                      onClick={() => saveMutation.mutate()}
                      disabled={saveMutation.isPending}
                    >
                      <Save className="mr-2 h-4 w-4" />
                      {saveMutation.isPending ? 'Saving...' : 'Save & Submit'}
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
          </TabsContent>

          <TabsContent value="exams" className="mt-6">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle>Exam Types</CardTitle>
              </CardHeader>
              <CardContent>
                {examTypes.length === 0 ? (
                  <div className="py-12 text-center text-slate-400">
                    No exam types created yet
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {examTypes.map(exam => (
                      <Card key={exam.id} className="p-4 bg-slate-50 border-0">
                        <div className="flex items-start justify-between">
                          <div>
                            <h4 className="font-semibold">{exam.name}</h4>
                            <p className="text-sm text-slate-500 mt-1">
                              Max: {exam.max_marks} | Pass: {exam.passing_marks}
                            </p>
                          </div>
                          <StatusBadge status={exam.status} />
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showExamDialog} onOpenChange={setShowExamDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Exam Type</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            createExamMutation.mutate({...examForm, status: 'Draft'});
          }} className="space-y-4">
            <div>
              <Label>Exam Name</Label>
              <Input
                value={examForm.name}
                onChange={(e) => setExamForm({...examForm, name: e.target.value})}
                placeholder="e.g., Unit Test 1"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Maximum Marks</Label>
                <Input
                  type="number"
                  value={examForm.max_marks}
                  onChange={(e) => setExamForm({...examForm, max_marks: parseInt(e.target.value)})}
                />
              </div>
              <div>
                <Label>Passing Marks</Label>
                <Input
                  type="number"
                  value={examForm.passing_marks}
                  onChange={(e) => setExamForm({...examForm, passing_marks: parseInt(e.target.value)})}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={() => setShowExamDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createExamMutation.isPending}>
                {createExamMutation.isPending ? 'Creating...' : 'Create Exam Type'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
    </LoginRequired>
  );
}