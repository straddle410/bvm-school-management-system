import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import jsPDF from 'npm:jspdf@4.0.0';

const generatePDF = async (hallTickets, schoolProfile) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const ticketPerPage = 3;
  const ticketHeight = pageHeight / ticketPerPage;
  const margin = 5;

  hallTickets.forEach((ticket, index) => {
    const pageIndex = Math.floor(index / ticketPerPage);
    const positionInPage = index % ticketPerPage;
    
    if (index > 0 && positionInPage === 0) {
      doc.addPage();
    }

    const yPos = positionInPage * ticketHeight + margin;

    // Draw ticket border
    doc.setDrawColor(100);
    doc.rect(margin, yPos, pageWidth - 2 * margin, ticketHeight - 2);

    let currentY = yPos + 3;

    // School header
    doc.setFontSize(10);
    doc.setFont(undefined, 'bold');
    doc.text(schoolProfile?.school_name || 'School Name', pageWidth / 2, currentY, { align: 'center' });
    currentY += 4;

    doc.setFontSize(8);
    doc.setFont(undefined, 'normal');
    doc.text('EXAM HALL TICKET', pageWidth / 2, currentY, { align: 'center' });
    currentY += 3;

    // Student info section
    doc.setFontSize(7);
    const leftCol = margin + 5;
    const rightCol = pageWidth / 2 + 2;

    // Left column
    doc.setFont(undefined, 'bold');
    doc.text('Hall Ticket No:', leftCol, currentY);
    doc.setFont(undefined, 'normal');
    doc.text(ticket.hall_ticket_number, leftCol + 25, currentY);
    currentY += 3;

    doc.setFont(undefined, 'bold');
    doc.text('Name:', leftCol, currentY);
    doc.setFont(undefined, 'normal');
    doc.text(ticket.student_name, leftCol + 25, currentY);
    currentY += 3;

    doc.setFont(undefined, 'bold');
    doc.text('Roll No:', leftCol, currentY);
    doc.setFont(undefined, 'normal');
    doc.text(String(ticket.roll_number), leftCol + 25, currentY);
    currentY += 3;

    doc.setFont(undefined, 'bold');
    doc.text('Class:', leftCol, currentY);
    doc.setFont(undefined, 'normal');
    doc.text(`${ticket.class_name}-${ticket.section}`, leftCol + 25, currentY);

    // Right column - signature space
    doc.setFont(undefined, 'bold');
    doc.setFontSize(7);
    doc.text('Invigilator Signature', rightCol + 20, currentY + 5);

    currentY += 6;
    doc.setDrawColor(150);
    doc.line(rightCol + 20, currentY, rightCol + 35, currentY);

    currentY += 8;
    doc.setFont(undefined, 'bold');
    doc.setFontSize(7);
    doc.text('Principal Signature', pageWidth / 2 - 15, yPos + ticketHeight - 8);
    doc.line(pageWidth / 2 - 20, yPos + ticketHeight - 5, pageWidth / 2, yPos + ticketHeight - 5);
  });

  return doc.output('arraybuffer');
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { hallTicketIds, staffSession } = payload;

    // Parse staff session
    let user;
    if (staffSession) {
      try {
        user = JSON.parse(staffSession);
      } catch {
        return Response.json({ error: 'Invalid session' }, { status: 401 });
      }
    }

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!hallTicketIds || hallTicketIds.length === 0) {
      return Response.json({ error: 'No hall tickets selected' }, { status: 400 });
    }

    // Fetch hall tickets
    const hallTickets = await Promise.all(
      hallTicketIds.map(id => base44.entities.HallTicket.get(id))
    );

    // Fetch school profile
    const schoolProfiles = await base44.entities.SchoolProfile.list();
    const schoolProfile = schoolProfiles[0];

    // Generate PDF
    const pdfBuffer = await generatePDF(hallTickets, schoolProfile);

    // Log download
    await base44.entities.HallTicketLog.create({
      action: 'downloaded',
      hall_ticket_id: hallTicketIds[0],
      student_id: 'multiple',
      performed_by: user.email,
      details: `Downloaded PDF for ${hallTicketIds.length} hall tickets`
    });

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename=hall_tickets.pdf'
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});