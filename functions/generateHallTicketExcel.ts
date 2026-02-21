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

        // Build Excel as binary XML (XLSX format)
        const worksheetData = [];
        worksheetData.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
        worksheetData.push('<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">');
        worksheetData.push('<sheetData>');
        
        // Header row
        worksheetData.push('<row r="1">');
        worksheetData.push('<c r="A1" t="str"><v>Hall Ticket No</v></c>');
        worksheetData.push('<c r="B1" t="str"><v>Student Name</v></c>');
        worksheetData.push('<c r="C1" t="str"><v>Class</v></c>');
        worksheetData.push('<c r="D1" t="str"><v>Section</v></c>');
        worksheetData.push('<c r="E1" t="str"><v>Roll No</v></c>');
        worksheetData.push('<c r="F1" t="str"><v>Status</v></c>');
        worksheetData.push('</row>');
        
        // Data rows
        hallTickets.forEach((ticket, idx) => {
            const rowNum = idx + 2;
            worksheetData.push(`<row r="${rowNum}">`);
            worksheetData.push(`<c r="A${rowNum}" t="str"><v>${escapeXml(ticket.hall_ticket_number)}</v></c>`);
            worksheetData.push(`<c r="B${rowNum}" t="str"><v>${escapeXml(ticket.student_name)}</v></c>`);
            worksheetData.push(`<c r="C${rowNum}" t="str"><v>${escapeXml(ticket.class_name)}</v></c>`);
            worksheetData.push(`<c r="D${rowNum}" t="str"><v>${escapeXml(ticket.section)}</v></c>`);
            worksheetData.push(`<c r="E${rowNum}" t="n"><v>${ticket.roll_number}</v></c>`);
            worksheetData.push(`<c r="F${rowNum}" t="str"><v>${escapeXml(ticket.status)}</v></c>`);
            worksheetData.push('</row>');
        });
        
        worksheetData.push('</sheetData>');
        worksheetData.push('</worksheet>');
        
        const worksheetXml = worksheetData.join('');
        
        // Create workbook XML
        const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Hall Tickets" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;

        const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`;

        const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`;

        const zipEntries = [
            { name: '[Content_Types].xml', data: contentTypes },
            { name: '_rels/.rels', data: rels },
            { name: 'xl/workbook.xml', data: workbookXml },
            { name: 'xl/worksheets/sheet1.xml', data: worksheetXml },
            { name: 'xl/_rels/workbook.xml.rels', data: rels }
        ];

        // Create simple ZIP (no compression for now)
        const zipBuffer = createSimpleZip(zipEntries);

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

        return new Response(zipBuffer, {
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

function escapeXml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function createSimpleZip(entries) {
    const encoder = new TextEncoder();
    const parts = [];
    const dirOffsets = [];
    let offset = 0;

    // Write file entries
    for (const entry of entries) {
        const data = encoder.encode(entry.data);
        const filename = entry.name;
        const filenameBytes = encoder.encode(filename);
        
        dirOffsets.push(offset);
        
        // Local file header
        const header = new Uint8Array(30 + filenameBytes.length);
        const view = new DataView(header.buffer);
        view.setUint32(0, 0x04034b50, true); // Signature
        view.setUint16(4, 20, true); // Version needed
        view.setUint16(6, 0, true); // Flags
        view.setUint16(8, 0, true); // Compression method (0 = stored)
        view.setUint16(10, 0, true); // Last mod time
        view.setUint16(12, 0, true); // Last mod date
        view.setUint32(14, 0, true); // CRC32
        view.setUint32(18, data.length, true); // Compressed size
        view.setUint32(22, data.length, true); // Uncompressed size
        view.setUint16(26, filenameBytes.length, true); // Filename length
        view.setUint16(28, 0, true); // Extra field length
        
        header.set(filenameBytes, 30);
        
        parts.push(header, data);
        offset += header.length + data.length;
    }

    // Central directory
    const centralDir = [];
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const data = encoder.encode(entry.data);
        const filename = entry.name;
        const filenameBytes = encoder.encode(filename);
        
        const header = new Uint8Array(46 + filenameBytes.length);
        const view = new DataView(header.buffer);
        view.setUint32(0, 0x02014b50, true); // Signature
        view.setUint16(4, 20, true); // Version made by
        view.setUint16(6, 20, true); // Version needed
        view.setUint16(8, 0, true); // Flags
        view.setUint16(10, 0, true); // Compression method
        view.setUint16(12, 0, true); // Last mod time
        view.setUint16(14, 0, true); // Last mod date
        view.setUint32(16, 0, true); // CRC32
        view.setUint32(20, data.length, true); // Compressed size
        view.setUint32(24, data.length, true); // Uncompressed size
        view.setUint16(28, filenameBytes.length, true); // Filename length
        view.setUint16(30, 0, true); // Extra field length
        view.setUint16(32, 0, true); // File comment length
        view.setUint16(34, 0, true); // Disk number
        view.setUint16(36, 0, true); // Internal file attributes
        view.setUint32(38, 0, true); // External file attributes
        view.setUint32(42, dirOffsets[i], true); // Relative offset
        
        header.set(filenameBytes, 46);
        centralDir.push(header);
    }

    const centralDirData = new Uint8Array(centralDir.reduce((sum, h) => sum + h.length, 0));
    let pos = 0;
    for (const h of centralDir) {
        centralDirData.set(h, pos);
        pos += h.length;
    }
    
    const centralDirOffset = offset;
    offset += centralDirData.length;

    // End of central directory
    const eofHeader = new Uint8Array(22);
    const eofView = new DataView(eofHeader.buffer);
    eofView.setUint32(0, 0x06054b50, true); // Signature
    eofView.setUint16(4, 0, true); // Disk number
    eofView.setUint16(6, 0, true); // Disk with central dir
    eofView.setUint16(8, entries.length, true); // Entries on this disk
    eofView.setUint16(10, entries.length, true); // Total entries
    eofView.setUint32(12, centralDirData.length, true); // Central dir size
    eofView.setUint32(16, centralDirOffset, true); // Central dir offset
    eofView.setUint16(20, 0, true); // Comment length

    parts.push(centralDirData, eofHeader);
    
    // Combine all parts
    const totalSize = parts.reduce((sum, p) => sum + p.length, 0);
    const result = new Uint8Array(totalSize);
    pos = 0;
    for (const part of parts) {
        result.set(part, pos);
        pos += part.length;
    }
    
    return result;
}