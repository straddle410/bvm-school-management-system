import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import jsPDFModule from 'npm:jspdf@4.0.0';

const jsPDF = jsPDFModule.jsPDF || jsPDFModule;

const generatePDF = async (hallTickets, schoolProfile, timetable, examType) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = 210;
      const pageHeight = 297;
      const ticketsPerPage = 3;
      const ticketHeight = 98;
      const margin = 6;

    hallTickets.forEach((ticket, index) => {
      const ticketIndex = index % ticketsPerPage;
      if (index > 0 && ticketIndex === 0) doc.addPage();

      const yStart = margin + (ticketIndex * ticketHeight);
      const ticketWidth = pageWidth - 20;

      // Outer border
      doc.setLineWidth(0.5);
      doc.rect(margin, yStart, ticketWidth, ticketHeight);

      let yPos = yStart + 2;

      // School name
      doc.setFontSize(11);
      doc.setFont(undefined, 'bold');
      doc.text('BVM SCHOOL OF EXCELLENCE, KOTHAKOTA', pageWidth / 2, yPos, { align: 'center' });
      yPos += 3.5;

      // Exam type
      doc.setFontSize(8.5);
      doc.setFont(undefined, 'bold');
      const examTypeText = examType ? `${examType.name} HALL TICKET-2023` : 'EXAM HALL TICKET-2023';
      doc.text(examTypeText, pageWidth / 2, yPos, { align: 'center' });
      yPos += 3.2;

      // Student info - inline labels and values
      doc.setFontSize(8);
      doc.setFont(undefined, 'bold');
      doc.text('STUDENT NAME :', margin + 2, yPos);
      doc.setFont(undefined, 'normal');
      doc.text(ticket.student_name || '', margin + 33, yPos);
      yPos += 2.8;

      doc.setFont(undefined, 'bold');
      doc.text('STUDENT NUMBER :', margin + 2, yPos);
      doc.setFont(undefined, 'normal');
      doc.text(ticket.hall_ticket_number || '', margin + 33, yPos);
      yPos += 2.8;

      doc.setFont(undefined, 'bold');
      doc.text('TIMINGS :', margin + 2, yPos);
      doc.setFont(undefined, 'normal');
      doc.text('9:30 AM TO 12:30 PM', margin + 33, yPos);
      yPos += 3.5;

      // Two-column table: TELUGU, HINDI, ENGLISH on left | MATHEMATICS, GEN. SCIENCE, SOCIAL on right
      const subjectMap = {
        left: ['TELUGU', 'HINDI', 'ENGLISH'],
        right: ['MATHEMATICS', 'GEN. SCIENCE', 'SOCIAL']
      };

      const leftX = margin + 2;
      const rightX = pageWidth / 2 + 1;
      const colWidth = (pageWidth / 2 - 3) / 3;

      doc.setLineWidth(0.4);
      doc.setFontSize(7);
      doc.setFont(undefined, 'bold');

      // Headers
      const hh = 3.2;
      doc.rect(leftX, yPos, colWidth, hh);
      doc.rect(leftX + colWidth, yPos, colWidth * 0.75, hh);
      doc.rect(leftX + colWidth * 1.75, yPos, colWidth * 1.25, hh);
      doc.text('SUBJECT', leftX + 0.7, yPos + 2.3);
      doc.text('DATE', leftX + colWidth + 0.5, yPos + 2.3);
      doc.text('INVIGILATOR SIGN', leftX + colWidth * 1.75 + 0.3, yPos + 2.3);

      doc.rect(rightX, yPos, colWidth, hh);
      doc.rect(rightX + colWidth, yPos, colWidth * 0.75, hh);
      doc.rect(rightX + colWidth * 1.75, yPos, colWidth * 1.25, hh);
      doc.text('SUBJECT', rightX + 0.7, yPos + 2.3);
      doc.text('DATE', rightX + colWidth + 0.5, yPos + 2.3);
      doc.text('INVIGILATOR SIGN', rightX + colWidth * 1.75 + 0.3, yPos + 2.3);

      yPos += hh;

      // Subject rows
      doc.setFont(undefined, 'normal');
      doc.setFontSize(6.5);
      const rh = 3;

      for (let i = 0; i < 3; i++) {
        // Left column
        doc.rect(leftX, yPos, colWidth, rh);
        doc.rect(leftX + colWidth, yPos, colWidth * 0.75, rh);
        doc.rect(leftX + colWidth * 1.75, yPos, colWidth * 1.25, rh);

        const leftSubj = subjectMap.left[i];
        doc.text(leftSubj, leftX + 0.7, yPos + 2.2);

        const ttLeft = timetable.find(t => t.subject_name === leftSubj);
        if (ttLeft && ttLeft.exam_date) {
          const d = new Date(ttLeft.exam_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' });
          doc.text(d, leftX + colWidth + 0.5, yPos + 2.2);
        }

        // Right column
        doc.rect(rightX, yPos, colWidth, rh);
        doc.rect(rightX + colWidth, yPos, colWidth * 0.75, rh);
        doc.rect(rightX + colWidth * 1.75, yPos, colWidth * 1.25, rh);

        const rightSubj = subjectMap.right[i];
        doc.text(rightSubj, rightX + 0.7, yPos + 2.2);

        const ttRight = timetable.find(t => t.subject_name === rightSubj);
        if (ttRight && ttRight.exam_date) {
          const d = new Date(ttRight.exam_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' });
          doc.text(d, rightX + colWidth + 0.5, yPos + 2.2);
        }

        yPos += rh;
      }

      // Signature boxes
      yPos += 1.8;
      doc.setFont(undefined, 'bold');
      doc.setFontSize(6.5);

      doc.line(leftX, yPos, leftX + colWidth, yPos);
      doc.text('AO SIGNATURE', leftX + 0.7, yPos + 1.8);

      doc.line(rightX + colWidth * 1.75, yPos, rightX + colWidth * 3, yPos);
      doc.text('PRINCIPAL SIGNATURE', rightX + colWidth * 1.75 + 0.4, yPos + 1.8);
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