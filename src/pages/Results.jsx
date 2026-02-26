import React, { useState, useEffect } from 'react';
import { useAcademicYear } from '@/components/AcademicYearContext';
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
import { Search, GraduationCap, BookOpen, Share2, Printer, Lock } from 'lucide-react';
import ProgressReport from '../components/ProgressReport';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

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
  const [studentSession, setStudentSession] = useState(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [filterClass, setFilterClass] = useState('');
  const [filterSection, setFilterSection] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [rollInput, setRollInput] = useState('');
  const [filterExam, setFilterExam] = useState('');
  const [searched, setSearched] = useState(false);
  const [studentResult, setStudentResult] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [resultsByExam, setResultsByExam] = useState({});
  const [showProgressReport, setShowProgressReport] = useState(false);
  const [allMarks, setAllMarks] = useState([]);

  const [unreadResultsCleared, setUnreadResultsCleared] = useState(false);

  useEffect(() => {
    const studentSess = localStorage.getItem('student_session');
    const staffSess = localStorage.getItem('staff_session');
    if (studentSess) {
      try {
        const parsed = JSON.parse(studentSess);
        setStudentSession(parsed);
        setFilterClass(parsed.class_name || '');
        setFilterSection(parsed.section || '');
        setSelectedStudentId(parsed.student_id || '');
        // Auto-search for student's own results
        autoSearchStudent(parsed);
      } catch {}
    } else if (staffSess) {
      try {
        const staffData = JSON.parse(staffSess);
        setStudentSession({ isStaff: true, role: staffData.role });
      } catch {
        setStudentSession({ isStaff: true });
      }
    }
    setSessionLoaded(true);
  }, []);

  const autoSearchStudent = async (parsed) => {
   setIsSearching(true);
   const filter = { status: 'Published', student_id: parsed.student_id };
   const marks = await base44.entities.Marks.filter(filter).catch(() => []);
   setIsSearching(false);
   setSearched(true);
   // Mark results notifications as read when results are loaded/viewed
   markResultsNotificationsAsRead(parsed.student_id);
   if (marks.length > 0) {
     const m = marks[0];
     const grouped = {};
     marks.forEach(mark => {
       if (!grouped[mark.exam_type]) grouped[mark.exam_type] = [];
       grouped[mark.exam_type].push(mark);
     });
     setResultsByExam(grouped);
     setAllMarks(marks);
     setStudentResult({ student_id: m.student_id, student_name: m.student_name, class_name: m.class_name, section: m.section });
     setShowProgressReport(false); // Show detailed results by default for students
   }
  };

  const markResultsNotificationsAsRead = async (studentId) => {
    try {
      const unreadNotifications = await base44.entities.Notification.filter({
        recipient_student_id: studentId,
        type: 'results_posted',
        is_read: false
      });
      
      for (const notif of unreadNotifications) {
        await base44.entities.Notification.update(notif.id, { is_read: true });
      }
    } catch (error) {
      console.debug('Error marking notifications as read:', error);
    }
  };

  // Fetch exam types from master source
  const { data: examTypes = [] } = useQuery({
    queryKey: ['exam-types-published', academicYear],
    queryFn: () => base44.entities.ExamType.filter({ academic_year: academicYear, is_active: true }),
    staleTime: 5 * 60 * 1000,
    cacheTime: 10 * 60 * 1000
  });

  // Load students when class+section is selected
  const { data: classStudents = [] } = useQuery({
    queryKey: ['students-class-section', filterClass, filterSection],
    queryFn: () => base44.entities.Student.filter({ class_name: filterClass, section: filterSection }),
    enabled: !!(filterClass && filterSection)
  });

  const handleSearch = async () => {
    if (!selectedStudentId && !rollInput.trim()) {
      alert('Please select a student or enter a student ID');
      return;
    }

    setIsSearching(true);
    setSearched(false);
    setStudentResult(null);

    // Determine the student to search
    let studentId = selectedStudentId;
    if (!studentId && rollInput.trim()) {
      studentId = rollInput.trim();
    }

    // Build filter - admins see all statuses, students see only published
    const isAdmin = studentSession?.role === 'Admin';
    const filter = isAdmin ? { status: { $in: ['Submitted', 'Verified', 'Approved', 'Published'] } } : { status: 'Published' };
    if (studentId) filter.student_id = studentId;
    if (filterExam && filterExam !== 'ALL') filter.exam_type = filterExam;
    if (filterClass) filter.class_name = filterClass;

    const marks = await base44.entities.Marks.filter(filter);
    setSearched(true);
    setIsSearching(false);

    if (marks.length > 0) {
      const m = marks[0];

      // Group marks by exam type - maintain order from ExamType entity
      const marksGrouped = {};
      examTypes.forEach(exam => {
        marksGrouped[exam.id] = [];
      });

      marks.forEach(mark => {
        if (!marksGrouped[mark.exam_type]) {
          marksGrouped[mark.exam_type] = [];
        }
        marksGrouped[mark.exam_type].push(mark);
      });

      // Remove empty exam types and replace IDs with names
      const grouped = {};
      Object.keys(marksGrouped).forEach(key => {
        if (marksGrouped[key].length > 0) {
          const examTypeObj = examTypes.find(e => e.id === key);
          const displayName = examTypeObj?.name || key;
          grouped[displayName] = marksGrouped[key];
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
      setShowProgressReport(false);
    } else {
      setStudentResult(null);
      setResultsByExam({});
      setAllMarks([]);
    }
  };

  const getPercentage = (marks) => {
    const total = marks.reduce((s, m) => s + m.marks_obtained, 0);
    const max = marks.reduce((s, m) => s + m.max_marks, 0);
    return max > 0 ? Math.round((total / max) * 100) : 0;
  };

  const canSearch = (selectedStudentId || rollInput.trim());

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Student Results',
          text: `Results for ${studentResult?.student_name}`,
          url: window.location.href
        });
      } catch (error) {
        console.log('Share cancelled');
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard');
    }
  };

  // For non-staff users who are not students
  if (sessionLoaded && !studentSession) {
    // This is a staff/admin user accessing from dashboard, show search form
    // OR a guest, show login screen
    const isStaffMode = localStorage.getItem('staff_session');
    if (!isStaffMode) {
      return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-sm p-8 max-w-sm w-full text-center">
            <Lock className="h-12 w-12 text-[#1a237e] mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-800 mb-2">Login Required</h2>
            <p className="text-gray-500 text-sm mb-6">Please login to view results.</p>
            <Link to={createPageUrl('StudentLogin')}>
              <Button className="w-full bg-[#1a237e] hover:bg-[#283593]">Go to Login</Button>
            </Link>
          </div>
        </div>
      );
    }
  }

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
        {/* Search Form — visible to staff only */}
        {studentSession?.isStaff && (<Card className="border-0 shadow-sm">
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

            {/* Exam Filter */}
            <div>
              <Label className="text-xs text-slate-500 mb-1 block">Exam Type</Label>
              <Select value={filterExam} onValueChange={setFilterExam}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Exam Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">ALL (All exams)</SelectItem>
                  {examTypes.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button
                className="flex-1 bg-[#1a237e] hover:bg-[#283593]"
                onClick={handleSearch}
                disabled={isSearching || !canSearch}
              >
                <Search className="mr-2 h-4 w-4" />
                {isSearching ? 'Searching...' : 'View Result'}
              </Button>
              {studentResult && Object.keys(resultsByExam).length > 0 && (
                <>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handlePrint}
                    title="Print Results"
                  >
                    <Printer className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleShare}
                    title="Share Results"
                  >
                    <Share2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>)}

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

                {/* Toggle View Button */}
                {allMarks.length > 0 && (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setShowProgressReport(false)}
                      variant={!showProgressReport ? 'default' : 'outline'}
                      className={!showProgressReport ? 'bg-[#1a237e]' : ''}
                    >
                      Detailed Results
                    </Button>
                    <Button
                      onClick={() => setShowProgressReport(true)}
                      variant={showProgressReport ? 'default' : 'outline'}
                      className={showProgressReport ? 'bg-[#1a237e]' : ''}
                    >
                      Progress Report
                    </Button>
                  </div>
                )}

                {showProgressReport && allMarks.length > 0 ? (
                  <ProgressReport studentResult={studentResult} marks={allMarks} />
                ) : (
                  <>
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
                  </>
                )}
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