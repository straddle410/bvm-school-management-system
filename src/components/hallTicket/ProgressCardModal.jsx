import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Printer } from 'lucide-react';

export default function ProgressCardModal({ card, isOpen, onClose }) {
  const handlePrint = () => {
    const style = document.createElement('style');
    style.innerHTML = `
      @page { 
        size: A4; 
        margin: 8mm;
      }
      @media print {
        body * { display: none; }
        [role="dialog"] { display: block !important; }
        [role="dialog"] * { display: block !important; }
        .print-content { display: block !important; }
        .print-content { font-size: 10px !important; line-height: 1.2 !important; }
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

        <div className="print-content print:p-8 space-y-2">
          {/* Header — Compact */}
          <div className="text-center border-b border-gray-300 pb-2">
            <h1 className="text-lg font-bold text-gray-900">PROGRESS CARD</h1>
            <p className="text-xs text-gray-600">{card.academic_year}</p>
          </div>

          {/* Student Info — Compact */}
          <div className="grid grid-cols-4 gap-1 bg-gray-50 p-2 rounded text-xs">
            <div>
              <p className="text-gray-500 font-semibold">Name</p>
              <p className="font-semibold text-gray-900">{card.student_name}</p>
            </div>
            <div>
              <p className="text-gray-500 font-semibold">Class</p>
              <p className="font-semibold text-gray-900">{card.class_name}-{card.section}</p>
            </div>
            <div>
              <p className="text-gray-500 font-semibold">Roll</p>
              <p className="font-semibold text-gray-900">{card.roll_number}</p>
            </div>
            <div>
              <p className="text-gray-500 font-semibold">Rank</p>
              <p className="font-semibold text-gray-900">#{card.overall_stats?.overall_rank || '-'}</p>
            </div>
          </div>

          {/* Overall Statistics — Compact */}
          <div>
            <h2 className="text-xs font-bold text-gray-900 mb-1">Overall Performance</h2>
            <div className="grid grid-cols-4 gap-1 text-xs">
              <div className="bg-blue-50 border border-blue-200 p-1.5 rounded">
                <p className="text-blue-600 font-medium">Percentage</p>
                <p className="text-lg font-bold text-blue-700">
                  {card.overall_stats?.overall_percentage?.toFixed(1) || 0}%
                </p>
              </div>
              <div className="bg-green-50 border border-green-200 p-1.5 rounded">
                <p className="text-green-600 font-medium">Grade</p>
                <p className="text-lg font-bold text-green-700">
                  {card.overall_stats?.overall_grade || '-'}
                </p>
              </div>
              <div className="bg-purple-50 border border-purple-200 p-1.5 rounded">
                <p className="text-purple-600 font-medium">Total Marks</p>
                <p className="text-sm font-bold text-purple-700">
                  {card.overall_stats?.total_marks_obtained || 0}/{card.overall_stats?.total_possible_marks || 0}
                </p>
              </div>
              <div className="bg-orange-50 border border-orange-200 p-1.5 rounded">
                <p className="text-orange-600 font-medium">Attendance</p>
                <p className="text-sm font-bold text-orange-700">
                  {card.attendance_summary?.attendance_percentage || 0}%
                </p>
              </div>
            </div>
          </div>

          {/* Exam Performance & Attendance — Compact */}
          <div>
            <h2 className="text-xs font-bold text-gray-900 mb-1">Exam Details & Attendance</h2>
            <div className="space-y-1">
              {card.exam_performance?.slice(0, 3).map((exam, idx) => (
                <div key={idx} className="border border-gray-300 rounded p-1.5">
                  {/* Exam header */}
                  <div className="flex items-center justify-between mb-1 pb-1 border-b border-gray-200 text-xs">
                    <h3 className="font-bold text-gray-900">{exam.exam_name}</h3>
                    <div className="flex gap-2 text-xs">
                      <div className="text-center">
                        <p className="text-gray-600">%</p>
                        <p className="font-bold text-blue-600">{exam.percentage?.toFixed(1) || 0}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-600">Gr</p>
                        <p className="font-bold text-green-600">{exam.grade}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-gray-600">Mk</p>
                        <p className="font-bold text-orange-600">{exam.total_marks}/{exam.max_marks}</p>
                      </div>
                    </div>
                  </div>

                  {/* Subject Details — Inline */}
                  {exam.subject_details?.length > 0 && (
                    <div className="space-y-0.5">
                      {exam.subject_details.map((sub, sidx) => (
                        <div key={sidx} className="grid grid-cols-12 gap-0.5 text-xs bg-gray-50 p-1 rounded">
                          <div className="col-span-4 font-medium text-gray-900 truncate">{sub.subject}</div>
                          <div className="col-span-2 text-center text-gray-600">{sub.marks_obtained}/{sub.max_marks}</div>
                          <div className="col-span-2 text-center text-blue-600">{((sub.marks_obtained / sub.max_marks) * 100).toFixed(0)}%</div>
                          <div className="col-span-2 text-center font-semibold text-green-600">{sub.grade}</div>
                          <div className="col-span-2 text-center text-xs font-semibold" style={{color: sub.marks_obtained >= 40 ? '#22c55e' : '#ef4444'}}>
                            {sub.marks_obtained >= 40 ? 'P' : 'F'}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Attendance Summary — Single row */}
                  {card.attendance_summary && (
                    <div className="mt-1 pt-1 border-t border-gray-200">
                      <p className="text-xs font-semibold text-gray-600 mb-0.5 uppercase">Attendance</p>
                      <div className="grid grid-cols-4 gap-0.5 text-xs">
                        <div className="bg-blue-50 p-0.5 rounded">
                          <p className="text-gray-600">WD</p>
                          <p className="font-bold">{card.attendance_summary.working_days}</p>
                        </div>
                        <div className="bg-green-50 p-0.5 rounded">
                          <p className="text-gray-600">Pres</p>
                          <p className="font-bold text-green-600">{card.attendance_summary.total_present_days}</p>
                        </div>
                        <div className="bg-red-50 p-0.5 rounded">
                          <p className="text-gray-600">Abs</p>
                          <p className="font-bold text-red-600">{(card.attendance_summary.working_days - card.attendance_summary.total_present_days).toFixed(0)}</p>
                        </div>
                        <div className="bg-purple-50 p-0.5 rounded">
                          <p className="text-gray-600">%</p>
                          <p className="font-bold text-purple-600">{card.attendance_summary.attendance_percentage}%</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>



          {/* Footer */}
          <div className="text-center text-xs text-gray-500 border-t pt-1 mt-2">
            <p>Generated: {new Date(card.generated_at).toLocaleDateString()}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}