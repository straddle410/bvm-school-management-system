import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, GraduationCap, BookOpen } from 'lucide-react';

const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const SECTIONS = ['A', 'B', 'C', 'D'];

const gradeColor = (grade) => {
  const map = {
    'A+': 'bg-green-100 text-green-700',
    'A': 'bg-emerald-100 text-emerald-700',
    'B+': 'bg-blue-100 text-blue-700',
    'B': 'bg-sky-100 text-sky-700',
    'C': 'bg-yellow-100 text-yellow-700',
    'D': 'bg-orange-100 text-orange-700',
    'F': 'bg-red-100 text-red-700',
  };
  return map[grade] || 'bg-slate-100 text-slate-700';
};

export default function Results() {
  const [filterClass, setFilterClass] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [rollInput, setRollInput] = useState('');
  const [filterExam, setFilterExam] = useState('');
  const [searched, setSearched] = useState(false);
  const [studentResult, setStudentResult] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [resultsByExam, setResultsByExam] = useState({});

  const { data: examTypes = [] } = useQuery({
    queryKey: ['exam-types-published'],
    queryFn: () => base44.entities.ExamType.filter({ status: 'Published' })
  });

  // Load students when class+section is selected
  const { data: classStudents = [] } = useQuery({
    queryKey: ['students-class-section', filterClass, filterSection],
    queryFn: () => base44.entities.Student.filter({ class_name: filterClass, section: filterSection }),
    enabled: !!(filterClass && filterSection)
  });

  const handleSearch = async () => {
    setIsSearching(true);
    setSearched(false);
    setStudentResult(null);

    // Determine the student to search
    let studentId = selectedStudentId;
    if (!studentId && rollInput.trim()) {
      studentId = rollInput.trim();
    }

    const filter = { status: 'Published' };
    if (studentId) filter.student_id = studentId;
    if (filterExam) filter.exam_type = filterExam;

    const marks = await base44.entities.Marks.filter(filter);
    setSearched(true);
    setIsSearching(false);

    if (marks.length > 0) {
      const m = marks[0];

      // Group marks by exam type
      const grouped = {};
      marks.forEach(mark => {
        if (!grouped[mark.exam_type]) {
          grouped[mark.exam_type] = [];
        }
        grouped[mark.exam_type].push(mark);
      });

      setResultsByExam(grouped);
      setStudentResult({
        student_id: m.student_id,
        student_name: m.student_name,
        class_name: m.class_name,
        section: m.section
      });
    } else {
      setStudentResult(null);
      setResultsByExam({});
    }
  };

  const getPercentage = (marks) => {
    const total = marks.reduce((s, m) => s + m.marks_obtained, 0);
    const max = marks.reduce((s, m) => s + m.max_marks, 0);
    return max > 0 ? Math.round((total / max) * 100) : 0;
  };

  const canSearch = (selectedStudentId || rollInput.trim()) && filterExam;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-[#1a237e] text-white px-4 py-8 text-center">
        <div className="max-w-2xl mx-auto">
          <GraduationCap className="h-10 w-10 mx-auto mb-3 text-yellow-400" />
          <h1 className="text-2xl font-bold">Exam Results</h1>
          <p className="text-blue-200 mt-1 text-sm">Search your published results</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Search Form */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="h-5 w-5 text-[#1a237e]" />
              Find Student Result
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Step 1: Class & Section */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-slate-500 mb-1 block">Class</Label>
                <Select value={filterClass} onValueChange={v => { setFilterClass(v); setFilterSection(''); setSelectedStudentId(''); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Class" />
                  </SelectTrigger>
                  <SelectContent>
                    {CLASSES.map(c => (
                      <SelectItem key={c} value={c}>Class {c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-slate-500 mb-1 block">Section</Label>
                <Select value={filterSection} onValueChange={v => { setFilterSection(v); setSelectedStudentId(''); }} disabled={!filterClass}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select Section" />
                  </SelectTrigger>
                  <SelectContent>
                    {SECTIONS.map(s => (
                      <SelectItem key={s} value={s}>Section {s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Step 2: Student Dropdown (when class+section chosen) */}
            {filterClass && filterSection && (
              <div>
                <Label className="text-xs text-slate-500 mb-1 block">Select Student</Label>
                <Select value={selectedStudentId} onValueChange={v => { setSelectedStudentId(v); setRollInput(''); }}>
                  <SelectTrigger>
                    <SelectValue placeholder={classStudents.length > 0 ? "Choose a student..." : "No students found"} />
                  </SelectTrigger>
                  <SelectContent>
                    {classStudents.map(s => (
                      <SelectItem key={s.id} value={s.student_id || s.id}>
                        {s.name} {s.roll_no ? `(Roll: ${s.roll_no})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs text-slate-400 font-medium">OR</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            {/* Direct Roll / Student ID entry */}
            <div>
              <Label className="text-xs text-slate-500 mb-1 block">Enter Student ID / Roll No directly</Label>
              <Input
                value={rollInput}
                onChange={e => { setRollInput(e.target.value); setSelectedStudentId(''); }}
                placeholder="e.g. STU001 or roll number"
              />
            </div>

            {/* Exam Filter - MANDATORY */}
            <div>
              <Label className="text-xs text-slate-500 mb-1 block">Exam Type <span className="text-red-500">*</span></Label>
              <Select value={filterExam} onValueChange={setFilterExam}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Exam Type" />
                </SelectTrigger>
                <SelectContent>
                  {examTypes.map(e => (
                    <SelectItem key={e.id} value={e.name}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              className="w-full bg-[#1a237e] hover:bg-[#283593]"
              onClick={handleSearch}
              disabled={isSearching || !canSearch}
            >
              <Search className="mr-2 h-4 w-4" />
              {isSearching ? 'Searching...' : 'View Result'}
            </Button>
          </CardContent>
        </Card>

        {/* Result */}
         {searched && (
           studentResult ? (
             <div className="space-y-4">
               {/* Student Header */}
               <div className="bg-[#1a237e] px-4 py-4 rounded-lg text-white">
                 <h3 className="font-bold text-lg">{studentResult.student_name}</h3>
                 <p className="text-blue-200 text-xs">
                   Class {studentResult.class_name}-{studentResult.section} | ID: {studentResult.student_id}
                 </p>
               </div>

               {/* Separate cards for each exam type */}
               {Object.entries(resultsByExam).map(([examType, marks]) => (
                 <Card key={examType} className="border-0 shadow-sm overflow-hidden">
                   <div className="bg-gradient-to-r from-[#1a237e] to-[#283593] px-4 py-3">
                     <h4 className="text-white font-semibold text-sm flex items-center justify-between">
                       <span>{examType}</span>
                       <span className="text-yellow-300 text-lg font-bold">{getPercentage(marks)}%</span>
                     </h4>
                   </div>
                   <CardContent className="p-4">
                     <div className="space-y-2">
                       {marks.map((m, i) => (
                         <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                           <div>
                             <p className="font-medium text-sm text-slate-800">{m.subject}</p>
                           </div>
                           <div className="flex items-center gap-3">
                             <span className="text-sm font-semibold text-slate-700">
                               {m.marks_obtained}/{m.max_marks}
                             </span>
                             {m.grade && (
                               <Badge className={`text-xs ${gradeColor(m.grade)}`}>
                                 {m.grade}
                               </Badge>
                             )}
                           </div>
                         </div>
                       ))}
                     </div>
                   </CardContent>
                 </Card>
               ))}
             </div>
           ) : (
             <Card className="border-0 shadow-sm">
               <CardContent className="py-16 text-center">
                 <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                 <h3 className="font-medium text-slate-700">No results found</h3>
                 <p className="text-sm text-slate-500 mt-1">Try a different student or exam</p>
               </CardContent>
             </Card>
           )
         )}
      </div>
    </div>
  );
}