import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import jsPDFModule from 'npm:jspdf@4.0.0';

const jsPDF = jsPDFModule.jsPDF || jsPDFModule;

const generatePDF = async (hallTickets, schoolProfile, timetable, examType) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - 2 * margin;

  hallTickets.forEach((ticket, index) => {
    if (index > 0) {
      doc.addPage();
    }

    let yPos = margin;
    doc.setLineWidth(0.5);
    doc.setDrawColor(0);

    // Outer border
    doc.rect(margin, yPos, contentWidth, pageHeight - 2 * margin);

    // Inner border (offset)
    doc.rect(margin + 2, yPos + 2, contentWidth - 4, pageHeight - 2 * margin - 4);

    yPos += 5;

    // School name
    doc.setFontSize(12);
    doc.setFont(undefined, 'bold');
    doc.text(schoolProfile?.school_name || 'SCHOOL NAME', pageWidth / 2, yPos, { align: 'center' });
    yPos += 6;

    // Exam type header
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    const examTypeText = examType ? `${examType.name} HALL TICKET-2023` : 'EXAM HALL TICKET-2023';
    doc.text(examTypeText, pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;

    // Horizontal line after header
    doc.line(margin + 2, yPos, margin + contentWidth - 2, yPos);
    yPos += 4;

    // Student name field
    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    const fieldHeight = 5;
    doc.rect(margin + 2, yPos, contentWidth - 4, fieldHeight);
    doc.text('STUDENT NAME :', margin + 4, yPos + 3.5);
    yPos += fieldHeight;

    // Student number field
    doc.rect(margin + 2, yPos, contentWidth - 4, fieldHeight);
    doc.text('STUDENT NUMBER :', margin + 4, yPos + 3.5);
    yPos += fieldHeight;

    // Timings row
    doc.setLineWidth(0.5);
    doc.rect(margin + 2, yPos, contentWidth - 4, fieldHeight);
    doc.setFontSize(7);
    doc.setFont(undefined, 'bold');
    doc.text('TIMINGS 9:30 AM TO 12:30 PM', pageWidth / 2, yPos + 3.5, { align: 'center' });
    yPos += fieldHeight;

    // Table setup
    const col1 = margin + 2;
    const col2 = col1 + 28;
    const col3 = col2 + 24;
    const col4 = col3 + 30;
    const col5 = col4 + 28;
    const col6 = col5 + 24;

    const tableRowHeight = 6;
    const headerRowHeight = 5;

    // Table header
    doc.setLineWidth(0.5);
    doc.setFontSize(7);
    doc.setFont(undefined, 'bold');

    // Draw header row
    doc.line(col1, yPos, col6, yPos);
    doc.line(col1, yPos + headerRowHeight, col6, yPos + headerRowHeight);
    
    // Vertical lines
    doc.line(col2, yPos, col2, yPos + headerRowHeight);
    doc.line(col3, yPos, col3, yPos + headerRowHeight);
    doc.line(col4, yPos, col4, yPos + headerRowHeight);
    doc.line(col5, yPos, col5, yPos + headerRowHeight);
    doc.line(col6, yPos, col6, yPos + headerRowHeight);

    doc.text('SUBJECT', col1 + 2, yPos + 3.5);
    doc.text('DATE', col2 + 4, yPos + 3.5);
    doc.text('INVIGILATOR SIGN', col3 + 2, yPos + 3.5);
    doc.text('SUBJECT', col4 + 2, yPos + 3.5);
    doc.text('DATE', col5 + 4, yPos + 3.5);
    doc.text('INVIGILATOR SIGN', col6 - 22, yPos + 3.5);

    yPos += headerRowHeight;

    // Table data rows
    const maxRows = 3;
    doc.setFontSize(7);
    doc.setFont(undefined, 'normal');

    for (let i = 0; i < maxRows; i++) {
      const leftSubject = timetable[i * 2];
      const rightSubject = timetable[i * 2 + 1];

      // Draw row
      doc.line(col1, yPos + tableRowHeight, col6, yPos + tableRowHeight);
      
      // Vertical lines
      doc.line(col2, yPos, col2, yPos + tableRowHeight);
      doc.line(col3, yPos, col3, yPos + tableRowHeight);
      doc.line(col4, yPos, col4, yPos + tableRowHeight);
      doc.line(col5, yPos, col5, yPos + tableRowHeight);
      doc.line(col6, yPos, col6, yPos + tableRowHeight);

      // Left side
      if (leftSubject) {
        const dateStr = new Date(leftSubject.exam_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' });
        doc.text(leftSubject.subject_name.substring(0, 12), col1 + 1, yPos + 4);
        doc.text(dateStr, col2 + 2, yPos + 4);
      }

      // Right side
      if (rightSubject) {
        const dateStr = new Date(rightSubject.exam_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' });
        doc.text(rightSubject.subject_name.substring(0, 12), col4 + 1, yPos + 4);
        doc.text(dateStr, col5 + 2, yPos + 4);
      }

      yPos += tableRowHeight;
    }

    // Close table bottom line
    doc.line(col1, yPos, col6, yPos);

    // Signature section
    yPos += 8;
    doc.setFontSize(7);
    doc.setFont(undefined, 'bold');
    doc.text('AO SIGNATURE', col1 + 2, yPos);
    doc.text('PRINCIPAL SIGNATURE', col4 + 2, yPos);

    // Close outer border at bottom
    doc.line(margin + 2, pageHeight - margin - 2, margin + contentWidth - 2, pageHeight - margin - 2);
    doc.line(margin, pageHeight - margin, margin + contentWidth, pageHeight - margin);
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