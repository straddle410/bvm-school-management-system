import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Printer } from 'lucide-react';

export default function ProgressCardModal({ card, isOpen, onClose }) {
  const handlePrint = () => {
    // Add print styles temporarily
    const style = document.createElement('style');
    style.innerHTML = `
      @media print {
        body * { display: none; }
        [role="dialog"] { display: block !important; }
        [role="dialog"] * { display: block !important; }
        .print-content { display: block !important; }
      }
    `;
    document.head.appendChild(style);
    
    setTimeout(() => {
      window.print();
      document.head.removeChild(style);
    }, 100);
  };

  if (!card) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto print:max-w-none print:max-h-none">
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle>Progress Card - {card.student_name}</DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrint}
            title="Print"
            className="print:hidden"
          >
            <Printer className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="print-content print:p-8 space-y-6">
          {/* Header */}
          <div className="text-center border-b-2 border-gray-300 pb-4">
            <h1 className="text-2xl font-bold text-gray-900">PROGRESS CARD</h1>
            <p className="text-sm text-gray-600 mt-2">Academic Year: {card.academic_year}</p>
          </div>

          {/* Student Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-lg">
            <div>
              <p className="text-xs text-gray-600 font-medium">Name</p>
              <p className="font-semibold text-gray-900">{card.student_name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 font-medium">Class</p>
              <p className="font-semibold text-gray-900">{card.class_name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 font-medium">Section</p>
              <p className="font-semibold text-gray-900">{card.section}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 font-medium">Roll Number</p>
              <p className="font-semibold text-gray-900">{card.roll_number}</p>
            </div>
          </div>

          {/* Overall Statistics */}
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Overall Performance</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <p className="text-xs text-blue-600 font-medium mb-1">Percentage</p>
                <p className="text-3xl font-bold text-blue-700">
                  {card.overall_stats?.overall_percentage?.toFixed(2) || 0}%
                </p>
              </div>
              <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                <p className="text-xs text-green-600 font-medium mb-1">Grade</p>
                <p className="text-3xl font-bold text-green-700">
                  {card.overall_stats?.overall_grade || '-'}
                </p>
              </div>
              <div className="bg-purple-50 border border-purple-200 p-4 rounded-lg">
                <p className="text-xs text-purple-600 font-medium mb-1">Rank</p>
                <p className="text-3xl font-bold text-purple-700">
                  #{card.overall_stats?.overall_rank || '-'}
                </p>
              </div>
              <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg">
                <p className="text-xs text-orange-600 font-medium mb-1">Total Marks</p>
                <p className="text-2xl font-bold text-orange-700">
                  {card.overall_stats?.total_marks_obtained || 0}/{card.overall_stats?.total_possible_marks || 0}
                </p>
              </div>
            </div>
          </div>

          {/* Exam Performance Details */}
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-4">Exam Details & Attendance</h2>
            <div className="space-y-4">
              {card.exam_performance?.map((exam, idx) => (
                <div key={idx} className="border border-gray-300 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
                    <h3 className="font-bold text-gray-900">{exam.exam_name}</h3>
                    <div className="flex gap-6 text-sm">
                      <div className="text-center">
                        <p className="text-xs text-gray-600">Percentage</p>
                        <p className="font-bold text-blue-600">{exam.percentage?.toFixed(2) || 0}%</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-600">Grade</p>
                        <p className="font-bold text-green-600">{exam.grade}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-600">Rank</p>
                        <p className="font-bold text-purple-600">#{exam.rank || '-'}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-gray-600">Marks</p>
                        <p className="font-bold text-orange-600">
                          {exam.total_marks}/{exam.max_marks}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Subject Details */}
                  {exam.subject_details?.length > 0 && (
                    <div className="space-y-2">
                      {exam.subject_details.map((sub, sidx) => (
                        <div key={sidx} className="grid grid-cols-12 gap-2 text-sm bg-gray-50 p-3 rounded">
                          <div className="col-span-4 font-medium text-gray-900">{sub.subject}</div>
                          <div className="col-span-2 text-center">
                            <span className="text-gray-600">{sub.marks_obtained}/{sub.max_marks}</span>
                          </div>
                          <div className="col-span-2 text-center">
                            <span className="text-blue-600">
                              {((sub.marks_obtained / sub.max_marks) * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="col-span-2 text-center">
                            <span className="font-semibold text-green-600">{sub.grade}</span>
                          </div>
                          <div className="col-span-2 text-center">
                            <span className="text-xs text-gray-600 bg-white px-2 py-1 rounded">
                              {sub.marks_obtained >= 40 ? 'Pass' : 'Fail'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Attendance Report for this Exam Period */}
                  {card.attendance_summary && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-xs font-semibold text-gray-600 mb-3 uppercase">Attendance ({card.attendance_summary.range_start} to {card.attendance_summary.range_end})</p>
                      <div className="grid grid-cols-4 gap-3">
                        <div className="bg-blue-50 p-2 rounded">
                          <p className="text-xs text-gray-600">Working Days</p>
                          <p className="text-lg font-bold text-gray-900">{card.attendance_summary.working_days}</p>
                        </div>
                        <div className="bg-green-50 p-2 rounded">
                          <p className="text-xs text-gray-600">Days Present</p>
                          <p className="text-lg font-bold text-green-600">{card.attendance_summary.total_present_days}</p>
                        </div>
                        <div className="bg-red-50 p-2 rounded">
                          <p className="text-xs text-gray-600">Days Absent</p>
                          <p className="text-lg font-bold text-red-600">{card.attendance_summary.working_days - card.attendance_summary.total_present_days}</p>
                        </div>
                        <div className="bg-purple-50 p-2 rounded">
                          <p className="text-xs text-gray-600">Attendance %</p>
                          <p className="text-lg font-bold text-purple-600">{card.attendance_summary.attendance_percentage}%</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>



          {/* Footer */}
          <div className="text-center text-xs text-gray-500 border-t pt-4 mt-8">
            <p>Generated on: {new Date(card.generated_at).toLocaleDateString()}</p>
            <p className="text-gray-400">This is an official progress report from the school management system</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}