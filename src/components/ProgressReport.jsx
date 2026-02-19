import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download, FileText } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function ProgressReport({ studentResult, marks, onExporting }) {
  const getSubjectRemark = (percentage) => {
    if (percentage >= 80) return 'Excellent performance.';
    if (percentage >= 60) return 'Can do better with more practice.';
    return 'Needs improvement in this subject.';
  };

  const calculateSubjectStats = () => {
    const subjects = {};
    marks.forEach(mark => {
      if (!subjects[mark.subject]) {
        subjects[mark.subject] = { obtained: 0, max: 0 };
      }
      subjects[mark.subject].obtained += mark.marks_obtained;
      subjects[mark.subject].max += mark.max_marks;
    });

    return Object.entries(subjects).map(([name, stats]) => ({
      name,
      obtained: stats.obtained,
      max: stats.max,
      percentage: Math.round((stats.obtained / stats.max) * 100),
      remark: getSubjectRemark((stats.obtained / stats.max) * 100)
    }));
  };

  const subjectStats = calculateSubjectStats();
  const totalObtained = marks.reduce((sum, m) => sum + m.marks_obtained, 0);
  const totalMax = marks.reduce((sum, m) => sum + m.max_marks, 0);
  const overallPercentage = Math.round((totalObtained / totalMax) * 100);
  const lowSubjects = subjectStats.filter(s => s.percentage < 50).length;

  const getOverallRemark = () => {
    if (lowSubjects > 2) return 'Work hard in all subjects.';
    if (overallPercentage >= 80) return 'Outstanding performance. Keep up the excellent work!';
    if (overallPercentage >= 60) return 'Good performance. Continue to work hard.';
    return 'Needs improvement overall.';
  };

  const getPercentageColor = (percentage) => {
    if (percentage >= 80) return 'bg-green-100 text-green-700';
    if (percentage >= 60) return 'bg-blue-100 text-blue-700';
    if (percentage >= 40) return 'bg-yellow-100 text-yellow-700';
    return 'bg-red-100 text-red-700';
  };

  const handleExport = async (format) => {
    if (onExporting) onExporting(true);
    try {
      const response = await base44.functions.invoke('generateProgressReport', {
        studentId: studentResult.student_id,
        marks,
        format
      });

      const blob = new Blob([response.data], {
        type: format === 'excel' 
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'application/pdf'
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Progress_Report_${studentResult.student_id}.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      if (onExporting) onExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Overall Summary Card */}
      <Card className="border-2 border-[#1a237e] bg-gradient-to-br from-blue-50 to-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#1a237e]" />
            Progress Report
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Overall Performance */}
          <div className="bg-white rounded-lg p-4 border border-slate-200">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-semibold text-slate-700">Overall Performance</h4>
              <Badge className={`${getPercentageColor(overallPercentage)} text-lg px-3 py-1`}>
                {overallPercentage}%
              </Badge>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Total Marks:</span>
                <span className="font-semibold">{totalObtained}/{totalMax}</span>
              </div>
              <div className="pt-2 border-t border-slate-200">
                <p className="text-slate-600 mb-1">Overall Remark:</p>
                <p className="font-medium text-slate-800 italic">{getOverallRemark()}</p>
              </div>
            </div>
          </div>

          {/* Subject-wise Details */}
          <div className="space-y-2">
            <h4 className="font-semibold text-slate-700 text-sm">Subject-wise Performance</h4>
            <div className="space-y-2">
              {subjectStats.map((subject, idx) => (
                <div key={idx} className="bg-white rounded-lg p-3 border border-slate-200">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium text-slate-800">{subject.name}</p>
                      <p className="text-xs text-slate-500">
                        {subject.obtained}/{subject.max}
                      </p>
                    </div>
                    <Badge className={getPercentageColor(subject.percentage)}>
                      {subject.percentage}%
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-600 italic">{subject.remark}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Export Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => handleExport('pdf')}
              className="flex-1 bg-[#1a237e] hover:bg-[#283593]"
              size="sm"
            >
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
            <Button
              onClick={() => handleExport('excel')}
              className="flex-1 bg-green-600 hover:bg-green-700"
              size="sm"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Excel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}