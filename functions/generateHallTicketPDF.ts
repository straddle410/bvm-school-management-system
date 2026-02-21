import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import jsPDFModule from 'npm:jspdf@4.0.0';

const jsPDF = jsPDFModule.jsPDF || jsPDFModule;

const generatePDF = async (hallTickets, schoolProfile, timetable, examType) => {
    const doc = new jsPDF('p', 'mm', 'a4');

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginTop = 8;
    const marginLeft = 8;
    const marginRight = 8;
    const ticketHeight = (pageHeight - 2 * marginTop) / 3;

    // 3 tickets per page
    hallTickets.forEach((ticket, index) => {
      const ticketIndex = index % 3;

      if (index > 0 && ticketIndex === 0) {
        doc.addPage();
      }

      let yPos = marginTop + (ticketIndex * ticketHeight);
      const ticketStartY = yPos;
      const ticketWidth = pageWidth - marginLeft - marginRight;

      // Outer border - thick
      doc.setLineWidth(1);
      doc.setDrawColor(0);
      doc.rect(marginLeft, yPos, ticketWidth, ticketHeight);

      yPos += 2.5;

      // School name
      doc.setFontSize(10);
      doc.setFont(undefined, 'bold');
      doc.text('BVM SCHOOL OF EXCELLENCE', pageWidth / 2, yPos, { align: 'center' });
      yPos += 4;

      // Exam type
      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      const examTypeText = examType ? `${examType.name} HALL TICKET - 2023` : 'EXAM HALL TICKET - 2023';
      doc.text(examTypeText, pageWidth / 2, yPos, { align: 'center' });
      yPos += 5;

      // Student Details
      doc.setFontSize(7.5);
      doc.setFont(undefined, 'bold');

      const detailStartX = marginLeft + 2;
      const detailValueX = marginLeft + 32;

      doc.text('STUDENT NAME :', detailStartX, yPos);
      doc.setFont(undefined, 'normal');
      doc.text(ticket.student_name || '', detailValueX, yPos);
      yPos += 3.5;

      doc.setFont(undefined, 'bold');
      doc.text('STUDENT NUMBER :', detailStartX, yPos);
      doc.setFont(undefined, 'normal');
      doc.text(ticket.hall_ticket_number || '', detailValueX, yPos);
      yPos += 3.5;

      doc.setFont(undefined, 'bold');
      doc.text('TIMINGS :', detailStartX, yPos);
      doc.setFont(undefined, 'normal');
      doc.text('9:30 AM TO 12:30 PM', detailValueX, yPos);
      yPos += 4.5;

      // Single table spanning full width
      const tableStartX = marginLeft + 1.5;
      const tableEndX = marginLeft + ticketWidth - 1.5;
      const tableWidth = tableEndX - tableStartX;

      // Column widths
      const subjectColWidth = tableWidth * 0.40;
      const dateColWidth = tableWidth * 0.25;
      const signColWidth = tableWidth * 0.35;

      const colSubject = tableStartX;
      const colDate = colSubject + subjectColWidth;
      const colSign = colDate + dateColWidth;

      const headerHeight = 4.5;
      const rowHeight = 3.8;

      // Table header
      doc.setLineWidth(0.6);
      doc.setFontSize(7);
      doc.setFont(undefined, 'bold');

      // Header cells
      doc.rect(colSubject, yPos, subjectColWidth, headerHeight);
      doc.rect(colDate, yPos, dateColWidth, headerHeight);
      doc.rect(colSign, yPos, signColWidth, headerHeight);

      doc.text('SUBJECT', colSubject + 1, yPos + 3.2);
      doc.text('DATE', colDate + 1, yPos + 3.2);
      doc.text('INVIGILATOR SIGN', colSign + 1, yPos + 3.2);

      yPos += headerHeight;

      // Subjects in order
      const subjects = ['TELUGU', 'HINDI', 'ENGLISH', 'MATHEMATICS', 'GEN. SCIENCE', 'SOCIAL'];

      doc.setFont(undefined, 'normal');
      doc.setFontSize(6.5);

      for (let i = 0; i < 6; i++) {
        // Row cells
        doc.rect(colSubject, yPos, subjectColWidth, rowHeight);
        doc.rect(colDate, yPos, dateColWidth, rowHeight);
        doc.rect(colSign, yPos, signColWidth, rowHeight);

        // Subject
        doc.text(subjects[i], colSubject + 1, yPos + 2.8);

        // Date from timetable
        const subject = timetable.find(t => t.subject_name === subjects[i]);
        if (subject && subject.exam_date) {
          const dateStr = new Date(subject.exam_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' });
          doc.text(dateStr, colDate + 1, yPos + 2.8);
        }

        yPos += rowHeight;
      }

      // Signature section - same horizontal line
      yPos += 2;
      const sigHeight = 6;

      doc.setLineWidth(0.6);
      doc.setFontSize(6.5);
      doc.setFont(undefined, 'bold');

      // Left signature box (under SUBJECT column)
      doc.rect(colSubject, yPos, subjectColWidth, sigHeight);
      doc.text('AO SIGNATURE', colSubject + 1, yPos + sigHeight + 1.5);

      // Right signature box (under INVIGILATOR SIGN column)
      doc.rect(colSign, yPos, signColWidth, sigHeight);
      doc.text('PRINCIPAL SIGNATURE', colSign + 1, yPos + sigHeight + 1.5);
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