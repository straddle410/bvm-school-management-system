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

  // Fetch ClassSubjectConfig to sort subjects in correct order
  const { data: subjectOrder } = useQuery({
    queryKey: ['classSubjectConfig', card?.class_name],
    queryFn: async () => {
      if (!card?.class_name) return [];
      const configs = await base44.entities.ClassSubjectConfig.filter({ class_name: card.class_name });
      return configs[0]?.subject_names || [];
    },
    enabled: !!card?.class_name
  });

  // Fetch ExamMarksConfig to know if internal/external breakdown applies
  const examTypeId = card?.exam_performance?.[0]?.exam_type_id || card?.exam_performance?.[0]?.exam_type;
  const { data: examMarksConfig } = useQuery({
    queryKey: ['examMarksConfig', card?.class_name, examTypeId],
    queryFn: async () => {
      const results = await base44.entities.ExamMarksConfig.filter({
        class_name: card.class_name,
        exam_type_id: examTypeId
      });
      return results[0] || null;
    },
    enabled: !!card?.class_name && !!examTypeId
  });

  const { data: studentData } = useQuery({
    queryKey: ['student', card?.student_id],
    queryFn: async () => {
      if (!card?.student_id) return null;
      const results = await base44.entities.Student.filter({ student_id: card.student_id });
      return results[0] || null;
    },
    enabled: !!card?.student_id
  });

  if (!card) return null;

  // Sort subjects by ClassSubjectConfig order
  const sortSubjects = (subjects) => {
    if (!subjectOrder || subjectOrder.length === 0) return subjects;
    return [...subjects].sort((a, b) => {
      const ai = subjectOrder.indexOf(a.subject);
      const bi = subjectOrder.indexOf(b.subject);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  };

  // Enrich card with student data and sorted subjects
  const enrichedCard = {
    ...card,
    student_photo_url: card.student_photo_url || studentData?.photo_url || null,
    parent_name: card.parent_name || studentData?.parent_name || '—',
    roll_number: card.roll_number || studentData?.roll_no || '—',
    exam_performance: card.exam_performance?.map(ep => ({
      ...ep,
      subject_details: sortSubjects(ep.subject_details || [])
    }))
  };

  const examName = enrichedCard.exam_performance?.[0]?.exam_type_name || enrichedCard.exam_performance?.[0]?.exam_name || 'Exam';
  const subjects = enrichedCard.exam_performance?.[0]?.subject_details || [];

  // Detect internal/external from actual data first, fall back to config
  const hasInternal = subjects.some(s => s.internal_marks != null) || examMarksConfig?.has_internal_marks || false;
  const maxInternal = examMarksConfig?.max_internal_marks || (hasInternal ? subjects.reduce((m, s) => Math.max(m, s.internal_marks || 0), 0) : 0);
  const maxExternal = examMarksConfig?.max_external_marks || (hasInternal ? subjects.reduce((m, s) => Math.max(m, s.external_marks || 0), 0) : 100);
  const att = enrichedCard.attendance_summary || {};
  const attPct = parseFloat(att.attendance_percentage || 0);

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

  const totalObtained = subjects.reduce((s, sub) => s + (sub.marks_obtained || 0), 0);
  const totalMax = subjects.reduce((s, sub) => s + (sub.max_marks || 0), 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b">
          <DialogTitle className="text-base font-bold">Progress Card — {enrichedCard.student_name}</DialogTitle>
          <Button size="sm" variant="outline" onClick={() => printProgressCard(enrichedCard, schoolProfile, subjectOrder || [], examMarksConfig)} className="gap-2">
            <Printer className="h-4 w-4" /> Print A4
          </Button>
        </DialogHeader>

        <div className="text-[10px] border-2 border-gray-800 rounded overflow-hidden shadow-lg">

          {/* Header: centered */}
          <div className="bg-[#f2f2f2] text-[#111] px-4 py-3 flex items-center justify-center gap-3 border-b border-gray-400">
            {schoolProfile?.logo_url && (
              <img src={schoolProfile.logo_url} alt="Logo" className="w-11 h-11 object-contain rounded flex-shrink-0" />
            )}
            <div className="text-center">
              <div className="text-sm font-extrabold uppercase tracking-widest">{schoolProfile?.school_name || 'School'}</div>
              {schoolProfile?.address && <div className="text-[9px] text-gray-500 mt-0.5">{schoolProfile.address}</div>}
            </div>
          </div>

          {/* Badge: dynamic exam type + Progress Card */}
          <div className="bg-[#e8e8e8] text-[#111] text-center text-[10px] font-bold py-1 tracking-widest border-b border-gray-400 uppercase">
            {examName} Progress Card
          </div>

          {/* Student Info */}
          <div className="flex items-start gap-4 p-3 bg-[#fafafa] border-b border-gray-400">
            {enrichedCard.student_photo_url ? (
              <img src={enrichedCard.student_photo_url} alt="Student" className="w-16 h-20 object-cover rounded border border-gray-400 flex-shrink-0" />
            ) : (
              <div className="w-16 h-20 bg-[#eee] border border-gray-400 rounded flex-shrink-0 flex items-center justify-center text-gray-500 font-bold text-2xl">
                {(enrichedCard.student_name || '?').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="grid grid-cols-3 gap-x-6 gap-y-2 flex-1">
              {[
                ['Student Name', enrichedCard.student_name],
                ['Parent / Guardian', enrichedCard.parent_name],
                ['Academic Year', enrichedCard.academic_year],
                ['Class & Section', `${enrichedCard.class_name} – ${enrichedCard.section}`],
                ['Roll Number', enrichedCard.roll_number],
                ['Overall %', `${(enrichedCard.overall_stats?.overall_percentage || 0).toFixed(1)}%${enrichedCard.overall_stats?.overall_grade ? ` (${enrichedCard.overall_stats.overall_grade})` : ''}`]
              ].map(([label, value]) => (
                <div key={label}>
                  <div className="text-[7.5px] text-gray-500 leading-tight">{label}</div>
                  <div className="font-bold text-[10px] text-[#111]">{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Marks Table with Total row */}
          <div className="bg-[#e8e8e8] text-[#111] text-[9px] font-bold uppercase tracking-widest px-3 py-1 border-b border-gray-400">
            Subject-wise Marks
          </div>
          <div className="px-3 py-2">
            <table className="w-full border-collapse text-[9px]">
              <thead>
                <tr className="bg-[#e8e8e8] text-[#111]">
                  <th className="border border-gray-400 px-2 py-1.5 text-left font-bold">S.No</th>
                  <th className="border border-gray-400 px-2 py-1.5 text-left font-bold">Subject</th>
                  {hasInternal && <th className="border border-gray-400 px-2 py-1.5 text-center font-bold">Internal ({maxInternal})</th>}
                  {hasInternal && <th className="border border-gray-400 px-2 py-1.5 text-center font-bold">External ({maxExternal})</th>}
                  <th className="border border-gray-400 px-2 py-1.5 text-center font-bold">{hasInternal ? 'Total' : 'Marks'}</th>
                  <th className="border border-gray-400 px-2 py-1.5 text-center font-bold">Grade</th>
                </tr>
              </thead>
              <tbody>
                {subjects.length === 0 ? (
                  <tr><td colSpan={hasInternal ? 6 : 4} className="text-center py-3 text-gray-400 border border-gray-300">No marks data</td></tr>
                ) : subjects.map((sub, i) => (
                  <tr key={i} className="bg-white">
                    <td className="border border-gray-300 px-2 py-1 text-center">{i + 1}</td>
                    <td className="border border-gray-300 px-2 py-1 font-semibold">{sub.subject}</td>
                    {hasInternal && <td className="border border-gray-300 px-2 py-1 text-center">{sub.internal_marks ?? '—'}</td>}
                    {hasInternal && <td className="border border-gray-300 px-2 py-1 text-center">{sub.external_marks ?? '—'}</td>}
                    <td className="border border-gray-300 px-2 py-1 text-center">{sub.marks_obtained} / {sub.max_marks}</td>
                    <td className="border border-gray-300 px-2 py-1 text-center font-bold">{sub.grade || '—'}</td>
                  </tr>
                ))}
                {subjects.length > 0 && (
                  <tr className="bg-[#e8e8e8] font-bold">
                    <td colSpan={2} className="border border-gray-400 px-2 py-1 text-right">Total</td>
                    {hasInternal && <td className="border border-gray-400 px-2 py-1 text-center">—</td>}
                    {hasInternal && <td className="border border-gray-400 px-2 py-1 text-center">—</td>}
                    <td className="border border-gray-400 px-2 py-1 text-center">{totalObtained} / {totalMax}</td>
                    <td className="border border-gray-400 px-2 py-1 text-center">{(enrichedCard.overall_stats?.overall_percentage || 0).toFixed(1)}% ({enrichedCard.overall_stats?.overall_grade || '—'})</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Attendance */}
          <div className="bg-[#e8e8e8] text-[#111] text-[9px] font-bold uppercase tracking-widest px-3 py-1 border-t border-b border-gray-400">
            Attendance Summary
          </div>
          <div className="px-3 py-2">
            {att.monthly_breakdown?.length > 0 ? (
              <table className="w-full border-collapse text-[9px]">
                <thead>
                  <tr className="bg-[#e8e8e8] text-[#111]">
                    {['Month', 'Working Days', 'Present Days', 'Absent Days'].map(h => (
                      <th key={h} className="border border-gray-400 px-2 py-1.5 font-bold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {att.monthly_breakdown.map((m, i) => (
                    <tr key={i} className="bg-white">
                      <td className="border border-gray-300 px-2 py-1">{m.month}</td>
                      <td className="border border-gray-300 px-2 py-1 text-center">{m.working_days}</td>
                      <td className="border border-gray-300 px-2 py-1 text-center">{m.present_days}</td>
                      <td className="border border-gray-300 px-2 py-1 text-center">{m.absent_days ?? (m.working_days - m.present_days)}</td>
                    </tr>
                  ))}
                  <tr className="bg-[#e8e8e8] font-bold">
                    <td className="border border-gray-400 px-2 py-1">Total</td>
                    <td className="border border-gray-400 px-2 py-1 text-center">{att.monthly_breakdown.reduce((s, m) => s + (m.working_days || 0), 0)}</td>
                    <td className="border border-gray-400 px-2 py-1 text-center">{att.monthly_breakdown.reduce((s, m) => s + (m.present_days || 0), 0)}</td>
                    <td className="border border-gray-400 px-2 py-1 text-center">{att.monthly_breakdown.reduce((s, m) => s + ((m.absent_days ?? (m.working_days - m.present_days)) || 0), 0)}</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <div className="grid grid-cols-4 gap-3 text-center">
                {[
                  ['Working Days', att.working_days || 0],
                  ['Present', att.total_present_days || 0],
                  ['Absent', (att.working_days || 0) - (att.total_present_days || 0)],
                  ['Attendance %', `${att.attendance_percentage || 0}%`],
                ].map(([label, val]) => (
                  <div key={label} className="bg-[#f2f2f2] border border-gray-300 rounded p-2">
                    <div className="text-[8px] text-gray-500 font-semibold">{label}</div>
                    <div className="text-base font-bold text-[#111]">{val}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Remarks */}
          <div className="bg-[#e8e8e8] text-[#111] text-[9px] font-bold uppercase tracking-widest px-3 py-1 border-t border-b border-gray-400">
            Remarks
          </div>
          <div className="p-3 bg-[#fafafa]">
            <div className="flex gap-4">
              <div className="flex-1 border-r border-gray-300 pr-4">
                <div className="text-[8px] font-bold text-gray-500 uppercase tracking-wide mb-1">Attendance Remark</div>
                <div className="text-[9.5px] text-gray-700 leading-relaxed">{attRemark}</div>
              </div>
              <div className="flex-1">
                <div className="text-[8px] font-bold text-gray-500 uppercase tracking-wide mb-1">Academic Remark</div>
                <div className="text-[9.5px] text-gray-700 leading-relaxed">{acaRemark}</div>
              </div>
            </div>
            {enrichedCard.class_teacher_remarks && (
              <div className="mt-2 pt-2 border-t border-gray-300">
                <div className="text-[8px] font-bold text-gray-500 uppercase tracking-wide mb-1">Class Teacher Remarks</div>
                <div className="text-[9.5px] text-gray-700 leading-relaxed">{enrichedCard.class_teacher_remarks}</div>
              </div>
            )}
          </div>

          {/* Signatures */}
          <div className="flex justify-between px-8 pt-1 pb-2 border-t border-gray-400 bg-[#fafafa]">
            {[
              [schoolProfile?.principal_name || 'Principal', 'Principal'],
              [enrichedCard.class_teacher_name || 'Class Teacher', 'Class Teacher'],
              [enrichedCard.parent_name || 'Parent / Guardian', 'Parent Signature'],
            ].map(([name, label]) => (
              <div key={label} className="text-center">
                <div className="w-20 border-t border-gray-500 mt-8 mb-1 mx-auto" />
                <div className="text-[9px] font-bold text-[#111]">{name}</div>
                <div className="text-[8px] text-gray-500">{label}</div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="text-center bg-[#fafafa] border-t border-gray-300 py-1 text-[8px] text-gray-400">
            Generated: {new Date(enrichedCard.generated_at || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} &nbsp;|&nbsp; Official document from the school management system.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}