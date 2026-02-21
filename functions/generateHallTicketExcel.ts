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

        // Create workbook with basic options
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Hall Tickets', {
            properties: { defaultColWidth: 12 }
        });

        let currentRow = 1;
        
        hallTickets.forEach((ticket) => {
            // Row 1: School Name
            const nameRow = worksheet.getRow(currentRow);
            nameRow.getCell(1).value = 'BVM SCHOOL OF EXCELLENCE, KOTHAKOTA';
            
            // Row 2: Exam Name
            const examRow = worksheet.getRow(currentRow + 1);
            examRow.getCell(1).value = 'EXAM NAME HALL TICKET-2023';
            
            // Row 3: Student Name
            const studentLabelRow = worksheet.getRow(currentRow + 2);
            studentLabelRow.getCell(1).value = 'STUDENT NAME :';
            studentLabelRow.getCell(3).value = ticket.student_name;
            
            // Row 4: Student Number and Class/Section
            const numberRow = worksheet.getRow(currentRow + 3);
            numberRow.getCell(1).value = 'STUDENT NUMBER :';
            numberRow.getCell(3).value = ticket.roll_number;
            numberRow.getCell(5).value = `Class: ${ticket.class_name}   Section: ${ticket.section}`;
            
            // Row 5: Timings
            const timingRow = worksheet.getRow(currentRow + 4);
            timingRow.getCell(1).value = 'TIMINGS 9:30 AM TO 12:30 PM';
            
            // Blank rows
            worksheet.getRow(currentRow + 5);
            worksheet.getRow(currentRow + 6);
            
            // Row 8: Headers
            const headerRow = worksheet.getRow(currentRow + 7);
            headerRow.getCell(1).value = 'SUBJECT';
            headerRow.getCell(2).value = 'DATE';
            headerRow.getCell(3).value = 'INVIGILATOR SIGN';
            
            // Blank rows for subject entries
            for (let i = 0; i < 4; i++) {
                worksheet.getRow(currentRow + 8 + i);
            }
            
            // Signature row
            const sigRow = worksheet.getRow(currentRow + 12);
            sigRow.getCell(1).value = 'AO SIGNATURE';
            sigRow.getCell(5).value = 'PRINCIPAL SIGNATURE';
            
            // Blank row before next ticket
            worksheet.getRow(currentRow + 13);
            worksheet.getRow(currentRow + 14);
            
            currentRow += 15;
        });

        // Set column widths
        worksheet.columns = [
            { width: 25 },
            { width: 15 },
            { width: 25 },
            { width: 15 },
            { width: 25 }
        ];

        // Generate and return buffer
        const buffer = await workbook.xlsx.writeBuffer();

        // Log download
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
                'Content-Disposition': `attachment; filename="hall_tickets.xlsx"`
            }
        });
    } catch (error) {
        console.error('Error:', error.message, error.stack);
        return Response.json({ error: error.message }, { status: 500 });
    }
});