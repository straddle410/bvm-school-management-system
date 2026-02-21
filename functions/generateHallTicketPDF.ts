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

    const yPos = positionInPage * ticketHeight + 1;
    let currentY = yPos + 1;
    const lineWidth = 0.4;
    doc.setLineWidth(lineWidth);
    doc.setDrawColor(0);

    // Outer border
    doc.rect(margin, yPos, contentWidth, ticketHeight - 2);

    // School header section
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.text(schoolProfile?.school_name || 'SCHOOL NAME', pageWidth / 2, currentY + 1.5, { align: 'center' });
    currentY += 3.5;
    doc.line(margin, currentY, margin + contentWidth, currentY);
    
    // Exam type
    doc.setFontSize(9);
    doc.setFont(undefined, 'bold');
    const examTypeText = examType ? `${examType.name} HALL TICKET` : 'EXAM HALL TICKET';
    doc.text(examTypeText, pageWidth / 2, currentY + 2, { align: 'center' });
    currentY += 3.5;
    doc.line(margin, currentY, margin + contentWidth, currentY);

    // Student name row
    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    const nameRowHeight = 3;
    doc.text('STUDENT NAME :', margin + 1, currentY + 1.5);
    currentY += nameRowHeight;
    doc.line(margin, currentY, margin + contentWidth, currentY);

    // Student number row
    doc.text('STUDENT NUMBER :', margin + 1, currentY + 1.5);
    currentY += nameRowHeight;
    doc.line(margin, currentY, margin + contentWidth, currentY);

    // Timings row
    doc.setFontSize(7);
    doc.setFont(undefined, 'bold');
    doc.text('TIMINGS 9:30 AM TO 12:30 PM', pageWidth / 2, currentY + 1.5, { align: 'center' });
    currentY += nameRowHeight;
    doc.line(margin, currentY, margin + contentWidth, currentY);

    // Table columns
    const col1X = margin + 1;
    const col2X = margin + 22;
    const col3X = margin + 38;
    const col4X = margin + 52;
    const col5X = margin + 73;
    const col6X = margin + contentWidth - 2;

    // Table header
    doc.setFontSize(7);
    doc.setFont(undefined, 'bold');
    doc.text('SUBJECT', col1X, currentY + 1.5);
    doc.text('DATE', col2X + 1, currentY + 1.5);
    doc.text('INVIGILATOR SIGN', col3X + 3, currentY + 1.5);
    doc.text('SUBJECT', col4X, currentY + 1.5);
    doc.text('DATE', col5X + 1, currentY + 1.5);
    doc.text('INVIGILATOR SIGN', col6X - 18, currentY + 1.5);
    
    currentY += nameRowHeight;
    doc.line(margin, currentY, margin + contentWidth, currentY);

    // Vertical lines for table
    doc.line(col2X, currentY - nameRowHeight, col2X, currentY + maxRows * nameRowHeight);
    doc.line(col3X, currentY - nameRowHeight, col3X, currentY + maxRows * nameRowHeight);
    doc.line(col4X, currentY - nameRowHeight, col4X, currentY + maxRows * nameRowHeight);
    doc.line(col5X, currentY - nameRowHeight, col5X, currentY + maxRows * nameRowHeight);

    // Table rows - up to 6 subjects (3 on left, 3 on right)
    const maxRows = 3;
    
    for (let i = 0; i < maxRows; i++) {
      const leftSubject = timetable[i * 2];
      const rightSubject = timetable[i * 2 + 1];

      doc.setFontSize(7);
      doc.setFont(undefined, 'normal');

      // Left side
      if (leftSubject) {
        const dateStr = new Date(leftSubject.exam_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' });
        doc.text(leftSubject.subject_name.substring(0, 14), col1X, currentY + 1.5);
        doc.text(dateStr, col2X + 1, currentY + 1.5);
      }

      // Right side
      if (rightSubject) {
        const dateStr = new Date(rightSubject.exam_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' });
        doc.text(rightSubject.subject_name.substring(0, 14), col4X, currentY + 1.5);
        doc.text(dateStr, col5X + 1, currentY + 1.5);
      }

      currentY += nameRowHeight;
      doc.line(margin, currentY, margin + contentWidth, currentY);
    }

    // Signature section
    currentY += 1;
    doc.setFontSize(7);
    doc.setFont(undefined, 'bold');
    doc.text('AO SIGNATURE', col1X, currentY + 1);
    doc.text('PRINCIPAL SIGNATURE', col4X, currentY + 1);
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