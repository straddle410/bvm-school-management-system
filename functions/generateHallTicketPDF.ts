import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import jsPDFModule from 'npm:jspdf@4.0.0';

const jsPDF = jsPDFModule.jsPDF || jsPDFModule;

const generatePDF = async (hallTickets, schoolProfile, timetable, examType) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = 210;
    const pageHeight = 297;
    const ticketsPerPage = 3;
    const ticketHeight = (pageHeight - 20) / ticketsPerPage;

    // Group tickets into pages of 3
    for (let pageIdx = 0; pageIdx < Math.ceil(hallTickets.length / ticketsPerPage); pageIdx++) {
      if (pageIdx > 0) doc.addPage();

      const pageTickets = hallTickets.slice(pageIdx * ticketsPerPage, (pageIdx + 1) * ticketsPerPage);

      for (let ticketIdx = 0; ticketIdx < pageTickets.length; ticketIdx++) {
        const ticket = pageTickets[ticketIdx];
        const yStart = 10 + (ticketIdx * ticketHeight);

        // Generate HTML for this ticket
        const ticketHTML = generateTicketHTML(ticket, schoolProfile, timetable, examType);

        // Create temporary container
        const div = document.createElement('div');
        div.innerHTML = ticketHTML;
        div.style.position = 'absolute';
        div.style.left = '-9999px';
        div.style.width = '190mm';
        document.body.appendChild(div);

        // Convert to canvas using html2canvas
        const canvas = await html2canvas(div, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff'
        });

        // Calculate dimensions
        const imgWidth = 190;
        const imgHeight = (canvas.height / canvas.width) * imgWidth;

        // Add image to PDF
        const imgData = canvas.toDataURL('image/png');
        doc.addImage(imgData, 'PNG', 10, yStart, imgWidth, Math.min(imgHeight, ticketHeight - 2));

        // Clean up
        document.body.removeChild(div);
      }
    }

    return doc.output('arraybuffer');
  };

  const generateTicketHTML = (ticket, schoolProfile, timetable, examType) => {
    const subjects = ['TELUGU', 'HINDI', 'ENGLISH', 'MATHEMATICS', 'GEN. SCIENCE', 'SOCIAL'];

    const getSubjectDate = (subjectName) => {
      const subject = timetable.find(t => t.subject_name === subjectName);
      if (subject && subject.exam_date) {
        return new Date(subject.exam_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' });
      }
      return '';
    };

    const subjectRows = subjects.map(subject => `
      <tr>
        <td>${subject}</td>
        <td>${getSubjectDate(subject)}</td>
        <td></td>
      </tr>
    `).join('');

    const examTypeText = examType ? `${examType.name} HALL TICKET - 2023` : 'EXAM HALL TICKET - 2023';

    return `
      <div style="border: 2px solid black; padding: 12px; margin-bottom: 8px; font-family: Arial, sans-serif; page-break-inside: avoid;">
        <div style="text-align: center; font-weight: bold; font-size: 14px; margin-bottom: 2px;">
          BVM SCHOOL OF EXCELLENCE, KOTHAKOTA
        </div>
        <div style="text-align: center; font-weight: bold; font-size: 12px; margin-bottom: 10px;">
          ${examTypeText}
        </div>

        <div style="font-size: 11px; margin-bottom: 10px;">
          <div><b>STUDENT NAME :</b> ${ticket.student_name || ''}</div>
          <div><b>STUDENT NUMBER :</b> ${ticket.hall_ticket_number || ''}</div>
          <div><b>TIMINGS :</b> 9:30 AM TO 12:30 PM</div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 10px;">
          <tr>
            <th style="border: 1px solid black; padding: 4px; text-align: center; font-weight: bold;">SUBJECT</th>
            <th style="border: 1px solid black; padding: 4px; text-align: center; font-weight: bold;">DATE</th>
            <th style="border: 1px solid black; padding: 4px; text-align: center; font-weight: bold;">INVIGILATOR SIGN</th>
          </tr>
          ${subjectRows}
        </table>

        <div style="display: flex; justify-content: space-between; font-size: 10px; margin-top: 8px;">
          <div style="border-top: 1px solid black; width: 45%; padding-top: 15px; text-align: left;">AO SIGNATURE</div>
          <div style="border-top: 1px solid black; width: 45%; padding-top: 15px; text-align: right;">PRINCIPAL SIGNATURE</div>
        </div>
      </div>
    `;
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