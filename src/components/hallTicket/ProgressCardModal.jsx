import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { printProgressCard } from './progressCardPrintHelper';

export default function ProgressCardModal({ card, isOpen, onClose }) {
  const { data: schoolProfile } = useQuery({
    queryKey: ['schoolProfile'],
    queryFn: async () => {
      const profiles = await base44.entities.SchoolProfile.list();
      return profiles[0] || null;
    }
  });

  if (!card) return null;

  const examName = card.exam_performance?.[0]?.exam_name || 'Exam';
  const subjects = card.exam_performance?.[0]?.subject_details || [];
  const att = card.attendance_summary || {};
  const attPct = parseFloat(att.attendance_percentage || 0);

  // Remarks
  let attRemark = '';
  if (attPct < 60) attRemark = 'Attendance is critically low. Immediate improvement is required.';
  else if (attPct < 80) attRemark = 'Needs to attend classes more regularly.';
  else attRemark = 'Attendance is satisfactory.';

  const lowSubjects = subjects.filter(s => s.max_marks > 0 && (s.marks_obtained / s.max_marks) * 100 < 70);
  const allExcellent = subjects.length > 0 && subjects.every(s => s.max_marks > 0 && (s.marks_obtained / s.max_marks) * 100 >= 90);
  let acaRemark = '';
  if (allExcellent) acaRemark = 'Excellent performance across all subjects. Keep it up!';
  else if (lowSubjects.length > 0) acaRemark = `Needs improvement in: ${lowSubjects.map(s => s.subject).join(', ')}.`;
  else acaRemark = 'Good overall performance. Keep up the effort.';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b">
          <DialogTitle className="text-base font-bold">Progress Card — {card.student_name}</DialogTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => printProgressCard(card, schoolProfile)}
            className="gap-2 print:hidden"
          >
            <Printer className="h-4 w-4" /> Print A4
          </Button>
        </DialogHeader>

        {/* Preview content — mirrors the print layout */}
        <div className="space-y-0 text-[10px]">

          {/* Header */}
          <div className="bg-gradient-to-r from-[#1a237e] to-[#3949ab] text-white p-4 flex items-center gap-4 -mx-1 rounded-t">
            {schoolProfile?.logo_url && (
              <img src={schoolProfile.logo_url} alt="Logo" className="w-12 h-12 object-contain rounded bg-white p-0.5 flex-shrink-0" />
            )}
            <div className="flex-1">
              <div className="text-base font-extrabold uppercase tracking-wide">{schoolProfile?.school_name || 'School'}</div>
              {schoolProfile?.address && <div className="text-[10px] text-blue-200 mt-0.5">{schoolProfile.address}</div>}
            </div>
            <div className="bg-white/20 rounded px-4 py-2 text-center font-bold text-xs whitespace-nowrap">
              {examName.toUpperCase()}<br />PROGRESS CARD
            </div>
          </div>

          {/* Student Info */}
          <div className="flex items-start gap-4 p-3 bg-[#f5f6ff] border-b-2 border-[#1a237e]">
            {card.student_photo_url ? (
              <img src={card.student_photo_url} alt="Student" className="w-16 h-20 object-cover rounded border-2 border-[#9fa8da] flex-shrink-0" />
            ) : (
              <div className="w-16 h-20 bg-[#e8eaf6] border-2 border-[#9fa8da] rounded flex-shrink-0 flex items-center justify-center text-[#3949ab] font-bold text-2xl">
                {(card.student_name || '?').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="grid grid-cols-3 gap-x-6 gap-y-2 flex-1">
              {[
                ['Student Name', card.student_name],
                ['Parent / Guardian', card.parent_name || '—'],
                ['Academic Year', card.academic_year],
                ['Class & Section', `${card.class_name} – ${card.section}`],
                ['Roll Number', card.roll_number || '—'],
                ['Overall %', `${(card.overall_stats?.overall_percentage || 0).toFixed(1)}% ${card.overall_stats?.overall_grade ? `(${card.overall_stats.overall_grade})` : ''}`]
              ].map(([label, value]) => (
                <div key={label}>
                  <div className="text-[8px] text-gray-400 font-semibold uppercase tracking-wide">{label}</div>
                  <div className="font-bold text-[11px] text-gray-900">{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Marks Table */}
          <div>
            <div className="bg-[#1a237e] text-white text-[9px] font-bold uppercase tracking-widest px-3 py-1.5">Subject-wise Marks</div>
            <div className="px-3 py-2">
              <table className="w-full border-collapse text-[9px]">
                <thead>
                  <tr className="bg-[#3949ab] text-white">
                    <th className="border border-[#5c6bc0] px-2 py-1.5 text-center w-8">S.No</th>
                    <th className="border border-[#5c6bc0] px-2 py-1.5 text-left">Subject</th>
                    <th className="border border-[#5c6bc0] px-2 py-1.5 text-center">Internal</th>
                    <th className="border border-[#5c6bc0] px-2 py-1.5 text-center">External</th>
                    <th className="border border-[#5c6bc0] px-2 py-1.5 text-center">Total</th>
                    <th className="border border-[#5c6bc0] px-2 py-1.5 text-center">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-3 text-gray-400 border border-gray-200">No marks data</td></tr>
                  ) : subjects.map((sub, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-[#f9fafb]' : 'bg-white'}>
                      <td className="border border-[#dde1f5] px-2 py-1 text-center">{i + 1}</td>
                      <td className="border border-[#dde1f5] px-2 py-1 font-semibold">{sub.subject}</td>
                      <td className="border border-[#dde1f5] px-2 py-1 text-center">{sub.internal_marks ?? '—'}</td>
                      <td className="border border-[#dde1f5] px-2 py-1 text-center">{sub.external_marks ?? '—'}</td>
                      <td className="border border-[#dde1f5] px-2 py-1 text-center">{sub.marks_obtained} / {sub.max_marks}</td>
                      <td className="border border-[#dde1f5] px-2 py-1 text-center font-bold text-[#1a237e]">{sub.grade || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Attendance */}
          <div>
            <div className="bg-[#1a237e] text-white text-[9px] font-bold uppercase tracking-widest px-3 py-1.5">Attendance Summary</div>
            <div className="px-3 py-2">
              {att.monthly_breakdown?.length > 0 ? (
                <table className="w-full border-collapse text-[9px]">
                  <thead>
                    <tr className="bg-[#3949ab] text-white">
                      <th className="border border-[#5c6bc0] px-2 py-1.5">Month</th>
                      <th className="border border-[#5c6bc0] px-2 py-1.5 text-center">Working Days</th>
                      <th className="border border-[#5c6bc0] px-2 py-1.5 text-center">Present</th>
                      <th className="border border-[#5c6bc0] px-2 py-1.5 text-center">Absent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {att.monthly_breakdown.map((m, i) => (
                      <tr key={i}>
                        <td className="border border-[#dde1f5] px-2 py-1">{m.month}</td>
                        <td className="border border-[#dde1f5] px-2 py-1 text-center">{m.working_days}</td>
                        <td className="border border-[#dde1f5] px-2 py-1 text-center text-green-700 font-semibold">{m.present_days}</td>
                        <td className="border border-[#dde1f5] px-2 py-1 text-center text-red-700 font-semibold">{m.absent_days ?? (m.working_days - m.present_days)}</td>
                      </tr>
                    ))}
                    <tr className="bg-[#e8eaf6] font-bold">
                      <td className="border border-[#dde1f5] px-2 py-1">Total</td>
                      <td className="border border-[#dde1f5] px-2 py-1 text-center">{att.monthly_breakdown.reduce((s, m) => s + (m.working_days || 0), 0)}</td>
                      <td className="border border-[#dde1f5] px-2 py-1 text-center text-green-700">{att.monthly_breakdown.reduce((s, m) => s + (m.present_days || 0), 0)}</td>
                      <td className="border border-[#dde1f5] px-2 py-1 text-center text-red-700">{att.monthly_breakdown.reduce((s, m) => s + (m.absent_days ?? (m.working_days - m.present_days) ?? 0), 0)}</td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <div className="grid grid-cols-4 gap-3 text-center">
                  {[
                    ['Working Days', att.working_days || 0, 'text-gray-900'],
                    ['Present', att.total_present_days || 0, 'text-green-700'],
                    ['Absent', (att.working_days || 0) - (att.total_present_days || 0), 'text-red-700'],
                    ['Attendance %', `${att.attendance_percentage || 0}%`, 'text-[#1a237e]'],
                  ].map(([label, val, color]) => (
                    <div key={label} className="bg-gray-50 border border-gray-200 rounded p-2">
                      <div className="text-[8px] text-gray-500 font-semibold">{label}</div>
                      <div className={`text-base font-bold ${color}`}>{val}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Remarks */}
          <div>
            <div className="bg-[#1a237e] text-white text-[9px] font-bold uppercase tracking-widest px-3 py-1.5">Remarks</div>
            <div className="mx-3 my-2 border border-[#9fa8da] rounded p-3 bg-[#fafbff]">
              <div className="flex gap-4">
                <div className="flex-1 border-r border-[#c5cae9] pr-4">
                  <div className="text-[8.5px] font-bold text-[#1a237e] uppercase tracking-wide mb-1">📅 Attendance Remark</div>
                  <div className="text-[9.5px] text-gray-700 leading-relaxed">{attRemark}</div>
                </div>
                <div className="flex-1">
                  <div className="text-[8.5px] font-bold text-[#1a237e] uppercase tracking-wide mb-1">📚 Academic Remark</div>
                  <div className="text-[9.5px] text-gray-700 leading-relaxed">{acaRemark}</div>
                </div>
              </div>
              {card.class_teacher_remarks && (
                <div className="mt-2 pt-2 border-t border-[#c5cae9]">
                  <div className="text-[8.5px] font-bold text-[#1a237e] uppercase tracking-wide mb-1">🎓 Class Teacher Remarks</div>
                  <div className="text-[9.5px] text-gray-700 leading-relaxed">{card.class_teacher_remarks}</div>
                </div>
              )}
            </div>
          </div>

          {/* Signatures */}
          <div className="flex justify-between px-8 pt-2 pb-1">
            {[
              [schoolProfile?.principal_name || 'Principal', 'Principal'],
              [card.class_teacher_name || 'Class Teacher', 'Class Teacher'],
              [card.parent_name || 'Parent / Guardian', 'Parent Signature'],
            ].map(([name, label]) => (
              <div key={label} className="text-center">
                <div className="w-24 border-t-2 border-gray-700 mt-8 mb-1 mx-auto" />
                <div className="text-[9px] font-bold text-[#1a237e]">{name}</div>
                <div className="text-[8px] text-gray-500">{label}</div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="text-center border-t border-gray-200 pt-1 pb-1 text-[8px] text-gray-400">
            Generated: {new Date(card.generated_at || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} &nbsp;|&nbsp; Official document from the school management system.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}