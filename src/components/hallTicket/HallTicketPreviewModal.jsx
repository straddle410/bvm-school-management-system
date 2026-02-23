import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { X, Calendar, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function HallTicketPreviewModal({ ticket, onClose }) {
  const { data: schoolProfile } = useQuery({
    queryKey: ['schoolProfile'],
    queryFn: async () => {
      const profiles = await base44.entities.SchoolProfile.list();
      return profiles[0] || null;
    }
  });

  const { data: examTypes = [] } = useQuery({
    queryKey: ['examTypes'],
    queryFn: () => base44.entities.ExamType.list()
  });

  const { data: timetable = [] } = useQuery({
    queryKey: ['timetablePreview', ticket?.exam_type, ticket?.academic_year, ticket?.class_name],
    queryFn: () => base44.entities.ExamTimetable.filter(
      { exam_type: ticket.exam_type, academic_year: ticket.academic_year, class_name: ticket.class_name },
      'exam_date'
    ),
    enabled: !!ticket
  });

  if (!ticket) return null;

  const examTypeName = examTypes.find(e => e.id === ticket.exam_type)?.name || ticket.exam_type;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        {/* Modal Controls */}
        <div className="flex justify-between items-center px-4 py-3 border-b print:hidden">
        <span className="font-semibold text-slate-700">Hall Ticket Preview</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => {
            const printContent = document.getElementById('hall-ticket-print-area');
            const win = window.open('', '_blank');
            win.document.write(`<html><head><title>Hall Ticket</title><style>
              @page { size: A5 landscape; margin: 6mm; }
              @media print { body { width: 148mm; } }
              * { box-sizing: border-box; }
              body { font-family: Arial, sans-serif; margin: 0; padding: 0; width: 148mm; font-size: 10px; }
              .bg-header { background-color: #1a237e !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; padding: 6px; text-align: center; }
              .bg-header h2 { font-size: 12px; font-weight: bold; margin: 2px 0; letter-spacing: 0.1em; text-transform: uppercase; }
              .bg-header p { font-size: 9px; margin: 1px 0; color: #ccd; }
              .exam-badge { background: rgba(255,255,255,0.2); display: inline-block; padding: 2px 10px; border-radius: 4px; font-size: 10px; font-weight: 600; margin-top: 3px; }
              .logo { height: 36px; width: 36px; object-fit: contain; border-radius: 3px; display: block; margin: 0 auto 4px; }
              .student-section { display: flex; gap: 10px; padding: 6px 8px; border-bottom: 1px solid #ddd; }
              .student-photo { width: 52px; height: 64px; object-fit: cover; border: 1px solid #ccc; border-radius: 4px; flex-shrink: 0; }
              .student-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 12px; flex: 1; }
              .field-label { font-size: 8px; color: #888; margin-bottom: 1px; }
              .field-value { font-size: 10px; font-weight: 600; color: #222; }
              .field-value.ht-no { color: #1a237e; font-size: 12px; }
              .schedule-section { padding: 5px 8px; }
              .schedule-title { font-size: 10px; font-weight: 700; color: #333; margin-bottom: 4px; }
              table { border-collapse: collapse; width: 100%; font-size: 9px; }
              th { background-color: #1a237e !important; color: white !important; padding: 3px 5px; text-align: left; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              td { border: 1px solid #ccc; padding: 3px 5px; }
              tr:nth-child(even) td { background: #f7f7f7; }
              .instructions { margin: 4px 8px; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 4px; padding: 4px 6px; }
              .instructions p { font-size: 8px; font-weight: 700; color: #92400e; margin: 0 0 2px 0; }
              .instructions ul { margin: 0; padding-left: 12px; }
              .instructions li { font-size: 8px; color: #78350f; line-height: 1.4; }
              .signatures { display: flex; justify-content: space-between; padding: 6px 16px 4px; }
              .sig { text-align: center; font-size: 8px; color: #666; }
              .sig-line { border-top: 1px solid #999; width: 70px; margin: 20px auto 2px; }
            </style></head><body>
              <div class="bg-header">
                ${printContent.querySelector('img') ? `<img src="${printContent.querySelector('img').src}" class="logo" />` : ''}
                <h2>${printContent.querySelector('h2')?.innerText || ''}</h2>
                <p>${printContent.querySelectorAll('p')[0]?.innerText || ''}</p>
                <div class="exam-badge">${printContent.querySelector('.bg-\\[\\#1a237e\\] .inline-block span')?.innerText || 'HALL TICKET'}</div>
              </div>
              ${printContent.innerHTML}
            </body></html>`);
            win.document.close();
            win.focus();
            setTimeout(() => { win.print(); win.close(); }, 400);
          }} className="gap-1">
            <Printer className="w-4 h-4" /> Print
          </Button>
            <Button size="icon" variant="ghost" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Hall Ticket Content */}
        <div className="print-area" id="hall-ticket-print-area">
          {/* Header */}
          <div className="bg-[#1a237e] text-white p-4 text-center">
            {schoolProfile?.logo_url && (
              <img src={schoolProfile.logo_url} alt="Logo" className="h-12 w-12 object-contain mx-auto mb-2 rounded" />
            )}
            <h2 className="text-lg font-bold uppercase tracking-[0.12em]">{schoolProfile?.school_name || 'School'}</h2>
            {schoolProfile?.address && <p className="text-blue-200 text-xs mt-0.5">{schoolProfile.address}</p>}
            <div className="mt-2 bg-white/20 rounded-lg px-4 py-1 inline-block">
              <span className="text-sm font-semibold tracking-wide">HALL TICKET – {examTypeName}</span>
            </div>
          </div>

          {/* Student Info */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-start gap-4">
              {ticket.student_photo_url && (
                <img src={ticket.student_photo_url} alt="Student" className="h-20 w-16 object-cover rounded-lg border-2 border-gray-300 flex-shrink-0" />
              )}
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm flex-1">
                <div>
                  <p className="text-slate-500 text-xs">Student Name</p>
                  <p className="font-bold text-slate-800">{ticket.student_name}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Hall Ticket No.</p>
                  <p className="font-bold text-blue-700 text-base">{ticket.hall_ticket_number}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Class & Section</p>
                  <p className="font-semibold text-slate-700">{ticket.class_name} – {ticket.section}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Roll Number</p>
                  <p className="font-semibold text-slate-700">{ticket.roll_number || '—'}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Academic Year</p>
                  <p className="font-semibold text-slate-700">{ticket.academic_year}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs">Status</p>
                  <p className="font-semibold text-slate-700">{ticket.status}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Exam Schedule */}
          <div className="p-4">
            <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-[#1a237e]" /> Exam Schedule
            </h3>
            {timetable.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-[#1a237e] text-white">
                      <th className="text-left px-3 py-2 text-xs border border-gray-400">Date</th>
                      <th className="text-left px-3 py-2 text-xs border border-gray-400">Day</th>
                      <th className="text-left px-3 py-2 text-xs border border-gray-400">Subject</th>
                      <th className="text-left px-3 py-2 text-xs border border-gray-400">Time</th>
                      <th className="text-left px-3 py-2 text-xs border border-gray-400">Room</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timetable.map((entry, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                        <td className="px-3 py-2 border border-gray-300 text-slate-700">
                          {entry.exam_date ? new Date(entry.exam_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                        <td className="px-3 py-2 border border-gray-300 text-slate-700">{entry.day || '—'}</td>
                        <td className="px-3 py-2 border border-gray-300 font-semibold text-slate-800">{entry.subject_name}</td>
                        <td className="px-3 py-2 border border-gray-300 text-slate-700">{entry.start_time} – {entry.end_time}</td>
                        <td className="px-3 py-2 border border-gray-300 text-slate-700">{entry.room_number || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-4 text-slate-400 text-sm bg-slate-50 rounded-lg">
                Timetable not yet assigned for this exam.
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="mx-4 mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <p className="text-xs font-bold text-yellow-800 mb-1">Important Instructions:</p>
            <ul className="text-xs text-yellow-700 space-y-0.5 list-disc list-inside">
              <li>Carry this hall ticket to every exam.</li>
              <li>Report 15 minutes before the exam starts.</li>
              <li>Electronic devices are not permitted in the exam hall.</li>
              <li>Hall ticket must be produced on demand by the invigilator.</li>
            </ul>
          </div>

          {/* Signatures */}
          <div className="mx-4 mb-4 flex justify-between text-xs text-slate-500">
            <div className="text-center">
              <div className="border-t border-slate-400 w-24 mt-8 mb-1"></div>
              <p>Student Signature</p>
            </div>
            <div className="text-center">
              <div className="border-t border-slate-400 w-24 mt-8 mb-1"></div>
              <p>Principal Signature</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}