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

        <div className="print-content print:p-6 space-y-3">
          {/* ─── SCHOOL LETTERHEAD ─── */}
          <div className="text-center border-b-2 border-gray-800 pb-3">
            <h1 className="text-xl font-bold text-gray-900">BVM SCHOOL</h1>
            <p className="text-xs text-gray-600">Excellence in Education</p>
            <h2 className="text-sm font-bold text-gray-800 mt-1">PROGRESS CARD</h2>
            <p className="text-xs text-gray-500">Academic Year: {card.academic_year}</p>
          </div>

          {/* ─── STUDENT DETAILS GRID ─── */}
          <div className="grid grid-cols-5 gap-3 bg-gray-50 p-3 rounded border border-gray-200">
            <div>
              <p className="text-xs text-gray-600 font-semibold">Name</p>
              <p className="text-sm font-bold text-gray-900">{card.student_name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 font-semibold">Class/Section</p>
              <p className="text-sm font-bold text-gray-900">{card.class_name}-{card.section}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 font-semibold">Roll No</p>
              <p className="text-sm font-bold text-gray-900">{card.roll_number}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 font-semibold">Overall %</p>
              <p className="text-sm font-bold text-blue-700">{card.overall_stats?.overall_percentage?.toFixed(1) || 0}%</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 font-semibold">Grade/Rank</p>
              <p className="text-sm font-bold text-green-700">{card.overall_stats?.overall_grade || '-'} | #{card.overall_stats?.overall_rank || '-'}</p>
            </div>
          </div>

          {/* ─── SUBJECT MARKS TABLE ─── */}
          {card.exam_performance?.map((exam, idx) => (
            <div key={idx}>
              <h3 className="text-sm font-bold text-gray-900 mb-2 bg-gray-100 p-2 rounded">{exam.exam_name}</h3>
              <div className="overflow-x-auto">
                <table className="w-full border border-gray-300 text-xs">
                  <thead className="bg-gray-200">
                    <tr>
                      <th className="border border-gray-300 p-2 text-left font-semibold text-gray-900">Subject</th>
                      <th className="border border-gray-300 p-2 text-center font-semibold text-gray-900">Marks</th>
                      <th className="border border-gray-300 p-2 text-center font-semibold text-gray-900">%</th>
                      <th className="border border-gray-300 p-2 text-center font-semibold text-gray-900">Grade</th>
                      <th className="border border-gray-300 p-2 text-center font-semibold text-gray-900">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exam.subject_details?.map((sub, sidx) => (
                      <tr key={sidx} className={sidx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="border border-gray-300 p-2 font-medium text-gray-900">{sub.subject}</td>
                        <td className="border border-gray-300 p-2 text-center text-gray-800">{sub.marks_obtained}/{sub.max_marks}</td>
                        <td className="border border-gray-300 p-2 text-center font-semibold text-blue-600">
                          {((sub.marks_obtained / sub.max_marks) * 100).toFixed(1)}%
                        </td>
                        <td className="border border-gray-300 p-2 text-center font-bold text-green-600">{sub.grade}</td>
                        <td className="border border-gray-300 p-2 text-center font-semibold" style={{color: sub.marks_obtained >= 40 ? '#22c55e' : '#ef4444'}}>
                          {sub.marks_obtained >= 40 ? 'PASS' : 'FAIL'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* ─── ATTENDANCE SUMMARY ─── */}
          {card.attendance_summary && (
            <div className="bg-blue-50 border border-blue-300 rounded p-3">
              <h3 className="text-sm font-bold text-gray-900 mb-2">ATTENDANCE SUMMARY</h3>
              <div className="grid grid-cols-5 gap-3 text-xs">
                <div className="text-center">
                  <p className="text-gray-600 font-semibold">Working Days</p>
                  <p className="text-lg font-bold text-gray-900">{card.attendance_summary.working_days}</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-600 font-semibold">Days Present</p>
                  <p className="text-lg font-bold text-green-700">{card.attendance_summary.total_present_days}</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-600 font-semibold">Days Absent</p>
                  <p className="text-lg font-bold text-red-700">{(card.attendance_summary.working_days - card.attendance_summary.total_present_days).toFixed(1)}</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-600 font-semibold">Attendance %</p>
                  <p className="text-lg font-bold text-purple-700">{card.attendance_summary.attendance_percentage}%</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-600 font-semibold">Period</p>
                  <p className="text-xs text-gray-700">{card.attendance_summary.range_start} to {card.attendance_summary.range_end}</p>
                </div>
              </div>
            </div>
          )}

          {/* ─── TEACHER REMARKS ─── */}
          {card.class_teacher_remarks && (
            <div className="bg-yellow-50 border border-yellow-300 rounded p-3">
              <h3 className="text-sm font-bold text-gray-900 mb-2">TEACHER REMARKS</h3>
              <p className="text-xs text-gray-800 leading-relaxed">{card.class_teacher_remarks}</p>
            </div>
          )}

          {/* ─── SIGNATURE SECTION ─── */}
          <div className="mt-6 pt-4 border-t-2 border-gray-800">
            <div className="grid grid-cols-3 gap-6">
              {/* Class Teacher */}
              <div className="text-center">
                <div className="h-16 flex items-end justify-center mb-2">
                  <div className="w-32 border-t-2 border-gray-800"></div>
                </div>
                <p className="text-xs font-semibold text-gray-900">{card.class_teacher_name || 'Class Teacher'}</p>
                <p className="text-xs text-gray-600">Class Teacher Signature</p>
              </div>
              
              {/* Principal */}
              <div className="text-center">
                <div className="h-16 flex items-end justify-center mb-2">
                  <div className="w-32 border-t-2 border-gray-800"></div>
                </div>
                <p className="text-xs font-semibold text-gray-900">{card.principal_name || 'Principal'}</p>
                <p className="text-xs text-gray-600">Principal Signature</p>
              </div>
              
              {/* Parent/Guardian */}
              <div className="text-center">
                <div className="h-16 flex items-end justify-center mb-2">
                  <div className="w-32 border-t-2 border-gray-800"></div>
                </div>
                <p className="text-xs font-semibold text-gray-900">Parent/Guardian</p>
                <p className="text-xs text-gray-600">Parent Signature</p>
              </div>
            </div>
          </div>

          {/* ─── FOOTER ─── */}
          <div className="text-center border-t border-gray-300 pt-2 mt-4">
            <p className="text-xs text-gray-600">Generated: {new Date(card.generated_at).toLocaleDateString()}</p>
            <p className="text-xs text-gray-500">This is an official document from the school management system</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}