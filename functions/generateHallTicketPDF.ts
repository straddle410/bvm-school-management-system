import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import jsPDFModule from 'npm:jspdf@4.0.0';

const jsPDF = jsPDFModule.jsPDF || jsPDFModule;

const generatePDF = async (hallTickets, schoolProfile, timetable) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const ticketPerPage = 2;
  const ticketHeight = pageHeight / ticketPerPage;
  const margin = 5;

  hallTickets.forEach((ticket, index) => {
    const positionInPage = index % ticketPerPage;
    
    if (index > 0 && positionInPage === 0) {
      doc.addPage();
    }

    const yPos = positionInPage * ticketHeight + margin;
    let currentY = yPos + 2;

    // Draw ticket border
    doc.setDrawColor(100);
    doc.rect(margin, yPos, pageWidth - 2 * margin, ticketHeight - 2);

    // School header
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text(schoolProfile?.school_name || 'School Name', pageWidth / 2, currentY, { align: 'center' });
    currentY += 3;

    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.text('EXAM HALL TICKET', pageWidth / 2, currentY, { align: 'center' });
    currentY += 3;

    // Student info
    doc.setFontSize(7);
    const col1 = margin + 3;
    const col2 = pageWidth / 2 - 5;

    doc.setFont(undefined, 'bold');
    doc.text('Ticket No:', col1, currentY);
    doc.setFont(undefined, 'normal');
    doc.text(ticket.hall_ticket_number, col1 + 18, currentY);
    
    doc.setFont(undefined, 'bold');
    doc.text('Class:', col2, currentY);
    doc.setFont(undefined, 'normal');
    doc.text(`${ticket.class_name}-${ticket.section}`, col2 + 12, currentY);
    currentY += 3;

    doc.setFont(undefined, 'bold');
    doc.text('Name:', col1, currentY);
    doc.setFont(undefined, 'normal');
    doc.text(ticket.student_name, col1 + 18, currentY);
    
    doc.setFont(undefined, 'bold');
    doc.text('Roll No:', col2, currentY);
    doc.setFont(undefined, 'normal');
    doc.text(String(ticket.roll_number), col2 + 12, currentY);
    currentY += 4;

    // Timetable
    if (timetable && timetable.length > 0) {
      doc.setFont(undefined, 'bold');
      doc.setFontSize(6);
      doc.text('EXAM SCHEDULE', col1, currentY);
      currentY += 2;

      timetable.forEach(entry => {
        doc.setFont(undefined, 'normal');
        doc.setFontSize(6);
        const dateStr = new Date(entry.exam_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
        doc.text(`${entry.subject_name} - ${dateStr} ${entry.start_time}`, col1, currentY);
        currentY += 2;
        if (currentY > yPos + ticketHeight - 12) break;
      });
    }

    // Signatures
    currentY = yPos + ticketHeight - 8;
    doc.setDrawColor(150);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(6);
    doc.text('Invigilator', col1, currentY);
    doc.line(col1, currentY + 1, col1 + 15, currentY + 1);

    doc.text('Principal', col2 + 5, currentY);
    doc.line(col2 + 5, currentY + 1, col2 + 20, currentY + 1);
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