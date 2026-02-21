import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import * as ExcelJS from 'npm:exceljs@4.3.0';

const generateExcel = async (hallTickets, schoolProfile, timetable, examType) => {
    const workbook = new ExcelJS.Workbook();

    hallTickets.forEach((ticket, index) => {
        const worksheet = workbook.addWorksheet(`Ticket ${index + 1}`);
        
        // Set column widths
        worksheet.columns = [
            { width: 20 },
            { width: 15 },
            { width: 15 },
            { width: 15 },
            { width: 15 },
            { width: 15 },
            { width: 15 }
        ];

        let row = 1;

        // Row 1: School Name
        const schoolNameCell = worksheet.getCell(row, 1);
        schoolNameCell.value = 'BVM SCHOOL OF EXCELLENCE, KOTHAKOTA';
        schoolNameCell.font = { name: 'Calibri', size: 16, bold: true };
        schoolNameCell.alignment = { horizontal: 'left', vertical: 'center', wrapText: true };
        worksheet.getRow(row).height = 20;
        row += 1;

        // Row 2: Exam Type
        const examCell = worksheet.getCell(row, 1);
        const examTypeText = examType ? `${examType.name} HALL TICKET - 2023` : 'EXAM HALL TICKET - 2023';
        examCell.value = examTypeText;
        examCell.font = { name: 'Calibri', size: 13, bold: true };
        examCell.alignment = { horizontal: 'left', vertical: 'center', wrapText: true };
        worksheet.getRow(row).height = 16;
        row += 1;

        // Row 3: Student Name
        const nameCell = worksheet.getCell(row, 1);
        nameCell.value = `STUDENT NAME : ${ticket.student_name || ''}`;
        nameCell.font = { name: 'Calibri', size: 11 };
        nameCell.alignment = { horizontal: 'left', vertical: 'center' };
        worksheet.getRow(row).height = 14;
        row += 1;

        // Row 4: Student Number
        const numberCell = worksheet.getCell(row, 1);
        numberCell.value = `STUDENT NUMBER : ${ticket.hall_ticket_number || ''}`;
        numberCell.font = { name: 'Calibri', size: 11 };
        numberCell.alignment = { horizontal: 'left', vertical: 'center' };
        worksheet.getRow(row).height = 14;
        row += 1;

        // Row 5: Timings
        const timingCell = worksheet.getCell(row, 1);
        timingCell.value = 'TIMINGS : 9:30 AM TO 12:30 PM';
        timingCell.font = { name: 'Calibri', size: 11 };
        timingCell.alignment = { horizontal: 'left', vertical: 'center' };
        worksheet.getRow(row).height = 14;
        row += 2;

        // Table Header
        const headerRow = worksheet.getRow(row);
        headerRow.getCell(1).value = 'SUBJECT';
        headerRow.getCell(2).value = 'DATE & DAY';
        headerRow.getCell(3).value = 'INVIGILATOR SIGN';

        headerRow.eachCell((cell) => {
            cell.font = { name: 'Calibri', size: 10, bold: true };
            cell.alignment = { horizontal: 'left', vertical: 'center' };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
        });
        worksheet.getRow(row).height = 16;
        row += 1;

        // Subject rows
        const subjects = ['TELUGU', 'HINDI', 'ENGLISH', 'MATHEMATICS', 'GENERAL SCIENCE', 'SOCIAL STUDIES', 'OPTIONAL SUBJECT'];

        subjects.forEach((subject) => {
            const dataRow = worksheet.getRow(row);
            dataRow.getCell(1).value = subject;
            
            const tt = timetable.find(t => t.subject_name === subject);
            if (tt && tt.exam_date) {
                const date = new Date(tt.exam_date);
                const d = date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' });
                const day = date.toLocaleDateString('en-IN', { weekday: 'short' });
                dataRow.getCell(2).value = `${d} ${day}`;
            }

            dataRow.eachCell((cell) => {
                cell.font = { name: 'Calibri', size: 10 };
                cell.alignment = { horizontal: 'left', vertical: 'center' };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
            worksheet.getRow(row).height = 14;
            row += 1;
        });

        // Add signature lines at bottom
        row += 1;
        const sigRow = worksheet.getRow(row);
        sigRow.getCell(1).value = 'AO SIGNATURE';
        sigRow.getCell(2).value = 'DATE';
        sigRow.getCell(3).value = 'PRINCIPAL SIGNATURE';

        sigRow.eachCell((cell) => {
            cell.font = { name: 'Calibri', size: 9 };
            cell.alignment = { horizontal: 'left', vertical: 'center' };
            cell.border = { top: { style: 'thin' } };
        });

        // Set page setup for printing
        worksheet.pageSetup = {
            paperSize: worksheet.paperSize.A4,
            orientation: 'portrait',
            margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5 }
        };
    });

    return await workbook.xlsx.writeBuffer();
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

        const excelBuffer = await generateExcel(hallTickets, schoolProfile, timetableList, examTypeData);

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

        return new Response(excelBuffer, {
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