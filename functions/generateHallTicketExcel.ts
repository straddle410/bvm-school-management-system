import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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

        // Generate CSV content
        const headers = ['Hall Ticket No', 'Student Name', 'Class', 'Section', 'Roll No', 'Status'];
        const csvRows = [headers.join(',')];
        
        hallTickets.forEach(ticket => {
            const row = [
                `"${ticket.hall_ticket_number}"`,
                `"${ticket.student_name}"`,
                `"${ticket.class_name}"`,
                `"${ticket.section}"`,
                ticket.roll_number,
                `"${ticket.status}"`
            ];
            csvRows.push(row.join(','));
        });

        const csvContent = csvRows.join('\n');
        const buffer = new TextEncoder().encode(csvContent);

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
                'Content-Type': 'text/csv;charset=utf-8',
                'Content-Disposition': 'attachment; filename=hall_tickets.csv'
            }
        });
    } catch (error) {
        console.error('[generateHallTicketExcel Error]', error.message);
        return Response.json({ error: error.message }, { status: 500 });
    }
});