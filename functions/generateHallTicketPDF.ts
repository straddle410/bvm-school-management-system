import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import jsPDFModule from 'npm:jspdf@4.0.0';

const jsPDF = jsPDFModule.jsPDF || jsPDFModule;

const generatePDF = async (hallTickets, schoolProfile, timetable, examType) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const ticketPerPage = 3;
  const ticketHeight = pageHeight / ticketPerPage;
  const margin = 8;
  const contentWidth = pageWidth - 2 * margin;

  hallTickets.forEach((ticket, index) => {
    const positionInPage = index % ticketPerPage;
    
    if (index > 0 && positionInPage === 0) {
      doc.addPage();
    }

    const yPos = positionInPage * ticketHeight + 2;
    let currentY = yPos + 2;

    // Outer border
    doc.setDrawColor(0);
    doc.setLineWidth(0.5);
    doc.rect(margin, yPos, contentWidth, ticketHeight - 3);

    // School header
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text(schoolProfile?.school_name || 'SCHOOL NAME', pageWidth / 2, currentY, { align: 'center' });
    currentY += 4;

    // Exam type
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    const examTypeText = examType ? `${examType.name} HALL TICKET` : 'EXAM HALL TICKET';
    doc.text(examTypeText, pageWidth / 2, currentY, { align: 'center' });
    currentY += 4.5;

    // Student name row
    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    doc.text('STUDENT NAME :', margin + 2, currentY);
    doc.setLineWidth(0.3);
    doc.line(margin + 35, currentY - 1.5, pageWidth - margin - 2, currentY - 1.5);
    currentY += 4;

    // Student number row
    doc.text('STUDENT NUMBER :', margin + 2, currentY);
    doc.line(margin + 40, currentY - 1.5, pageWidth - margin - 2, currentY - 1.5);
    currentY += 4;

    // Timings
    doc.setFontSize(7);
    doc.setFont(undefined, 'bold');
    doc.text('TIMINGS 9:30 AM TO 12:30 PM', pageWidth / 2, currentY, { align: 'center' });
    currentY += 4;

    // Table header
    const col1 = margin + 2;
    const col2 = margin + 25;
    const col3 = margin + 42;
    const col4 = margin + 62;
    const col5 = margin + 87;
    const col6 = pageWidth - margin - 2;

    doc.setFontSize(7);
    doc.setFont(undefined, 'bold');
    
    // Draw table header
    doc.line(col1, currentY, col6, currentY);
    doc.text('SUBJECT', col1, currentY + 2.5);
    doc.text('DATE', col2 + 2, currentY + 2.5);
    doc.text('INVIGILATOR SIGN', col3, currentY + 2.5);
    doc.text('SUBJECT', col4, currentY + 2.5);
    doc.text('DATE', col5 + 2, currentY + 2.5);
    doc.text('INVIGILATOR SIGN', col6 - 18, currentY + 2.5);
    currentY += 3.5;

    doc.line(col1, currentY, col6, currentY);

    // Table rows - up to 6 subjects (3 on left, 3 on right)
    const rowHeight = 3.5;
    const maxRows = 3;
    
    for (let i = 0; i < maxRows; i++) {
      const leftSubject = timetable[i * 2];
      const rightSubject = timetable[i * 2 + 1];

      doc.setFontSize(7);
      doc.setFont(undefined, 'normal');

      // Left side
      if (leftSubject) {
        const dateStr = new Date(leftSubject.exam_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' });
        doc.text(leftSubject.subject_name.substring(0, 12), col1 + 1, currentY + 2);
        doc.text(dateStr, col2 + 2, currentY + 2);
      }

      // Right side
      if (rightSubject) {
        const dateStr = new Date(rightSubject.exam_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' });
        doc.text(rightSubject.subject_name.substring(0, 12), col4 + 1, currentY + 2);
        doc.text(dateStr, col5 + 2, currentY + 2);
      }

      currentY += rowHeight;
      doc.line(col1, currentY, col6, currentY);
    }

    // Signature section
    currentY += 2;
    doc.setFontSize(7);
    doc.setFont(undefined, 'bold');
    doc.text('AO SIGNATURE', col1 + 2, currentY);
    doc.text('PRINCIPAL SIGNATURE', col4 + 5, currentY);
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

    // Fetch school profile and timetable
    const [schoolProfiles, timetableList] = await Promise.all([
      base44.asServiceRole.entities.SchoolProfile.list(),
      base44.asServiceRole.entities.ExamTimetable.filter({
        exam_type: hallTickets[0].exam_type,
        academic_year: hallTickets[0].academic_year
      })
    ]);
    const schoolProfile = schoolProfiles[0];

    // Generate PDF
    const pdfBuffer = await generatePDF(hallTickets, schoolProfile, timetableList);

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