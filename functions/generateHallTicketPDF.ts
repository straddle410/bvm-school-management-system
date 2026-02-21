import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import jsPDFModule from 'npm:jspdf@4.0.0';

const jsPDF = jsPDFModule.jsPDF || jsPDFModule;

const generatePDF = async (hallTickets, schoolProfile, timetable, examType) => {
    const doc = new jsPDF('p', 'mm', 'a4');

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const contentWidth = pageWidth - 2 * margin;

    hallTickets.forEach((ticket, index) => {
      if (index > 0) {
        doc.addPage();
      }

      let yPos = margin;
      doc.setLineWidth(0.7);
      doc.setDrawColor(0);

      // Outer border
      doc.rect(margin, yPos, contentWidth, pageHeight - 2 * margin);

      yPos += 3;

      // School name
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text(schoolProfile?.school_name || 'SCHOOL NAME', pageWidth / 2, yPos, { align: 'center' });
      yPos += 5;

      // Exam type header
      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      const examTypeText = examType ? `${examType.name} HALL TICKET-2023` : 'EXAM HALL TICKET-2023';
      doc.text(examTypeText, pageWidth / 2, yPos, { align: 'center' });
      yPos += 6;

      // Student name field
      doc.setFontSize(7.5);
      doc.setFont(undefined, 'bold');
      const fieldHeight = 6;
      doc.rect(margin + 1, yPos, contentWidth - 2, fieldHeight);
      doc.text('STUDENT NAME :', margin + 2.5, yPos + 4);
      doc.text(ticket.student_name || '', margin + 35, yPos + 4);
      yPos += fieldHeight;

      // Student number field
      doc.rect(margin + 1, yPos, contentWidth - 2, fieldHeight);
      doc.text('STUDENT NUMBER :', margin + 2.5, yPos + 4);
      doc.text(ticket.hall_ticket_number || '', margin + 35, yPos + 4);
      yPos += fieldHeight;

      // Timings row
      doc.setLineWidth(0.7);
      doc.rect(margin + 1, yPos, contentWidth - 2, fieldHeight);
      doc.setFontSize(7);
      doc.setFont(undefined, 'bold');
      doc.text('TIMINGS 9:30 AM TO 12:30 PM', pageWidth / 2, yPos + 4, { align: 'center' });
      yPos += fieldHeight;

      // Table setup with 6 equal columns
      const leftMargin = margin + 1;
      const tableWidth = contentWidth - 2;
      const colWidth = tableWidth / 6;

      const col1 = leftMargin;
      const col2 = col1 + colWidth;
      const col3 = col2 + colWidth;
      const col4 = col3 + colWidth;
      const col5 = col4 + colWidth;
      const col6 = col5 + colWidth;

      const tableRowHeight = 7;
      const headerRowHeight = 6;

      // Table header
      doc.setLineWidth(0.5);
      doc.setFontSize(6.5);
      doc.setFont(undefined, 'bold');

      // Draw header border
      doc.rect(col1, yPos, tableWidth, headerRowHeight);
      doc.line(col2, yPos, col2, yPos + headerRowHeight);
      doc.line(col3, yPos, col3, yPos + headerRowHeight);
      doc.line(col4, yPos, col4, yPos + headerRowHeight);
      doc.line(col5, yPos, col5, yPos + headerRowHeight);
      doc.line(col6, yPos, col6, yPos + headerRowHeight);

      doc.text('SUBJECT', col1 + 1, yPos + 4);
      doc.text('DATE', col2 + 2.5, yPos + 4);
      doc.text('INVIGILATOR SIGN', col3 + 0.5, yPos + 4);
      doc.text('SUBJECT', col4 + 1, yPos + 4);
      doc.text('DATE', col5 + 2.5, yPos + 4);
      doc.text('INVIGILATOR SIGN', col6 + 0.5, yPos + 4);

      yPos += headerRowHeight;

      // Table data rows
      const maxRows = 3;
      doc.setFontSize(6.5);
      doc.setFont(undefined, 'normal');

      for (let i = 0; i < maxRows; i++) {
        const leftSubject = timetable[i * 2];
        const rightSubject = timetable[i * 2 + 1];

        // Draw row borders
        doc.rect(col1, yPos, tableWidth, tableRowHeight);
        doc.line(col2, yPos, col2, yPos + tableRowHeight);
        doc.line(col3, yPos, col3, yPos + tableRowHeight);
        doc.line(col4, yPos, col4, yPos + tableRowHeight);
        doc.line(col5, yPos, col5, yPos + tableRowHeight);
        doc.line(col6, yPos, col6, yPos + tableRowHeight);

        // Left side
        if (leftSubject) {
          const dateStr = new Date(leftSubject.exam_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '4-digit' });
          doc.text(leftSubject.subject_name.substring(0, 14), col1 + 1, yPos + 4.5);
          doc.text(dateStr, col2 + 1, yPos + 4.5);
        }

        // Right side
        if (rightSubject) {
          const dateStr = new Date(rightSubject.exam_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '4-digit' });
          doc.text(rightSubject.subject_name.substring(0, 14), col4 + 1, yPos + 4.5);
          doc.text(dateStr, col5 + 1, yPos + 4.5);
        }

        yPos += tableRowHeight;
      }

      // Signature section with spacing
      yPos += 5;
      doc.setFontSize(7);
      doc.setFont(undefined, 'bold');

      // Draw signature boxes
      const sigBoxHeight = 10;
      doc.rect(col1, yPos, col3 - col1, sigBoxHeight);
      doc.rect(col4, yPos, col6 - col4, sigBoxHeight);

      doc.text('AO SIGNATURE', col1 + 2, yPos + sigBoxHeight + 2);
      doc.text('PRINCIPAL SIGNATURE', col4 + 2, yPos + sigBoxHeight + 2);

      // Close outer border
      doc.setLineWidth(0.7);
      doc.rect(margin, margin, contentWidth, pageHeight - 2 * margin);
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