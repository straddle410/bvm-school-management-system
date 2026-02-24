import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, ScatterChart, Scatter } from 'recharts';

export default function PerformanceAnalytics({ classFilter, subjectFilter, academicYear }) {
  const { data: marksData = [] } = useQuery({
    queryKey: ['marks', classFilter, subjectFilter, academicYear],
    queryFn: async () => {
      let filter = { academic_year: academicYear };
      if (classFilter !== 'all') filter.class_name = classFilter;
      if (subjectFilter !== 'all') filter.subject = subjectFilter;
      return base44.entities.Marks.filter(filter);
    },
  });

  // Subject-wise average marks
  const subjectAverage = useMemo(() => {
    const subjectMap = {};
    marksData.forEach(mark => {
      if (!subjectMap[mark.subject]) {
        subjectMap[mark.subject] = { total: 0, count: 0, passCount: 0, maxMarks: mark.max_marks };
      }
      subjectMap[mark.subject].total += mark.marks_obtained;
      subjectMap[mark.subject].count++;
      if (mark.marks_obtained >= (mark.max_marks * 0.4)) subjectMap[mark.subject].passCount++;
    });

    return Object.entries(subjectMap)
      .map(([name, data]) => ({
        name,
        avgMarks: (data.total / data.count).toFixed(1),
        passRate: ((data.passCount / data.count) * 100).toFixed(1),
      }))
      .sort((a, b) => b.avgMarks - a.avgMarks);
  }, [marksData]);

  // Exam-wise performance
  const examPerformance = useMemo(() => {
    const examMap = {};
    marksData.forEach(mark => {
      if (!examMap[mark.exam_type]) {
        examMap[mark.exam_type] = { total: 0, count: 0, passCount: 0 };
      }
      examMap[mark.exam_type].total += mark.marks_obtained;
      examMap[mark.exam_type].count++;
      if (mark.marks_obtained >= (mark.max_marks * 0.4)) examMap[mark.exam_type].passCount++;
    });

    return Object.entries(examMap).map(([name, data]) => ({
      name,
      avgMarks: (data.total / data.count).toFixed(1),
      passRate: ((data.passCount / data.count) * 100).toFixed(1),
    }));
  }, [marksData]);

  // Grade distribution
  const gradeDistribution = useMemo(() => {
    const gradeMap = { 'A+': 0, 'A': 0, 'B': 0, 'C': 0, 'D': 0, 'F': 0 };
    marksData.forEach(mark => {
      if (mark.grade && gradeMap.hasOwnProperty(mark.grade)) {
        gradeMap[mark.grade]++;
      }
    });
    return Object.entries(gradeMap).map(([grade, count]) => ({ grade, count })).filter(g => g.count > 0);
  }, [marksData]);

  // Overall stats
  const overallStats = useMemo(() => {
    const total = marksData.length;
    const passCount = marksData.filter(m => m.marks_obtained >= (m.max_marks * 0.4)).length;
    const totalMarks = marksData.reduce((sum, m) => sum + m.marks_obtained, 0);
    return {
      avgMarks: total > 0 ? (totalMarks / total).toFixed(1) : 0,
      passRate: total > 0 ? ((passCount / total) * 100).toFixed(1) : 0,
      totalStudents: [...new Set(marksData.map(m => m.student_id))].length,
    };
  }, [marksData]);

  if (marksData.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-gray-500 text-center">No marks data available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500">Avg Marks</p>
            <p className="text-2xl font-bold text-blue-600">{overallStats.avgMarks}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500">Pass Rate</p>
            <p className="text-2xl font-bold text-green-600">{overallStats.passRate}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-gray-500">Students</p>
            <p className="text-2xl font-bold text-purple-600">{overallStats.totalStudents}</p>
          </CardContent>
        </Card>
      </div>

      {/* Subject-wise Performance */}
      {subjectAverage.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Performance by Subject</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={subjectAverage}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-15} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip cursor={{ fill: 'rgba(0,0,0,0.1)' }} />
                <Bar dataKey="avgMarks" fill="#3b82f6" name="Avg Marks" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Exam-wise Performance */}
      {examPerformance.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Performance by Exam</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={examPerformance}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                <Line type="monotone" dataKey="avgMarks" stroke="#8b5cf6" strokeWidth={2} name="Avg Marks" />
                <Line type="monotone" dataKey="passRate" stroke="#10b981" strokeWidth={2} name="Pass Rate %" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Grade Distribution */}
      {gradeDistribution.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Grade Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {gradeDistribution.map((grade, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="font-semibold w-8">{grade.grade}</span>
                  <div className="flex-1 mx-3 bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-indigo-600 h-3 rounded-full"
                      style={{ width: `${(grade.count / marksData.length) * 100}%` }}
                    />
                  </div>
                  <span className="text-right w-8">{grade.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}