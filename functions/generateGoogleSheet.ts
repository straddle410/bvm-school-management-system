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
            console.log('Auth not available, proceeding with service role');
        }

        if (!hallTicketIds || hallTicketIds.length === 0) {
            return Response.json({ error: 'No hall tickets selected' }, { status: 400 });
        }

        // Get access token for Google Sheets
        const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlesheets');

        // Fetch hall tickets
        const hallTickets = [];
        for (const id of hallTicketIds) {
            const ticket = await base44.asServiceRole.entities.HallTicket.get(id);
            if (ticket) hallTickets.push(ticket);
        }

        if (hallTickets.length === 0) {
            return Response.json({ error: 'No hall tickets found' }, { status: 404 });
        }

        // Create new spreadsheet
        const createResponse = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                properties: {
                    title: `Hall Tickets - ${new Date().toLocaleDateString()}`
                }
            })
        });

        const spreadsheet = await createResponse.json();
        const spreadsheetId = spreadsheet.spreadsheetId;
        console.log('Created spreadsheet:', spreadsheetId);

        // Prepare data rows
        const values = [
            ['STUDENT NAME', 'ROLL NUMBER', 'CLASS', 'SECTION', 'EXAM TYPE', 'HALL TICKET NO']
        ];

        hallTickets.forEach(ticket => {
            values.push([
                ticket.student_name,
                ticket.roll_number,
                ticket.class_name,
                ticket.section,
                ticket.exam_type,
                ticket.hall_ticket_number
            ]);
        });

        // Update spreadsheet with data
        const updateResponse = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1?valueInputOption=RAW`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ values })
            }
        );

        const updateResult = await updateResponse.json();
        console.log('Updated spreadsheet with data');

        // Format header row (bold)
        const formatResponse = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/batchUpdate`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    requests: [
                        {
                            repeatCell: {
                                range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1 },
                                cell: {
                                    userEnteredFormat: {
                                        textFormat: { bold: true },
                                        backgroundColor: { red: 0.9, green: 0.9, blue: 0.9 }
                                    }
                                },
                                fields: 'userEnteredFormat(textFormat,backgroundColor)'
                            }
                        }
                    ]
                })
            }
        );

        // Share the spreadsheet with the user
        const shareResponse = await fetch(
            `https://www.googleapis.com/drive/v3/files/${spreadsheetId}/permissions`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    role: 'owner',
                    type: 'user',
                    emailAddress: user.email
                })
            }
        );

        // Log the action
        try {
            await base44.asServiceRole.entities.HallTicketLog.create({
                action: 'created_google_sheet',
                hall_ticket_id: hallTicketIds[0],
                student_id: 'multiple',
                performed_by: user.email,
                details: `Created Google Sheet for ${hallTickets.length} hall tickets`
            });
        } catch (e) {
            console.error('Log error:', e.message);
        }

        // Return spreadsheet URL
        const sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
        
        return Response.json({ 
            success: true,
            sheetUrl,
            spreadsheetId
        });

    } catch (error) {
        console.error('Error:', error.message);
        return Response.json({ error: error.message }, { status: 500 });
    }
});