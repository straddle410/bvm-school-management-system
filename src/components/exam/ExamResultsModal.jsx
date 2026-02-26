import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, Search, BookOpen } from 'lucide-react';

const CLASSES = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

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

export default function ExamResultsModal({ open, onOpenChange }) {
  const [filterClass, setFilterClass] = useState('');
  const [filterExam, setFilterExam] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [searched, setSearched] = useState(false);
  const [studentResult, setStudentResult] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [resultsByExam, setResultsByExam] = useState({});
  const [allMarks, setAllMarks] = useState([]);

  const { data: classStudents = [] } = useQuery({
    queryKey: ['students-class-section-exam', filterClass],
    queryFn: () => base44.entities.Student.filter({ class_name: filterClass }),
    enabled: !!filterClass
  });

  const handleSearch = async () => {
    if (!selectedStudentId) {
      alert('Please select a student');
      return;
    }

    setIsSearching(true);
    setSearched(false);
    setStudentResult(null);

    const filter = { status: 'Published', student_id: selectedStudentId };
    if (filterExam && filterExam !== 'ALL') filter.exam_type = filterExam;
    if (filterClass) filter.class_name = filterClass;

    const marks = await base44.entities.Marks.filter(filter);
    setSearched(true);
    setIsSearching(false);

    if (marks.length > 0) {
      const m = marks[0];
      const grouped = {};
      const examOrder = ['FA1', 'FA2', 'FA3', 'FA4', 'SA1', 'SA2', 'Annual'];
      
      examOrder.forEach(exam => {
        grouped[exam] = [];
      });

      marks.forEach(mark => {
        if (!grouped[mark.exam_type]) {
          grouped[mark.exam_type] = [];
        }
        grouped[mark.exam_type].push(mark);
      });

      Object.keys(grouped).forEach(key => {
        if (grouped[key].length === 0) {
          delete grouped[key];
        }
      });

      setResultsByExam(grouped);
      setAllMarks(marks);
      setStudentResult({
        student_id: m.student_id,
        student_name: m.student_name,
        class_name: m.class_name,
        section: m.section
      });
    }
  };

  const getPercentage = (marks) => {
    const total = marks.reduce((s, m) => s + m.marks_obtained, 0);
    const max = marks.reduce((s, m) => s + m.max_marks, 0);
    return max > 0 ? Math.round((total / max) * 100) : 0;
  };

  const handleReset = () => {
    setFilterClass('');
    setFilterExam('');
    setSelectedStudentId('');
    setSearched(false);
    setStudentResult(null);
    setResultsByExam({});
    setAllMarks([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>View Exam Results</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-slate-500 mb-1 block">Class</Label>
              <Select value={filterClass} onValueChange={v => { setFilterClass(v); setSelectedStudentId(''); }}>
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

            {filterClass && (
              <div>
                <Label className="text-xs text-slate-500 mb-1 block">Student</Label>
                <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                  <SelectTrigger>
                    <SelectValue placeholder={classStudents.length > 0 ? "Choose student..." : "No students"} />
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

            <div>
              <Label className="text-xs text-slate-500 mb-1 block">Exam Type</Label>
              <Select value={filterExam} onValueChange={setFilterExam}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Exam" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">ALL</SelectItem>
                  {['FA1', 'FA2', 'FA3', 'FA4', 'SA1', 'SA2', 'Annual'].map(e => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Search Button */}
          <Button
            className="w-full bg-[#1a237e] hover:bg-[#283593]"
            onClick={handleSearch}
            disabled={isSearching || !selectedStudentId}
          >
            <Search className="mr-2 h-4 w-4" />
            {isSearching ? 'Searching...' : 'View Results'}
          </Button>

          {/* Results */}
          {searched && (
            studentResult ? (
              <div className="space-y-3 mt-4">
                {/* Student Header */}
                <div className="bg-[#1a237e] px-4 py-3 rounded-lg text-white">
                  <h3 className="font-bold">{studentResult.student_name}</h3>
                  <p className="text-blue-200 text-xs">
                    Class {studentResult.class_name}-{studentResult.section} | ID: {studentResult.student_id}
                  </p>
                </div>

                {/* Result Cards */}
                {Object.entries(resultsByExam).map(([examType, marks]) => (
                  <Card key={examType} className="border-0 shadow-sm">
                    <div className="bg-gradient-to-r from-[#1a237e] to-[#283593] px-4 py-2 rounded-t-lg">
                      <h4 className="text-white font-semibold text-sm flex items-center justify-between">
                        <span>{examType}</span>
                        <span className="text-yellow-300 font-bold">{getPercentage(marks)}%</span>
                      </h4>
                    </div>
                    <CardContent className="p-3">
                      <div className="space-y-2">
                        {marks.map((m, i) => (
                          <div key={i} className="flex items-center justify-between py-1.5 border-b last:border-0">
                            <p className="text-sm text-slate-800">{m.subject}</p>
                            <div className="flex items-center gap-2">
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
                <CardContent className="py-8 text-center">
                  <BookOpen className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-600 text-sm">No results found</p>
                </CardContent>
              </Card>
            )
          )}

          {/* Reset Button */}
          {searched && (
            <Button variant="outline" className="w-full" onClick={handleReset}>
              New Search
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}