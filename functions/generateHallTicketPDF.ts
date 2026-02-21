import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import jsPDFModule from 'npm:jspdf@4.0.0';

const jsPDF = jsPDFModule.jsPDF || jsPDFModule;

const generatePDF = async (hallTickets, schoolProfile, timetable, examType) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const ticketsPerPage = 3;
    const margin = 10;
    const ticketHeight = (pageHeight - 2 * margin) / ticketsPerPage;

    hallTickets.forEach((ticket, index) => {
      const ticketIndex = index % ticketsPerPage;

      if (index > 0 && ticketIndex === 0) {
        doc.addPage();
      }

      const yStart = margin + (ticketIndex * ticketHeight);
      const ticketWidth = pageWidth - 2 * margin;

      // Border
      doc.setLineWidth(0.8);
      doc.rect(margin, yStart, ticketWidth, ticketHeight);

      let yPos = yStart + 2;

      // School name
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text('BVM SCHOOL OF EXCELLENCE, KOTHAKOTA', pageWidth / 2, yPos, { align: 'center' });
      yPos += 4;

      // Exam type
      doc.setFontSize(8.5);
      doc.setFont(undefined, 'bold');
      const examTypeText = examType ? `${examType.name} HALL TICKET - 2023` : 'EXAM HALL TICKET - 2023';
      doc.text(examTypeText, pageWidth / 2, yPos, { align: 'center' });
      yPos += 4.5;

      // Student info
      doc.setFontSize(7);
      doc.setFont(undefined, 'bold');
      const labelX = margin + 1.5;
      const valueX = margin + 30;

      doc.text('STUDENT NAME :', labelX, yPos);
      doc.setFont(undefined, 'normal');
      doc.text(ticket.student_name || '', valueX, yPos);
      yPos += 3;

      doc.setFont(undefined, 'bold');
      doc.text('STUDENT NUMBER :', labelX, yPos);
      doc.setFont(undefined, 'normal');
      doc.text(ticket.hall_ticket_number || '', valueX, yPos);
      yPos += 3;

      doc.setFont(undefined, 'bold');
      doc.text('TIMINGS :', labelX, yPos);
      doc.setFont(undefined, 'normal');
      doc.text('9:30 AM TO 12:30 PM', valueX, yPos);
      yPos += 4;

      // Table
      const tableLeft = margin + 1.5;
      const tableWidth = ticketWidth - 3;
      const subjects = ['TELUGU', 'HINDI', 'ENGLISH', 'MATHEMATICS', 'GEN. SCIENCE', 'SOCIAL'];

      // Table header
      doc.setLineWidth(0.5);
      doc.setFontSize(6.5);
      doc.setFont(undefined, 'bold');

      const colSubject = tableLeft;
      const colDate = colSubject + (tableWidth * 0.4);
      const colSign = colDate + (tableWidth * 0.25);

      const headerH = 4;
      const rowH = 3.5;

      doc.rect(colSubject, yPos, tableWidth * 0.4, headerH);
      doc.rect(colDate, yPos, tableWidth * 0.25, headerH);
      doc.rect(colSign, yPos, tableWidth * 0.35, headerH);

      doc.text('SUBJECT', colSubject + 0.5, yPos + 2.8);
      doc.text('DATE', colDate + 0.5, yPos + 2.8);
      doc.text('INVIGILATOR SIGN', colSign + 0.5, yPos + 2.8);

      yPos += headerH;

      // Table rows
      doc.setFont(undefined, 'normal');
      doc.setFontSize(6);

      for (const subject of subjects) {
        doc.rect(colSubject, yPos, tableWidth * 0.4, rowH);
        doc.rect(colDate, yPos, tableWidth * 0.25, rowH);
        doc.rect(colSign, yPos, tableWidth * 0.35, rowH);

        doc.text(subject, colSubject + 0.5, yPos + 2.5);

        const ttEntry = timetable.find(t => t.subject_name === subject);
        if (ttEntry && ttEntry.exam_date) {
          const dateStr = new Date(ttEntry.exam_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' });
          doc.text(dateStr, colDate + 0.5, yPos + 2.5);
        }

        yPos += rowH;
      }

      // Signatures
      yPos += 1.5;
      doc.setFont(undefined, 'bold');
      doc.setFontSize(6);

      const sigH = 5;
      doc.rect(colSubject, yPos, tableWidth * 0.4, sigH);
      doc.rect(colSign, yPos, tableWidth * 0.35, sigH);

      doc.text('AO SIGNATURE', colSubject + 0.5, yPos + sigH + 1);
      doc.text('PRINCIPAL SIGNATURE', colSign + 0.5, yPos + sigH + 1);
    });

    return doc.output('arraybuffer');
  };

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { hallTicketIds, staffSession } = payload;

    // Parse staff session - if provided use it, otherwise skip auth check
    let user = null;
    if (staffSession) {
      try {
        user = typeof staffSession === 'string' ? JSON.parse(staffSession) : staffSession;
      } catch (e) {
        console.error('Failed to parse staff session:', e.message);
      }
    }

    // If no staff session, try base44 auth but don't fail
    if (!user) {
      try {
        user = await base44.auth.me();
      } catch (e) {
        console.error('Base44 auth failed:', e.message);
        // Continue without user - just generate the PDF
      }
    }

    if (!hallTicketIds || hallTicketIds.length === 0) {
      return Response.json({ error: 'No hall tickets selected' }, { status: 400 });
    }

    // Fetch hall tickets with error handling
    const hallTickets = [];
    for (const id of hallTicketIds) {
      const ticket = await base44.asServiceRole.entities.HallTicket.get(id);
      if (ticket) hallTickets.push(ticket);
    }

    if (hallTickets.length === 0) {
      return Response.json({ error: 'No hall tickets found' }, { status: 404 });
    }

    // Fetch school profile, exam type, and timetable
    const [schoolProfiles, examTypeData, timetableList] = await Promise.all([
      base44.asServiceRole.entities.SchoolProfile.list(),
      base44.asServiceRole.entities.ExamType.get(hallTickets[0].exam_type),
      base44.asServiceRole.entities.ExamTimetable.filter({
        exam_type: hallTickets[0].exam_type,
        academic_year: hallTickets[0].academic_year
      })
    ]);
    const schoolProfile = schoolProfiles[0];

    // Generate PDF
    const pdfBuffer = await generatePDF(hallTickets, schoolProfile, timetableList, examTypeData);

    // Log download
    try {
      await base44.asServiceRole.entities.HallTicketLog.create({
        action: 'downloaded',
        hall_ticket_id: hallTicketIds[0],
        student_id: 'multiple',
        performed_by: user?.email || 'system',
        details: `Downloaded PDF for ${hallTickets.length} hall tickets`
      });
    } catch (e) {
      console.error('Failed to log download:', e.message);
    }

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename=hall_tickets.pdf'
      }
    });
  } catch (error) {
    console.error('[generateHallTicketPDF Error]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});