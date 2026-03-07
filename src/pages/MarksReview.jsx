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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, Eye, Check } from 'lucide-react';
import { toast } from "sonner";
import { getClassesForYear, getSectionsForClass } from '@/components/classSectionHelper';

export default function MarksReview() {
  const { academicYear } = useAcademicYear();
  const [user, setUser] = useState(null);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [availableClasses, setAvailableClasses] = useState([]);
  const [availableSections, setAvailableSections] = useState([]);
  const [selectedExamType, setSelectedExamType] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  const queryClient = useQueryClient();

  useEffect(() => {
    const staffUser = getStaffSession();
    setUser(staffUser);
    const role = (staffUser?.role || '').toLowerCase();
    setIsAdmin(role === 'admin' || role === 'principal');
  }, []);

  useEffect(() => {
    if (!academicYear) return;
    getClassesForYear(academicYear).then(result => {
      setAvailableClasses(Array.isArray(result) ? result : (result?.classes ?? []));
    });
  }, [academicYear]);

  useEffect(() => {
    if (!selectedClass || !academicYear) { setAvailableSections([]); setSelectedSection(''); return; }
    getSectionsForClass(academicYear, selectedClass).then(result => {
      const secs = Array.isArray(result) ? result : (result?.sections ?? []);
      setAvailableSections(secs);
      if (secs.length === 1) setSelectedSection(secs[0]);
      else setSelectedSection('');
    });
  }, [selectedClass, academicYear]);

  // Fetch exam types
  const { data: examTypes = [] } = useQuery({
    queryKey: ['exam-types', academicYear],
    queryFn: () => base44.entities.ExamType.filter({ academic_year: academicYear })
  });

  // Fetch submitted and published marks
    const { data: submittedMarks = [] } = useQuery({
      queryKey: ['marks-submitted', selectedClass, selectedSection, selectedExamType, academicYear],
      queryFn: async () => {
        const filter = {
          status: { $in: ['Submitted', 'Verified', 'Approved', 'Published'] },
          academic_year: academicYear
        };
        if (selectedClass) filter.class_name = selectedClass;
        if (selectedSection) filter.section = selectedSection;
        if (selectedExamType) {
          const examTypeObj = examTypes.find(e => e.name === selectedExamType);
          filter.exam_type = examTypeObj?.id || selectedExamType;
        }
        return base44.entities.Marks.filter(filter);
      },
      enabled: !!(selectedClass && selectedSection)
    });

  // Group marks by exam type
   const groupedData = React.useMemo(() => {
     const grouped = {};
     submittedMarks.forEach(mark => {
       if (!grouped[mark.exam_type]) {
         grouped[mark.exam_type] = {
           exam_type: mark.exam_type,
           studentMarks: {}
         };
       }
       if (!grouped[mark.exam_type].studentMarks[mark.student_id]) {
         grouped[mark.exam_type].studentMarks[mark.student_id] = {
           student_id: mark.student_id,
           student_name: mark.student_name,
           subjects: {}
         };
       }
       grouped[mark.exam_type].studentMarks[mark.student_id].subjects[mark.subject] = mark;
     });
     return Object.values(grouped).map(group => {
       const studentArray = Object.values(group.studentMarks);
       const subjects = [...new Set(submittedMarks.filter(m => m.exam_type === group.exam_type).map(m => m.subject))];

       // Calculate totals and ranks
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
   }, [submittedMarks]);

  const publishMutation = useMutation({
    mutationFn: async ({ marksIds, group }) => {
      const res = await base44.functions.invoke('publishMarksWithValidation', {
        marksIds,
        examType: group.exam_type,
        className: selectedClass,
        section: selectedSection,
        academicYear
      });
      if (res.status >= 400) throw new Error(res.data?.error || 'Failed to publish marks');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['marks-submitted']);
      toast.success('Results published successfully');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to publish marks');
    }
  });

   const handleDownloadExcel = async (examType) => {
     try {
       const group = groupedData.find(g => g.exam_type === examType);
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



  const handlePublish = (marksIds, group) => {
    if (window.confirm('Publish these results? Students will be able to see them.')) {
      publishMutation.mutate({ marksIds, group });
    }
  };

  if (!isAdmin) {
    return (
      <LoginRequired allowedRoles={['admin']} pageName="Marks Review">
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-slate-700">Access Denied</h2>
            <p className="text-slate-500 mt-2">Only admins can access this page</p>
          </div>
        </div>
      </LoginRequired>
    );
  }

  return (
    <LoginRequired allowedRoles={['admin']} pageName="Marks Review">
      <div className="min-h-screen bg-slate-50">
        <PageHeader 
          title="Review Marks"
          subtitle="Review and publish student results"
        />

        <div className="p-4 lg:p-8 space-y-6">
          {/* Filters */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
                <Select value={selectedExamType} onValueChange={setSelectedExamType} disabled={!selectedClass || !selectedSection}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Exam Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>All Exam Types</SelectItem>
                    {examTypes.map(exam => (
                      <SelectItem key={exam.id} value={exam.name}>{exam.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Results */}
          {selectedClass && selectedSection ? (
            groupedData.length > 0 ? (
              <div className="space-y-4">
                {groupedData.map((group, idx) => {
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
                        {/* Table */}
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

                        {/* Actions */}
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
                                 onClick={() => handlePublish(allMarkIds, group)}
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
          ) : (
            <Card className="border-0 shadow-sm">
              <CardContent className="py-16 text-center">
                <Eye className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-700">Select Class & Section</h3>
                <p className="text-slate-500 mt-2">Choose a class and section to review marks</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </LoginRequired>
  );
}