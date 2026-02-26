import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Printer, FileText, Calendar, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function StudentHallTicketView() {
  const [studentSession, setStudentSession] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const ss = localStorage.getItem('student_session');
    if (ss) setStudentSession(JSON.parse(ss));
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['studentHallTickets', studentSession?.student_id],
    queryFn: async () => {
      const response = await base44.functions.invoke('getStudentHallTickets', {
        student_id: studentSession.id  // Use DB id, which is what HallTicket stores
      });
      return response.data;
    },
    enabled: !!studentSession?.id
  });

  const hallTickets = data?.hallTickets || [];
  const schoolProfile = data?.schoolProfile;

  const handlePrint = () => window.print();

  if (!studentSession) {
    return <div className="p-6 text-center text-slate-600">Please log in first</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="flex items-center justify-between mb-4 print:hidden">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(createPageUrl('StudentDashboard'))}
            className="flex items-center gap-1 text-[#1a237e] font-medium text-sm"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-xl font-bold text-[#1a237e] flex items-center gap-2">
            <FileText className="h-6 w-6" /> My Hall Tickets
          </h1>
        </div>
        {hallTickets.length > 0 && (
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-[#1a237e] text-white px-3 py-2 rounded-lg text-sm font-medium"
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
        <>
          {/* Screen View */}
          <div className="space-y-6 print:hidden">
            {hallTickets.map((ticket) => (
              <HallTicketCard key={ticket.id} ticket={ticket} schoolProfile={schoolProfile} />
            ))}
          </div>

          {/* Print View - 3 per A4 page */}
          <div className="hidden print:block print-container">
            {hallTickets.map((ticket, index) => {
              const pagePosition = index % 3;
              const isLastTicket = index === hallTickets.length - 1;
              const needsPageBreak = (index + 1) % 3 === 0 || isLastTicket;

              return (
                <div
                  key={ticket.id}
                  className={`print-ticket-wrapper ${needsPageBreak ? 'page-break-after' : ''}`}
                  style={needsPageBreak ? { pageBreakAfter: 'always' } : {}}
                >
                  <HallTicketCard ticket={ticket} schoolProfile={schoolProfile} isPrint={true} />
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Print Styles - A4 3-per-page layout */}
      <style>{`
        @page {
          size: A4;
          margin: 0;
          padding: 0;
        }

        @media print {
          * {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            color-adjust: exact;
          }

          html, body {
            margin: 0;
            padding: 0;
            width: 210mm;
            height: 297mm;
            overflow: hidden;
          }

          .print-container {
            width: 210mm;
            display: flex;
            flex-direction: column;
          }

          .print-ticket-wrapper {
            width: 210mm;
            height: 99mm;
            page-break-inside: avoid;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }

          .print-ticket-wrapper.page-break-after {
            page-break-after: always;
          }

          .print-area {
            width: 100%;
            height: 99mm;
            display: flex;
            flex-direction: column;
            margin: 0;
            padding: 0;
            border: none;
            border-radius: 0;
            box-shadow: none;
            overflow: hidden;
            position: relative;
          }

          .print-header {
            padding: 3mm 4mm;
            font-size: 10pt;
            line-height: 1.2;
            flex-shrink: 0;
          }

          .print-header img {
            width: 8mm;
            height: 8mm;
            margin: 1mm auto;
          }

          .print-school-name {
            font-size: 11pt;
            font-weight: bold;
            letter-spacing: 0.05em;
            margin: 1mm 0;
          }

          .print-header p {
            font-size: 7pt;
            margin: 0.5mm 0;
          }

          .print-header > div {
            font-size: 8pt;
            margin: 1.5mm 0 0 0;
            padding: 1mm 3mm;
          }

          /* Student Info Section - Compact */
          .print-area > div:nth-child(2) {
            padding: 2mm 3mm;
            flex-shrink: 0;
            display: flex;
            gap: 3mm;
          }

          .print-area > div:nth-child(2) img {
            width: 14mm;
            height: 18mm;
            object-fit: cover;
            border: 0.5mm solid #000;
            flex-shrink: 0;
          }

          .print-area > div:nth-child(2) .grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 1.5mm 3mm;
            font-size: 7pt;
            line-height: 1.1;
            flex: 1;
          }

          .print-label {
            font-size: 6pt;
            font-weight: bold;
            color: #000 !important;
            margin-bottom: 0.2mm;
          }

          .print-value {
            font-size: 7pt;
            color: #000 !important;
            font-weight: 600;
          }

          /* QR Code */
          img[alt="QR Code"] {
            width: 14mm;
            height: 14mm;
            border: 0.5mm solid #000;
          }

          /* Exam Schedule Table - Compact */
          .print-area > div:nth-child(3) {
            padding: 2mm 3mm;
            flex: 1;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            font-size: 6.5pt;
            line-height: 1;
          }

          .print-area > div:nth-child(3) h3 {
            font-size: 7pt;
            font-weight: bold;
            margin: 0 0 1mm 0;
            display: flex;
            align-items: center;
            gap: 1mm;
          }

          .print-area > div:nth-child(3) h3 svg {
            width: 3mm;
            height: 3mm;
          }

          .print-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 6.5pt;
            line-height: 1;
          }

          .print-table th {
            background: #000 !important;
            color: #fff !important;
            border: 0.5mm solid #000 !important;
            padding: 1mm;
            font-size: 6pt;
            font-weight: bold;
            text-align: left;
          }

          .print-table td {
            border: 0.5mm solid #000 !important;
            padding: 0.8mm;
            color: #000 !important;
            text-align: left;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .print-table tr {
            background: #fff !important;
          }

          .print-table tr:nth-child(odd) td {
            background: #f5f5f5 !important;
          }

          /* Instructions - Hidden for 3-per-page to save space */
          .print-instructions {
            display: none;
          }

          /* Signatures - Minimal space */
          .print-area > div:nth-child(5) {
            padding: 1mm 3mm 2mm;
            display: flex;
            justify-content: space-between;
            font-size: 5pt;
            flex-shrink: 0;
          }

          .print-area > div:nth-child(5) .text-center {
            text-align: center;
            flex: 1;
          }

          .print-area > div:nth-child(5) .border-t {
            width: 12mm;
            border-top: 0.3mm solid #000;
            margin: 2mm 0 0.5mm;
          }

          /* Overflow handling */
          .overflow-x-auto {
            overflow: visible !important;
            width: 100%;
          }

          .overflow-x-auto table {
            width: 100%;
          }

          /* Disable all rounded corners */
          * {
            border-radius: 0 !important;
          }

          /* Print at 100% - disable scaling */
          body {
            transform: scale(1);
            -webkit-transform: scale(1);
            transform-origin: 0 0;
          }
        }
      `}</style>
    </div>
  );
}

function HallTicketCard({ ticket, schoolProfile, isPrint = false }) {
  const [qrCode, setQrCode] = useState(null);

  useEffect(() => {
    if (ticket) {
      const qrData = JSON.stringify({
        hall_ticket_number: ticket.hall_ticket_number,
        academic_year: ticket.academic_year,
        student_name: ticket.student_name,
        class_name: ticket.class_name
      });
      
      // Generate QR code via free API (no npm dependency)
      const encodedData = encodeURIComponent(qrData);
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodedData}`;
      setQrCode(qrUrl);
    }
  }, [ticket]);

  return (
    <div className={`print-area ${!isPrint ? 'bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-200' : ''}`}>
      {/* Header */}
      <div className="print-header bg-[#1a237e] text-white p-4 text-center">
        {schoolProfile?.logo_url && (
          <img src={schoolProfile.logo_url} alt="Logo" className="h-12 w-12 object-contain mx-auto mb-2 rounded" />
        )}
        <h2 className="print-school-name text-lg font-bold uppercase tracking-[0.15em]">{schoolProfile?.school_name || 'BVM School of Excellence'}</h2>
        {schoolProfile?.address && <p className="text-blue-200 text-xs mt-0.5">{schoolProfile.address}</p>}
        <div className="mt-3 bg-white/20 rounded-lg px-4 py-1 inline-block">
          <span className="text-sm font-semibold tracking-wide">HALL TICKET – {ticket.exam_type_name || ticket.exam_type}</span>
        </div>
      </div>

      {/* Student Info */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-start gap-4">
          <div className="flex flex-col gap-2">
            {ticket.student_photo_url && (
              <img
                src={ticket.student_photo_url}
                alt="Student"
                className="h-20 w-16 object-cover rounded-lg border-2 border-gray-300 flex-shrink-0"
              />
            )}
            {qrCode && (
              <div className="border border-gray-300 p-1 rounded-lg bg-white">
                <img src={qrCode} alt="QR Code" className="w-16 h-16" />
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm flex-1">
            <div>
              <p className="print-label text-slate-500 text-xs">Student Name</p>
              <p className="print-value font-bold text-slate-800">{ticket.student_name}</p>
            </div>
            <div>
              <p className="print-label text-slate-500 text-xs">Hall Ticket No.</p>
              <p className="print-value font-bold text-blue-700 text-base">{ticket.hall_ticket_number}</p>
            </div>
            <div>
              <p className="print-label text-slate-500 text-xs">Class & Section</p>
              <p className="print-value font-semibold text-slate-700">{ticket.class_name} – {ticket.section}</p>
            </div>
            <div>
              <p className="print-label text-slate-500 text-xs">Roll Number</p>
              <p className="print-value font-semibold text-slate-700">{ticket.roll_number || '—'}</p>
            </div>
            <div>
              <p className="print-label text-slate-500 text-xs">Academic Year</p>
              <p className="print-value font-semibold text-slate-700">{ticket.academic_year}</p>
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
            <table className="print-table w-full text-sm border-collapse border border-gray-300">
              <thead>
                <tr className="bg-[#1a237e] text-white">
                  <th className="text-left px-3 py-2 text-xs font-semibold border border-gray-400">Date</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold border border-gray-400">Day</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold border border-gray-400">Subject</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold border border-gray-400">Time</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold border border-gray-400">Room</th>
                </tr>
              </thead>
              <tbody>
                {ticket.timetable.map((entry, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="px-3 py-2 font-medium text-slate-700 border border-gray-300">
                      {entry.exam_date ? new Date(entry.exam_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    <td className="px-3 py-2 text-slate-700 border border-gray-300">
                      {entry.day || (entry.exam_date ? new Date(entry.exam_date).toLocaleDateString('en-IN', { weekday: 'short' }) : '—')}
                    </td>
                    <td className="px-3 py-2 font-semibold text-slate-800 border border-gray-300">{entry.subject_name}</td>
                    <td className="px-3 py-2 text-slate-700 border border-gray-300">
                      {entry.start_time} – {entry.end_time}
                    </td>
                    <td className="px-3 py-2 text-slate-700 border border-gray-300">{entry.room_number || '—'}</td>
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
      <div className="print-instructions mx-4 mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
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