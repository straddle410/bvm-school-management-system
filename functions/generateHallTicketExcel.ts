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

        // Create workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Hall Tickets');

        // Process each hall ticket
        let currentRow = 1;
        
        hallTickets.forEach((ticket, index) => {
            // School Name
            worksheet.getCell(currentRow, 1).value = 'BVM SCHOOL OF EXCELLENCE, KOTHAKOTA';
            
            // Exam name
            worksheet.getCell(currentRow + 1, 1).value = 'EXAM NAME HALL TICKET-2023';
            
            // Student Name label
            worksheet.getCell(currentRow + 2, 1).value = 'STUDENT NAME :';
            // Fill student name in merged columns (C:F)
            const studentNameCell = worksheet.getCell(currentRow + 2, 3);
            studentNameCell.value = ticket.student_name;
            
            // Student Number label
            worksheet.getCell(currentRow + 3, 1).value = 'STUDENT NUMBER :';
            // Fill student number in column C
            const numberCell = worksheet.getCell(currentRow + 3, 3);
            numberCell.value = ticket.roll_number;
            // Fill class and section in column E
            const classSecCell = worksheet.getCell(currentRow + 3, 5);
            classSecCell.value = `Class: ${ticket.class_name}   Section: ${ticket.section}`;
            
            // Timings
            worksheet.getCell(currentRow + 4, 1).value = 'TIMINGS 9:30 AM TO 12:30 PM';
            
            // Table headers
            worksheet.getCell(currentRow + 7, 1).value = 'SUBJECT';
            worksheet.getCell(currentRow + 7, 2).value = 'DATE';
            worksheet.getCell(currentRow + 7, 3).value = 'INVIGILATOR SIGN';
            
            // Signature row
            worksheet.getCell(currentRow + 12, 1).value = 'AO SIGNATURE';
            worksheet.getCell(currentRow + 12, 5).value = 'PRINCIPAL SIGNATURE';
            
            currentRow += 15; // Space between tickets
        });

        // Generate Excel buffer
        const buffer = await workbook.xlsx.writeBuffer();

        // Log the download
        try {
            await base44.asServiceRole.entities.HallTicketLog.create({
                action: 'downloaded_excel',
                hall_ticket_id: hallTicketIds[0],
                student_id: 'multiple',
                performed_by: user?.email || 'system',
                details: `Downloaded Excel for ${hallTickets.length} hall tickets`
            });
        } catch (e) {
            console.error('Failed to log download:', e.message);
        }

        return new Response(buffer, {
            status: 200,
            headers: {
                'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition': 'attachment; filename=hall_tickets.xlsx'
            }
        });
    } catch (error) {
        console.error('[generateHallTicketExcel Error]', error.message);
        return Response.json({ error: error.message }, { status: 500 });
    }
});