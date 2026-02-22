import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Printer, FileText, Calendar, Clock, MapPin } from 'lucide-react';

export default function StudentHallTicketView() {
  const [studentSession, setStudentSession] = useState(null);

  useEffect(() => {
    const ss = localStorage.getItem('student_session');
    if (ss) setStudentSession(JSON.parse(ss));
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['studentHallTickets', studentSession?.student_id],
    queryFn: async () => {
      const response = await base44.functions.invoke('getStudentHallTickets', {
        student_id: studentSession.student_id
      });
      return response.data;
    },
    enabled: !!studentSession?.student_id
  });

  const hallTickets = data?.hallTickets || [];
  const schoolProfile = data?.schoolProfile;

  const handlePrint = () => window.print();

  if (!studentSession) {
    return <div className="p-6 text-center text-slate-600">Please log in first</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-[#1a237e] flex items-center gap-2">
          <FileText className="h-6 w-6" /> My Hall Tickets
        </h1>
        {hallTickets.length > 0 && (
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-[#1a237e] text-white px-3 py-2 rounded-lg text-sm font-medium print:hidden"
          >
            <Printer className="h-4 w-4" /> Print
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-slate-500">Loading hall tickets...</div>
      ) : hallTickets.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
          <AlertCircle className="w-10 h-10 mx-auto mb-3 text-yellow-500" />
          <p className="text-slate-600 font-medium">No hall tickets published yet</p>
          <p className="text-slate-400 text-sm mt-1">Check back after your exam schedule is published.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {hallTickets.map((ticket) => (
            <HallTicketCard key={ticket.id} ticket={ticket} schoolProfile={schoolProfile} />
          ))}
        </div>
      )}

      {/* Print Styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}

function HallTicketCard({ ticket, schoolProfile }) {
  return (
    <div className="print-area bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200">
      {/* Header */}
      <div className="bg-[#1a237e] text-white p-4 text-center">
        {schoolProfile?.logo_url && (
          <img src={schoolProfile.logo_url} alt="Logo" className="h-12 w-12 object-contain mx-auto mb-2 rounded" />
        )}
        <h2 className="text-lg font-bold">{schoolProfile?.school_name || 'BVM School of Excellence'}</h2>
        {schoolProfile?.address && <p className="text-blue-200 text-xs mt-0.5">{schoolProfile.address}</p>}
        <div className="mt-3 bg-white/20 rounded-lg px-4 py-1 inline-block">
          <span className="text-sm font-semibold tracking-wide">HALL TICKET – {ticket.exam_type}</span>
        </div>
      </div>

      {/* Student Info */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-start gap-4">
          {ticket.student_photo_url && (
            <img
              src={ticket.student_photo_url}
              alt="Student"
              className="h-20 w-16 object-cover rounded-lg border-2 border-gray-200 flex-shrink-0"
            />
          )}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm flex-1">
            <div>
              <p className="text-slate-400 text-xs">Student Name</p>
              <p className="font-bold text-slate-800">{ticket.student_name}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs">Hall Ticket No.</p>
              <p className="font-bold text-blue-700 text-base">{ticket.hall_ticket_number}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs">Class & Section</p>
              <p className="font-semibold text-slate-700">{ticket.class_name} – {ticket.section}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs">Roll Number</p>
              <p className="font-semibold text-slate-700">{ticket.roll_number || '—'}</p>
            </div>
            <div>
              <p className="text-slate-400 text-xs">Academic Year</p>
              <p className="font-semibold text-slate-700">{ticket.academic_year}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Exam Schedule Table */}
      <div className="p-4">
        <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-[#1a237e]" /> Exam Schedule
        </h3>
        {ticket.timetable && ticket.timetable.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-[#1a237e] text-white">
                  <th className="text-left px-3 py-2 text-xs font-semibold rounded-tl-lg">Date</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold">Day</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold">Subject</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold">Time</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold rounded-tr-lg">Room</th>
                </tr>
              </thead>
              <tbody>
                {ticket.timetable.map((entry, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="px-3 py-2 font-medium text-slate-700">
                      {entry.exam_date ? new Date(entry.exam_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {entry.day || (entry.exam_date ? new Date(entry.exam_date).toLocaleDateString('en-IN', { weekday: 'short' }) : '—')}
                    </td>
                    <td className="px-3 py-2 font-semibold text-slate-800">{entry.subject_name}</td>
                    <td className="px-3 py-2 text-slate-600">
                      {entry.start_time} – {entry.end_time}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{entry.room_number || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-4 text-slate-400 text-sm bg-slate-50 rounded-lg">
            Exam timetable not yet assigned for this exam.
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
  );
}