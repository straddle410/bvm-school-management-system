import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import jsPDFModule from 'npm:jspdf@4.0.0';

const jsPDF = jsPDFModule.jsPDF || jsPDFModule;

const generatePDF = async (hallTickets, schoolProfile, timetable, examType) => {
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = 210;
    const ticketsPerPage = 3;
    const ticketHeight = 96;
    const margin = 6;
    const ticketWidth = pageWidth - (2 * margin);

    hallTickets.forEach((ticket, index) => {
        const ticketIndex = index % ticketsPerPage;
        if (index > 0 && ticketIndex === 0) doc.addPage();

        const yStart = margin + (ticketIndex * (ticketHeight + 1.5));

        // Outer border
        doc.setLineWidth(0.6);
        doc.rect(margin, yStart, ticketWidth, ticketHeight);

        let yPos = yStart + 2.5;

        // School name - single line, properly sized
        doc.setFontSize(14);
        doc.setFont('Calibri', 'bold');
        doc.text('BVM SCHOOL OF EXCELLENCE, KOTHAKOTA', pageWidth / 2, yPos, { align: 'center' });
        yPos += 4;

        // Exam type
        doc.setFontSize(12);
        doc.setFont('Calibri', 'bold');
        const examTypeText = examType ? `${examType.name} HALL TICKET - 2023` : 'EXAM HALL TICKET - 2023';
        doc.text(examTypeText, pageWidth / 2, yPos, { align: 'center' });
        yPos += 3.5;

        // Student info - separated clearly
        doc.setFontSize(10);
        doc.setFont('Calibri', 'bold');
        const infoX = margin + 2;
        
        doc.text('NAME:', infoX, yPos);
        doc.setFont('Calibri', 'normal');
        doc.text(ticket.student_name || '', infoX + 12, yPos);
        yPos += 2.8;

        doc.setFont('Calibri', 'bold');
        doc.text('ROLL NO:', infoX, yPos);
        doc.setFont('Calibri', 'normal');
        doc.text(ticket.hall_ticket_number || '', infoX + 12, yPos);
        yPos += 3.2;

        // Subjects table
        doc.setLineWidth(0.35);
        doc.setFontSize(9.5);

        const tableX = margin + 1.5;
        const tableW = ticketWidth - 3;
        const col1W = 7;
        const col2W = 9;
        const col3W = tableW - col1W - col2W;
        
        const headerH = 3;
        const rowH = 3;

        // Header
        doc.setFont('Calibri', 'bold');
        doc.rect(tableX, yPos, col1W, headerH);
        doc.rect(tableX + col1W, yPos, col2W, headerH);
        doc.rect(tableX + col1W + col2W, yPos, col3W, headerH);

        doc.text('SUBJECT', tableX + 0.5, yPos + 1.8);
        doc.text('DATE', tableX + col1W + 0.5, yPos + 1.8);
        doc.text('SIGN', tableX + col1W + col2W + 0.5, yPos + 1.8);
        
        yPos += headerH;

        // Subject rows
        const subjects = ['TELUGU', 'HINDI', 'ENGLISH', 'MATHEMATICS', 'GEN. SCIENCE', 'SOCIAL', 'OPTIONAL'];
        
        doc.setFont('Calibri', 'normal');
        doc.setFontSize(9);

        subjects.forEach((subject) => {
            doc.rect(tableX, yPos, col1W, rowH);
            doc.rect(tableX + col1W, yPos, col2W, rowH);
            doc.rect(tableX + col1W + col2W, yPos, col3W, rowH);

            doc.text(subject, tableX + 0.5, yPos + 1.7);

            const tt = timetable.find(t => t.subject_name === subject);
            if (tt && tt.exam_date) {
                const d = new Date(tt.exam_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' });
                doc.text(d, tableX + col1W + 0.5, yPos + 1.7);
            }

            yPos += rowH;
        });

        // Signature line at bottom
        yPos = yStart + ticketHeight - 3.5;
        doc.setFont('Calibri', 'normal');
        doc.setFontSize(8);
        
        const sigX1 = margin + 2;
        const sigX2 = margin + ticketWidth / 2 - 4;
        const sigX3 = margin + ticketWidth - 12;

        doc.line(sigX1, yPos, sigX1 + 12, yPos);
        doc.text('AO SIGN', sigX1, yPos + 1.5);

        doc.line(sigX2, yPos, sigX2 + 12, yPos);
        doc.text('DATE', sigX2 + 2, yPos + 1.5);

        doc.line(sigX3, yPos, sigX3 + 12, yPos);
        doc.text('PRINCIPAL', sigX3, yPos + 1.5);
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