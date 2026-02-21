import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import jsPDFModule from 'npm:jspdf@4.0.0';

const jsPDF = jsPDFModule.jsPDF || jsPDFModule;

const generatePDF = async (hallTickets, schoolProfile, timetable, examType) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = 210;
    const pageHeight = 297;
    const ticketsPerPage = 3;
    const ticketHeight = 97;
    const margin = 5;
    const ticketWidth = pageWidth - (2 * margin);

    hallTickets.forEach((ticket, index) => {
        const ticketIndex = index % ticketsPerPage;
        if (index > 0 && ticketIndex === 0) doc.addPage();

        const yStart = margin + (ticketIndex * (ticketHeight + 1));

        // Outer border - tight fit
        doc.setLineWidth(0.5);
        doc.rect(margin, yStart, ticketWidth, ticketHeight);

        let yPos = yStart + 2;

        // School name - bold, large, centered
        doc.setFontSize(16);
        doc.setFont('Calibri', 'bold');
        const schoolNameLines = doc.splitTextToSize('BVM SCHOOL OF EXCELLENCE, KOTHAKOTA', ticketWidth - 4);
        doc.text(schoolNameLines, pageWidth / 2, yPos, { align: 'center' });
        yPos += schoolNameLines.length * 3 + 1;

        // Exam type
        doc.setFontSize(13);
        doc.setFont('Calibri', 'bold');
        const examTypeText = examType ? `${examType.name} HALL TICKET - 2023` : 'EXAM HALL TICKET - 2023';
        doc.text(examTypeText, pageWidth / 2, yPos, { align: 'center' });
        yPos += 3.8;

        // Student info section
        doc.setFontSize(11);
        doc.setFont('Calibri', 'bold');
        doc.text('NAME:', margin + 2, yPos);
        doc.setFont('Calibri', 'bold');
        doc.text(ticket.student_name || '', margin + 16, yPos);
        yPos += 3;

        doc.setFont('Calibri', 'bold');
        doc.text('ROLL NO:', margin + 2, yPos);
        doc.setFont('Calibri', 'bold');
        doc.text(ticket.hall_ticket_number || '', margin + 16, yPos);
        yPos += 3.2;

        // Subjects table - 7 subjects in single column
        doc.setLineWidth(0.3);
        doc.setFontSize(10);
        doc.setFont('Calibri', 'bold');

        const tableLeftX = margin + 1;
        const subjectColWidth = 9;
        const dateColWidth = 10;
        const signColWidth = ticketWidth - subjectColWidth - dateColWidth - 2;
        const headerHeight = 3;
        const rowHeight = 3.2;

        // Table header
        doc.rect(tableLeftX, yPos, subjectColWidth, headerHeight);
        doc.rect(tableLeftX + subjectColWidth, yPos, dateColWidth, headerHeight);
        doc.rect(tableLeftX + subjectColWidth + dateColWidth, yPos, signColWidth, headerHeight);

        doc.setFontSize(9);
        doc.setFont('Calibri', 'bold');
        doc.text('SUBJECT', tableLeftX + 0.5, yPos + 1.8);
        doc.text('DATE', tableLeftX + subjectColWidth + 0.5, yPos + 1.8);
        doc.text('SIGNATURE', tableLeftX + subjectColWidth + dateColWidth + 0.5, yPos + 1.8);

        yPos += headerHeight;

        // Subject rows - 7 subjects
        const subjectMap = [
            'TELUGU',
            'HINDI',
            'ENGLISH',
            'MATHEMATICS',
            'GENERAL SCIENCE',
            'SOCIAL STUDIES',
            'OPTIONAL SUBJECT'
        ];

        doc.setFont('Calibri', 'normal');
        doc.setFontSize(10);

        subjectMap.forEach((subject, i) => {
            doc.rect(tableLeftX, yPos, subjectColWidth, rowHeight);
            doc.rect(tableLeftX + subjectColWidth, yPos, dateColWidth, rowHeight);
            doc.rect(tableLeftX + subjectColWidth + dateColWidth, yPos, signColWidth, rowHeight);

            doc.text(subject, tableLeftX + 0.5, yPos + 1.9);

            const tt = timetable.find(t => t.subject_name === subject);
            if (tt && tt.exam_date) {
                const d = new Date(tt.exam_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' });
                doc.text(d, tableLeftX + subjectColWidth + 0.5, yPos + 1.9);
            }

            yPos += rowHeight;
        });

        // Signature section at bottom
        yPos = yStart + ticketHeight - 6;
        doc.setLineWidth(0.3);
        doc.setFontSize(8);
        doc.setFont('Calibri', 'bold');

        const sigWidth = (ticketWidth - 2) / 3;

        // AO Signature
        doc.line(margin + 1, yPos, margin + 1 + sigWidth - 1, yPos);
        doc.text('AO SIGNATURE', margin + 2, yPos + 1.5);

        // Date
        doc.line(margin + 1 + sigWidth + 0.5, yPos, margin + 1 + sigWidth + sigWidth - 0.5, yPos);
        doc.text('DATE', margin + 1 + sigWidth + 2, yPos + 1.5);

        // Principal Signature
        doc.line(margin + 1 + sigWidth * 2 + 1, yPos, margin + 1 + sigWidth * 3, yPos);
        doc.text('PRINCIPAL SIGNATURE', margin + 1 + sigWidth * 2 + 1.5, yPos + 1.5);
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