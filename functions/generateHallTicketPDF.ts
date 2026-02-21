import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import jsPDFModule from 'npm:jspdf@4.0.0';

const jsPDF = jsPDFModule.jsPDF || jsPDFModule;

const generatePDF = async (hallTickets, schoolProfile, timetable, examType) => {
    const doc = new jsPDF('p', 'mm', 'a4');

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 8;
    const ticketHeight = (pageHeight - 2 * margin) / 3;

    // 3 tickets per page
    hallTickets.forEach((ticket, index) => {
      const pageIndex = Math.floor(index / 3);
      const ticketIndex = index % 3;

      if (index > 0 && ticketIndex === 0) {
        doc.addPage();
      }

      let yPos = margin + (ticketIndex * ticketHeight);
      const ticketWidth = pageWidth - 2 * margin;
      const ticketContentWidth = ticketWidth - 2;

      // Outer border
      doc.setLineWidth(0.8);
      doc.setDrawColor(0);
      doc.rect(margin, yPos, ticketWidth, ticketHeight);

      yPos += 2;

      // School name - bold, uppercase
      doc.setFontSize(9);
      doc.setFont(undefined, 'bold');
      const schoolNameText = (schoolProfile?.school_name || 'SCHOOL NAME').toUpperCase();
      doc.text(schoolNameText, pageWidth / 2, yPos, { align: 'center' });
      yPos += 4;

      // Exam type - bold
      doc.setFontSize(8);
      doc.setFont(undefined, 'bold');
      const examTypeText = examType ? `${examType.name} HALL TICKET - 2023` : 'EXAM HALL TICKET - 2023';
      doc.text(examTypeText, pageWidth / 2, yPos, { align: 'center' });
      yPos += 5;

      // Student Details Section
      doc.setFontSize(7);
      doc.setFont(undefined, 'bold');
      const fieldHeight = 4.5;
      const labelWidth = 40;

      // Student Name
      doc.text('STUDENT NAME :', margin + 1.5, yPos);
      doc.setFont(undefined, 'normal');
      doc.text(ticket.student_name || '', margin + labelWidth, yPos);
      yPos += fieldHeight;

      // Student Number
      doc.setFont(undefined, 'bold');
      doc.text('STUDENT NUMBER :', margin + 1.5, yPos);
      doc.setFont(undefined, 'normal');
      doc.text(ticket.hall_ticket_number || '', margin + labelWidth, yPos);
      yPos += fieldHeight;

      // Timings
      doc.setFont(undefined, 'bold');
      doc.text('TIMINGS :', margin + 1.5, yPos);
      doc.setFont(undefined, 'normal');
      doc.text('9:30 AM TO 12:30 PM', margin + labelWidth, yPos);
      yPos += 5;

      // Exam Table - 3 columns: SUBJECT, DATE, INVIGILATOR SIGN
      const tableLeft = margin + 1.5;
      const tableWidth = ticketWidth - 3;
      const col1Width = tableWidth * 0.35;
      const col2Width = tableWidth * 0.25;
      const col3Width = tableWidth * 0.4;

      const col1 = tableLeft;
      const col2 = col1 + col1Width;
      const col3 = col2 + col2Width;

      const headerHeight = 4;
      const rowHeight = 3.5;

      // Table Header
      doc.setLineWidth(0.5);
      doc.setFontSize(6);
      doc.setFont(undefined, 'bold');

      // Header row
      doc.rect(col1, yPos, col1Width, headerHeight);
      doc.rect(col2, yPos, col2Width, headerHeight);
      doc.rect(col3, yPos, col3Width, headerHeight);

      doc.text('SUBJECT', col1 + 0.5, yPos + 3);
      doc.text('DATE', col2 + 0.5, yPos + 3);
      doc.text('INVIGILATOR SIGN', col3 + 0.5, yPos + 3);

      yPos += headerHeight;

      // Table data rows (6 subjects per ticket)
      doc.setFont(undefined, 'normal');
      const subjects = ['TELUGU', 'HINDI', 'ENGLISH', 'MATHEMATICS', 'GEN. SCIENCE', 'SOCIAL'];

      for (let i = 0; i < 6; i++) {
        // Row boxes
        doc.rect(col1, yPos, col1Width, rowHeight);
        doc.rect(col2, yPos, col2Width, rowHeight);
        doc.rect(col3, yPos, col3Width, rowHeight);

        // Subject name
        const subject = timetable.find(t => t.subject_name === subjects[i]) || { subject_name: subjects[i], exam_date: '' };
        doc.text(subject.subject_name.substring(0, 15), col1 + 0.5, yPos + 2.5);

        // Date
        if (subject.exam_date) {
          const dateStr = new Date(subject.exam_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' });
          doc.text(dateStr, col2 + 0.5, yPos + 2.5);
        }

        yPos += rowHeight;
      }

      yPos += 2;

      // Signature section
      doc.setLineWidth(0.5);
      doc.setFontSize(6);
      doc.setFont(undefined, 'bold');

      const sigHeight = 5;
      doc.rect(col1, yPos, col1Width, sigHeight);
      doc.rect(col3, yPos, col3Width, sigHeight);

      doc.text('AO SIGNATURE', col1 + 0.5, yPos + sigHeight + 1.5);
      doc.text('PRINCIPAL SIGNATURE', col3 + 0.5, yPos + sigHeight + 1.5);
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