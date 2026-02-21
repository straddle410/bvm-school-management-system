import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import ExcelJS from 'npm:exceljs@4.3.0';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const payload = await req.json();
        const { hallTicketIds } = payload;
        
        let user = null;
        try {
            user = await base44.auth.me();
        } catch (e) {
            console.error('Auth failed:', e.message);
        }

        if (!hallTicketIds || hallTicketIds.length === 0) {
            return Response.json({ error: 'No hall tickets selected' }, { status: 400 });
        }

        // Fetch hall tickets
        const hallTickets = [];
        for (const id of hallTicketIds) {
            const ticket = await base44.asServiceRole.entities.HallTicket.get(id);
            if (ticket) hallTickets.push(ticket);
        }

        if (hallTickets.length === 0) {
            return Response.json({ error: 'No hall tickets found' }, { status: 404 });
        }

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Hall Tickets');

        let row = 1;
        
        for (const ticket of hallTickets) {
            // School header
            worksheet.getCell(`A${row}`).value = 'BVM SCHOOL OF EXCELLENCE, KOTHAKOTA';
            row++;
            
            // Exam name
            worksheet.getCell(`A${row}`).value = 'EXAM NAME HALL TICKET-2023';
            row++;
            
            // Student name
            worksheet.getCell(`A${row}`).value = 'STUDENT NAME :';
            worksheet.getCell(`C${row}`).value = ticket.student_name;
            row++;
            
            // Roll number and class
            worksheet.getCell(`A${row}`).value = 'STUDENT NUMBER :';
            worksheet.getCell(`C${row}`).value = ticket.roll_number;
            worksheet.getCell(`E${row}`).value = `Class: ${ticket.class_name}   Section: ${ticket.section}`;
            row++;
            
            // Timings
            worksheet.getCell(`A${row}`).value = 'TIMINGS 9:30 AM TO 12:30 PM';
            row += 3;
            
            // Headers
            worksheet.getCell(`A${row}`).value = 'SUBJECT';
            worksheet.getCell(`B${row}`).value = 'DATE';
            worksheet.getCell(`C${row}`).value = 'INVIGILATOR SIGN';
            row += 5;
            
            // Signatures
            worksheet.getCell(`A${row}`).value = 'AO SIGNATURE';
            worksheet.getCell(`E${row}`).value = 'PRINCIPAL SIGNATURE';
            row += 3;
        }

        worksheet.columns = [
            { width: 25 },
            { width: 15 },
            { width: 25 },
            { width: 15 },
            { width: 25 }
        ];

        const buffer = await workbook.xlsx.writeBuffer();

        try {
            await base44.asServiceRole.entities.HallTicketLog.create({
                action: 'downloaded_excel',
                hall_ticket_id: hallTicketIds[0],
                student_id: 'multiple',
                performed_by: user?.email || 'system',
                details: `Downloaded Excel for ${hallTickets.length} hall tickets`
            });
        } catch (e) {
            console.error('Log error:', e.message);
        }

        return new Response(buffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': 'attachment; filename="hall_tickets.xlsx"'
            }
        });
    } catch (error) {
        console.error('Error:', error.message);
        return Response.json({ error: error.message }, { status: 500 });
    }
});