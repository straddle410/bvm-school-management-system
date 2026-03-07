import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ChevronRight } from 'lucide-react';

export default function StudentAnalyticsModal({ classFilter, academicYear }) {
  const [selectedStudent, setSelectedStudent] = useState(null);

  const { data: students = [] } = useQuery({
    queryKey: ['analytics-students', classFilter, academicYear],
    queryFn: async () => {
      let filter = { academic_year: academicYear, status: 'Published', is_deleted: false };
      if (classFilter !== 'all') filter.class_name = classFilter;
      return base44.entities.Student.filter(filter);
    },
  });

  const { data: attendanceData = [] } = useQuery({
    queryKey: ['analytics-attendance', classFilter, academicYear],
    queryFn: async () => {
      let filter = { academic_year: academicYear };
      if (classFilter !== 'all') filter.class_name = classFilter;
      return base44.entities.Attendance.filter(filter);
    },
  });

  const { data: marksData = [] } = useQuery({
    queryKey: ['analytics-marks', classFilter, academicYear],
    queryFn: async () => {
      let filter = { academic_year: academicYear, status: { $in: ['Submitted', 'Verified', 'Approved', 'Published'] } };
      if (classFilter !== 'all') filter.class_name = classFilter;
      return base44.entities.Marks.filter(filter);
    },
  });

  // Calculate student analytics
  const studentAnalytics = useMemo(() => {
    return students.map(student => {
      // Attendance
      const studentAttendance = attendanceData.filter(a => a.student_id === student.student_id);
      const presentDays = studentAttendance.filter(a => a.is_present).length;
      const attendancePercentage = studentAttendance.length > 0 
        ? ((presentDays / studentAttendance.length) * 100).toFixed(1)
        : 0;

      // Marks
      const studentMarks = marksData.filter(m => m.student_id === student.student_id);
      const avgMarks = studentMarks.length > 0
        ? (studentMarks.reduce((sum, m) => sum + m.marks_obtained, 0) / studentMarks.length).toFixed(1)
        : 0;
      const passedExams = studentMarks.filter(m => m.marks_obtained >= (m.max_marks * 0.4)).length;
      const passRate = studentMarks.length > 0
        ? ((passedExams / studentMarks.length) * 100).toFixed(1)
        : 0;

      return {
        id: student.id,
        name: student.name,
        studentId: student.student_id,
        class: `${student.class_name}-${student.section}`,
        rollNo: student.roll_no,
        attendance: attendancePercentage,
        avgMarks,
        passRate,
        presentDays,
        totalAttendanceDays: studentAttendance.length,
        examsTaken: studentMarks.length,
      };
    }).sort((a, b) => b.avgMarks - a.avgMarks);
  }, [students, attendanceData, marksData]);

  if (studentAnalytics.length === 0) {
    return <p className="text-xs text-gray-500 text-center py-4">No students found</p>;
  }

  return (
    <>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {studentAnalytics.map(student => (
          <div
            key={student.id}
            onClick={() => setSelectedStudent(student)}
            className="bg-white border border-gray-200 rounded-xl p-3 cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition"
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="font-semibold text-sm text-gray-900">{student.name}</h3>
                <p className="text-xs text-gray-500">ID: {student.studentId} • Roll: {student.rollNo}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-blue-50 rounded-lg p-2">
                <p className="text-xs text-gray-600">Attendance</p>
                <p className="text-lg font-bold text-blue-600">{student.attendance}%</p>
              </div>
              <div className="bg-purple-50 rounded-lg p-2">
                <p className="text-xs text-gray-600">Avg Marks</p>
                <p className="text-lg font-bold text-purple-600">{student.avgMarks}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-2">
                <p className="text-xs text-gray-600">Pass Rate</p>
                <p className="text-lg font-bold text-green-600">{student.passRate}%</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Detailed Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white w-full max-w-md rounded-t-3xl p-6 max-h-[80vh] overflow-y-auto">
            <button
              onClick={() => setSelectedStudent(null)}
              className="float-right text-gray-500 hover:text-gray-700 text-xl"
            >
              ✕
            </button>

            <h2 className="text-lg font-bold text-gray-900 mb-1">{selectedStudent.name}</h2>
            <p className="text-sm text-gray-600 mb-4">ID: {selectedStudent.studentId} • {selectedStudent.class}</p>

            <div className="space-y-4">
              {/* Attendance Details */}
              <div className="bg-blue-50 rounded-xl p-4">
                <h3 className="font-semibold text-gray-800 mb-3">Attendance</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Percentage</span>
                    <span className="font-bold text-blue-600">{selectedStudent.attendance}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Days Present</span>
                    <span className="font-bold">{selectedStudent.presentDays}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Days</span>
                    <span className="font-bold">{selectedStudent.totalAttendanceDays}</span>
                  </div>
                </div>
              </div>

              {/* Marks Details */}
              <div className="bg-purple-50 rounded-xl p-4">
                <h3 className="font-semibold text-gray-800 mb-3">Academic Performance</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Average Marks</span>
                    <span className="font-bold text-purple-600">{selectedStudent.avgMarks}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Pass Rate</span>
                    <span className="font-bold text-green-600">{selectedStudent.passRate}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Exams Taken</span>
                    <span className="font-bold">{selectedStudent.examsTaken}</span>
                  </div>
                </div>
              </div>

              {/* Performance Trend */}
              <div className="bg-amber-50 rounded-xl p-4">
                <h3 className="font-semibold text-gray-800 mb-2">Overall Status</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-center">
                    <p className="text-xs text-gray-600">Attendance Status</p>
                    <p className={`text-sm font-bold ${selectedStudent.attendance >= 75 ? 'text-green-600' : 'text-red-600'}`}>
                      {selectedStudent.attendance >= 75 ? '✓ Good' : '✗ Low'}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-600">Academic Status</p>
                    <p className={`text-sm font-bold ${selectedStudent.avgMarks >= 40 ? 'text-green-600' : 'text-red-600'}`}>
                      {selectedStudent.avgMarks >= 40 ? '✓ Passing' : '✗ Below'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedStudent(null)}
              className="w-full mt-4 bg-gray-100 text-gray-800 rounded-lg py-2 font-semibold hover:bg-gray-200"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}