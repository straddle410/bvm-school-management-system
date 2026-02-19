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
import { Search, GraduationCap, TrendingUp, BookOpen } from 'lucide-react';

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

export default function Results() {
  const [searchName, setSearchName] = useState('');
  const [searchRoll, setSearchRoll] = useState('');
  const [filterClass, setFilterClass] = useState('');
  const [filterExam, setFilterExam] = useState('');
  const [searched, setSearched] = useState(false);

  const { data: examTypes = [] } = useQuery({
    queryKey: ['exam-types-published'],
    queryFn: () => base44.entities.ExamType.filter({ status: 'Published' })
  });

  const { data: allMarks = [], isLoading, refetch } = useQuery({
    queryKey: ['marks-search', filterClass, filterExam],
    queryFn: () => {
      const filter = { status: 'Published' };
      if (filterClass) filter.class_name = filterClass;
      if (filterExam) filter.exam_type = filterExam;
      return base44.entities.Marks.filter(filter);
    },
    enabled: false
  });

  const handleSearch = () => {
    setSearched(true);
    refetch();
  };

  const filteredMarks = allMarks.filter(m => {
    const nameMatch = !searchName || m.student_name?.toLowerCase().includes(searchName.toLowerCase());
    const rollMatch = !searchRoll || m.student_id?.toLowerCase().includes(searchRoll.toLowerCase());
    return nameMatch && rollMatch;
  });

  // Group by student
  const studentResults = filteredMarks.reduce((acc, mark) => {
    const key = mark.student_id || mark.student_name;
    if (!acc[key]) {
      acc[key] = {
        student_id: mark.student_id,
        student_name: mark.student_name,
        class_name: mark.class_name,
        section: mark.section,
        marks: []
      };
    }
    acc[key].marks.push(mark);
    return acc;
  }, {});

  const studentList = Object.values(studentResults);

  const getPercentage = (marks) => {
    const total = marks.reduce((s, m) => s + m.marks_obtained, 0);
    const max = marks.reduce((s, m) => s + m.max_marks, 0);
    return max > 0 ? Math.round((total / max) * 100) : 0;
  };

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
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="h-5 w-5 text-[#1a237e]" />
              Search Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Student Name</Label>
                <Input
                  value={searchName}
                  onChange={e => setSearchName(e.target.value)}
                  placeholder="Enter student name"
                />
              </div>
              <div>
                <Label>Student ID / Roll No</Label>
                <Input
                  value={searchRoll}
                  onChange={e => setSearchRoll(e.target.value)}
                  placeholder="Enter ID or roll no"
                />
              </div>
              <div>
                <Label>Class</Label>
                <Select value={filterClass} onValueChange={setFilterClass}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Classes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>All Classes</SelectItem>
                    {CLASSES.map(c => (
                      <SelectItem key={c} value={c}>Class {c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Exam</Label>
                <Select value={filterExam} onValueChange={setFilterExam}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Exams" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>All Exams</SelectItem>
                    {examTypes.map(e => (
                      <SelectItem key={e.id} value={e.name}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button
              className="w-full bg-[#1a237e] hover:bg-[#283593]"
              onClick={handleSearch}
              disabled={isLoading}
            >
              <Search className="mr-2 h-4 w-4" />
              {isLoading ? 'Searching...' : 'Search Results'}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        {searched && (
          <div className="space-y-4">
            {studentList.length === 0 ? (
              <Card className="border-0 shadow-sm">
                <CardContent className="py-16 text-center">
                  <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                  <h3 className="font-medium text-slate-700">No results found</h3>
                  <p className="text-sm text-slate-500 mt-1">Try different search criteria</p>
                </CardContent>
              </Card>
            ) : (
              studentList.map(student => {
                const pct = getPercentage(student.marks);
                return (
                  <Card key={student.student_id} className="border-0 shadow-sm overflow-hidden">
                    <div className="bg-[#1a237e] px-4 py-3 flex items-center justify-between">
                      <div>
                        <h3 className="text-white font-bold">{student.student_name}</h3>
                        <p className="text-blue-200 text-xs">
                          Class {student.class_name}-{student.section} | ID: {student.student_id}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-yellow-400 text-xl font-bold">{pct}%</p>
                        <p className="text-blue-200 text-xs">Overall</p>
                      </div>
                    </div>
                    <CardContent className="p-4">
                      <div className="space-y-2">
                        {student.marks.map((m, i) => (
                          <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                            <div>
                              <p className="font-medium text-sm text-slate-800">{m.subject}</p>
                              <p className="text-xs text-slate-500">{m.exam_type}</p>
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
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}