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

        // Fetch school profile for template
        const schoolProfiles = await base44.asServiceRole.entities.SchoolProfile.list();
        const schoolProfile = schoolProfiles[0];
        
        if (!schoolProfile?.hall_ticket_template_url) {
            return Response.json({ error: 'No hall ticket template uploaded' }, { status: 400 });
        }

        // Download and load template
        const templateResponse = await fetch(schoolProfile.hall_ticket_template_url);
        const templateBuffer = await templateResponse.arrayBuffer();
        
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(templateBuffer);
        
        const worksheet = workbook.worksheets[0];
        
        // Fill in hall ticket data - repeat template for each ticket
        let currentRow = 1;
        const TICKET_HEIGHT = 15; // Rows per ticket in template
        
        hallTickets.forEach((ticket, index) => {
            if (index > 0) {
                currentRow += TICKET_HEIGHT;
            }
            
            // Row 3 (relative): Student Name in merged column C
            const studentNameRow = currentRow + 2;
            const nameCell = worksheet.getCell(studentNameRow, 3);
            nameCell.value = ticket.student_name;
            
            // Row 4 (relative): Student Number in column C, Class and Section in column E
            const studentNumberRow = currentRow + 3;
            const numberCell = worksheet.getCell(studentNumberRow, 3);
            numberCell.value = ticket.roll_number;
            
            const classSecCell = worksheet.getCell(studentNumberRow, 5);
            classSecCell.value = `${ticket.class_name} - ${ticket.section}`;
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