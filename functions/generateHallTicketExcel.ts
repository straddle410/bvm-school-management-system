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
        let templateUrl = null;
        try {
            const profiles = await base44.asServiceRole.entities.SchoolProfile.list();
            if (profiles.length > 0 && profiles[0].hall_ticket_template_url) {
                templateUrl = profiles[0].hall_ticket_template_url;
            }
        } catch (e) {
            console.error('Failed to fetch school profile:', e.message);
        }

        let workbook;
        
        if (templateUrl) {
            // Download and use template
            try {
                const templateResponse = await fetch(templateUrl);
                if (!templateResponse.ok) {
                    throw new Error(`Template fetch failed: ${templateResponse.status}`);
                }
                const templateBuffer = await templateResponse.arrayBuffer();
                workbook = new ExcelJS.Workbook();
                await workbook.xlsx.load(templateBuffer);
            } catch (e) {
                console.error('Failed to load template, using default:', e.message);
                workbook = createDefaultWorkbook();
            }
        } else {
            // Create default workbook if no template
            workbook = createDefaultWorkbook();
        }

        // Get or create the first worksheet
        let worksheet = workbook.worksheets[0];
        if (!worksheet) {
            worksheet = workbook.addWorksheet('Hall Tickets');
        }

        // Add headers if worksheet is empty
        if (worksheet.rowCount === 0) {
            worksheet.columns = [
                { header: 'Hall Ticket No', key: 'hall_ticket_number', width: 15 },
                { header: 'Student Name', key: 'student_name', width: 25 },
                { header: 'Class', key: 'class_name', width: 10 },
                { header: 'Section', key: 'section', width: 10 },
                { header: 'Roll No', key: 'roll_number', width: 10 },
                { header: 'Status', key: 'status', width: 12 }
            ];
            // Style header row
            worksheet.getRow(1).font = { bold: true };
            worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };
        }

        // Add student data rows
        let startRow = worksheet.rowCount + 1;
        hallTickets.forEach(ticket => {
            const row = worksheet.addRow({
                hall_ticket_number: ticket.hall_ticket_number,
                student_name: ticket.student_name,
                class_name: ticket.class_name,
                section: ticket.section,
                roll_number: ticket.roll_number,
                status: ticket.status
            });
            
            // Light styling for data rows
            row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
            row.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });

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

        // Generate Excel buffer
        const buffer = await workbook.xlsx.writeBuffer();
        
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

function createDefaultWorkbook() {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Hall Tickets');
    
    worksheet.columns = [
        { header: 'Hall Ticket No', key: 'hall_ticket_number', width: 15 },
        { header: 'Student Name', key: 'student_name', width: 25 },
        { header: 'Class', key: 'class_name', width: 10 },
        { header: 'Section', key: 'section', width: 10 },
        { header: 'Roll No', key: 'roll_number', width: 10 },
        { header: 'Status', key: 'status', width: 12 }
    ];
    
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD3D3D3' } };
    
    return workbook;
}