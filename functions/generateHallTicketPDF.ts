import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import jsPDFModule from 'npm:jspdf@4.0.0';

const jsPDF = jsPDFModule.jsPDF || jsPDFModule;

const generatePDF = async (hallTickets, schoolProfile, timetable, examType) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = 210;
    const pageHeight = 297;
    const margin = 8;
    const ticketsPerPage = 3;
    const ticketHeight = (pageHeight - 2 * margin) / ticketsPerPage;

    hallTickets.forEach((ticket, index) => {
      const ticketIndex = index % ticketsPerPage;

      if (index > 0 && ticketIndex === 0) {
        doc.addPage();
      }

      const yStart = margin + (ticketIndex * ticketHeight);
      const ticketWidth = pageWidth - 2 * margin;

      // Outer border
      doc.setLineWidth(0.7);
      doc.rect(margin, yStart, ticketWidth, ticketHeight);

      let yPos = yStart + 2;

      // School name
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text('BVM SCHOOL OF EXCELLENCE, KOTHAKOTA', pageWidth / 2, yPos, { align: 'center' });
      yPos += 3.5;

      // Exam type
      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      const examTypeText = examType ? `${examType.name} HALL TICKET-2023` : 'EXAM HALL TICKET-2023';
      doc.text(examTypeText, pageWidth / 2, yPos, { align: 'center' });
      yPos += 3.5;

      // Student info
      doc.setFontSize(8);
      doc.setFont(undefined, 'bold');
      const leftCol = margin + 2;
      const rightCol = leftCol + 30;

      doc.text('STUDENT NAME :', leftCol, yPos);
      doc.setFont(undefined, 'normal');
      doc.text(ticket.student_name || '', rightCol, yPos);
      yPos += 2.8;

      doc.setFont(undefined, 'bold');
      doc.text('STUDENT NUMBER :', leftCol, yPos);
      doc.setFont(undefined, 'normal');
      doc.text(ticket.hall_ticket_number || '', rightCol, yPos);
      yPos += 2.8;

      doc.setFont(undefined, 'bold');
      doc.text('TIMINGS :', leftCol, yPos);
      doc.setFont(undefined, 'normal');
      doc.text('9:30 AM TO 12:30 PM', rightCol, yPos);
      yPos += 3.5;

      // Two-column table layout (3 subjects per column)
      const subjects = ['TELUGU', 'HINDI', 'ENGLISH', 'MATHEMATICS', 'GEN. SCIENCE', 'SOCIAL'];
      const leftTableX = margin + 1.5;
      const rightTableX = pageWidth / 2 + 1;
      const colW = (pageWidth / 2 - 3) / 3;

      doc.setLineWidth(0.4);
      doc.setFontSize(7);
      doc.setFont(undefined, 'bold');

      const headerH = 3.5;
      const rowH = 3.2;

      // Draw left table header
      doc.rect(leftTableX, yPos, colW, headerH);
      doc.rect(leftTableX + colW, yPos, colW * 0.8, headerH);
      doc.rect(leftTableX + colW * 1.8, yPos, colW * 1.2, headerH);

      doc.setFontSize(6.5);
      doc.text('SUBJECT', leftTableX + 1, yPos + 2.5);
      doc.text('DATE', leftTableX + colW + 0.5, yPos + 2.5);
      doc.text('INVIGILATOR', leftTableX + colW * 1.8 + 0.5, yPos + 2.5);

      // Draw right table header
      doc.rect(rightTableX, yPos, colW, headerH);
      doc.rect(rightTableX + colW, yPos, colW * 0.8, headerH);
      doc.rect(rightTableX + colW * 1.8, yPos, colW * 1.2, headerH);

      doc.text('SUBJECT', rightTableX + 1, yPos + 2.5);
      doc.text('DATE', rightTableX + colW + 0.5, yPos + 2.5);
      doc.text('INVIGILATOR', rightTableX + colW * 1.8 + 0.5, yPos + 2.5);

      yPos += headerH;

      doc.setFont(undefined, 'normal');
      doc.setFontSize(6);

      // Draw rows (3 per column)
      for (let i = 0; i < 3; i++) {
        // Left column subject
        doc.rect(leftTableX, yPos, colW, rowH);
        doc.rect(leftTableX + colW, yPos, colW * 0.8, rowH);
        doc.rect(leftTableX + colW * 1.8, yPos, colW * 1.2, rowH);

        doc.text(subjects[i], leftTableX + 0.5, yPos + 2.2);
        const ttLeft = timetable.find(t => t.subject_name === subjects[i]);
        if (ttLeft && ttLeft.exam_date) {
          const dateStr = new Date(ttLeft.exam_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' });
          doc.text(dateStr, leftTableX + colW + 0.5, yPos + 2.2);
        }

        // Right column subject
        doc.rect(rightTableX, yPos, colW, rowH);
        doc.rect(rightTableX + colW, yPos, colW * 0.8, rowH);
        doc.rect(rightTableX + colW * 1.8, yPos, colW * 1.2, rowH);

        doc.text(subjects[i + 3], rightTableX + 0.5, yPos + 2.2);
        const ttRight = timetable.find(t => t.subject_name === subjects[i + 3]);
        if (ttRight && ttRight.exam_date) {
          const dateStr = new Date(ttRight.exam_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' });
          doc.text(dateStr, rightTableX + colW + 0.5, yPos + 2.2);
        }

        yPos += rowH;
      }

      // Signature line
      yPos += 1.5;
      doc.setFont(undefined, 'bold');
      doc.setFontSize(6);

      doc.line(leftTableX, yPos, leftTableX + colW, yPos);
      doc.text('AO SIGNATURE', leftTableX + 1, yPos + 2);

      doc.line(rightTableX + colW * 1.8, yPos, rightTableX + colW * 3, yPos);
      doc.text('PRINCIPAL SIGNATURE', rightTableX + colW * 1.8 + 0.5, yPos + 2);
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