import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import jsPDFModule from 'npm:jspdf@4.0.0';

const jsPDF = jsPDFModule.jsPDF || jsPDFModule;

const generatePDF = async (hallTickets, schoolProfile, timetable, examType) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = 210;
    const pageHeight = 297;
    const ticketsPerPage = 3;
    const ticketHeight = 95;
    const marginLeft = 10;
    const marginRight = 10;
    const ticketWidth = pageWidth - marginLeft - marginRight;

    hallTickets.forEach((ticket, index) => {
        const ticketIndex = index % ticketsPerPage;
        if (index > 0 && ticketIndex === 0) doc.addPage();

        const yStart = 10 + (ticketIndex * (ticketHeight + 2));

        // Border
        doc.setLineWidth(0.8);
        doc.rect(marginLeft, yStart, ticketWidth, ticketHeight);

        let yPos = yStart + 3;
        const contentX = marginLeft + 3;
        const contentWidth = ticketWidth - 6;

        // Row 1: School Name - BOLD 16pt
        doc.setFontSize(16);
        doc.setFont('Calibri', 'bold');
        doc.text('BVM SCHOOL OF EXCELLENCE, KOTHAKOTA', contentX, yPos);
        yPos += 5;

        // Row 2: Exam Type - BOLD 13pt
        doc.setFontSize(13);
        doc.setFont('Calibri', 'bold');
        const examTypeText = examType ? `${examType.name} HALL TICKET - 2023` : 'EXAM HALL TICKET - 2023';
        doc.text(examTypeText, contentX, yPos);
        yPos += 4.5;

        // Row 3: Student Name - 11pt normal
        doc.setFontSize(11);
        doc.setFont('Calibri', 'normal');
        doc.text('STUDENT NAME : ' + (ticket.student_name || ''), contentX, yPos);
        yPos += 3.5;

        // Row 4: Student Number - 11pt normal
        doc.text('STUDENT NUMBER : ' + (ticket.hall_ticket_number || ''), contentX, yPos);
        yPos += 3.5;

        // Row 5: Timings - 11pt normal
        doc.text('TIMINGS : 9:30 AM TO 12:30 PM', contentX, yPos);
        yPos += 5;

        // Table Header
        doc.setLineWidth(0.5);
        doc.setFont('Calibri', 'bold');
        doc.setFontSize(10);

        const tableX = contentX;
        const subjectColW = 5.5;
        const dateColW = 6;
        const signColW = contentWidth - subjectColW - dateColW;
        const headerH = 3.5;

        // Header row
        doc.rect(tableX, yPos, subjectColW, headerH);
        doc.rect(tableX + subjectColW, yPos, dateColW, headerH);
        doc.rect(tableX + subjectColW + dateColW, yPos, signColW, headerH);

        doc.text('SUBJECT', tableX + 0.5, yPos + 2.2);
        doc.text('DATE & DAY', tableX + subjectColW + 0.5, yPos + 2.2);
        doc.text('INVIGILATOR SIGN', tableX + subjectColW + dateColW + 0.5, yPos + 2.2);

        yPos += headerH;

        // Subjects
        const subjects = ['TELUGU', 'HINDI', 'ENGLISH', 'MATHEMATICS', 'GENERAL SCIENCE', 'SOCIAL STUDIES', 'OPTIONAL SUBJECT'];
        const rowH = 3.2;

        doc.setFont('Calibri', 'normal');
        doc.setFontSize(10);

        subjects.forEach((subject) => {
            doc.rect(tableX, yPos, subjectColW, rowH);
            doc.rect(tableX + subjectColW, yPos, dateColW, rowH);
            doc.rect(tableX + subjectColW + dateColW, yPos, signColW, rowH);

            doc.text(subject, tableX + 0.5, yPos + 1.9);

            const tt = timetable.find(t => t.subject_name === subject);
            if (tt && tt.exam_date) {
                const date = new Date(tt.exam_date);
                const d = date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' });
                const day = date.toLocaleDateString('en-IN', { weekday: 'short' });
                doc.text(`${d} ${day}`, tableX + subjectColW + 0.5, yPos + 1.9);
            }

            yPos += rowH;
        });

        // Signature line at bottom
        yPos = yStart + ticketHeight - 3.5;
        doc.setLineWidth(0.4);
        doc.setFont('Calibri', 'normal');
        doc.setFontSize(9);

        const sig1X = contentX;
        const sig2X = contentX + contentWidth / 2 - 4;
        const sig3X = contentX + contentWidth - 12;

        doc.line(sig1X, yPos, sig1X + 12, yPos);
        doc.text('AO SIGNATURE', sig1X, yPos + 1.8);

        doc.line(sig2X, yPos, sig2X + 10, yPos);
        doc.text('DATE', sig2X, yPos + 1.8);

        doc.line(sig3X, yPos, sig3X + 12, yPos);
        doc.text('PRINCIPAL SIGNATURE', sig3X, yPos + 1.8);
    });

    return doc.output('arraybuffer');
};

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const payload = await req.json();
        const { hallTicketIds, staffSession } = payload;

        let user = null;
        if (staffSession) {
            try {
                user = typeof staffSession === 'string' ? JSON.parse(staffSession) : staffSession;
            } catch (e) {
                console.error('Failed to parse staff session:', e.message);
            }
        }

        if (!user) {
            try {
                user = await base44.auth.me();
            } catch (e) {
                console.error('Base44 auth failed:', e.message);
            }
        }

        if (!hallTicketIds || hallTicketIds.length === 0) {
            return Response.json({ error: 'No hall tickets selected' }, { status: 400 });
        }

        const hallTickets = [];
        for (const id of hallTicketIds) {
            const ticket = await base44.asServiceRole.entities.HallTicket.get(id);
            if (ticket) hallTickets.push(ticket);
        }

        if (hallTickets.length === 0) {
            return Response.json({ error: 'No hall tickets found' }, { status: 404 });
        }

        const [schoolProfiles, examTypeData, timetableList] = await Promise.all([
            base44.asServiceRole.entities.SchoolProfile.list(),
            base44.asServiceRole.entities.ExamType.get(hallTickets[0].exam_type),
            base44.asServiceRole.entities.ExamTimetable.filter({
                exam_type: hallTickets[0].exam_type,
                academic_year: hallTickets[0].academic_year
            })
        ]);
        const schoolProfile = schoolProfiles[0];

        const pdfBuffer = await generatePDF(hallTickets, schoolProfile, timetableList, examTypeData);

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