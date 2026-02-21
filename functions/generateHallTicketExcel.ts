import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import ExcelJSModule from 'npm:exceljs@4.3.0';

const ExcelJS = ExcelJSModule.default || ExcelJSModule;

const generateExcel = async (hallTickets, schoolProfile, timetable, examType, templateUrl) => {
          const workbook = new ExcelJS.Workbook();

          // If template URL is provided, load it; otherwise create from scratch
          if (templateUrl) {
              try {
                  const response = await fetch(templateUrl);
                  const arrayBuffer = await response.arrayBuffer();
                  await workbook.xlsx.load(arrayBuffer);

                  // Clear existing worksheets except the first one
                  while (workbook.worksheets.length > 1) {
                      workbook.removeWorksheet(workbook.worksheets[workbook.worksheets.length - 1]);
                  }
              } catch (error) {
                  console.error('Failed to load template:', error);
              }
          }

          hallTickets.forEach((ticket, index) => {
              let worksheet;

              if (templateUrl && index === 0) {
                  // Use the loaded template for the first ticket
                  worksheet = workbook.worksheets[0];
              } else {
                  // Create new worksheet for additional tickets
                  worksheet = workbook.addWorksheet(`Ticket ${index + 1}`);
              }

              // Fill student data into template
              const studentName = ticket.student_name || '';
              const hallTicketNumber = ticket.hall_ticket_number || '';

              // Find and update cells with student data
              worksheet.eachRow((row) => {
                  row.eachCell((cell) => {
                      if (cell.value && typeof cell.value === 'string') {
                          // Replace placeholders
                          if (cell.value.includes('STUDENT NAME')) {
                              cell.value = `STUDENT NAME : ${studentName}`;
                          } else if (cell.value.includes('STUDENT NUMBER')) {
                              cell.value = `STUDENT NUMBER : ${hallTicketNumber}`;
                          } else if (cell.value.includes('EXAM NAME')) {
                              const examTypeText = examType ? `${examType.name} HALL TICKET-2023` : 'EXAM HALL TICKET-2023';
                              cell.value = cell.value.replace(/EXAM NAME[^-]*/i, examTypeText);
                          }
                      }
                  });
              });

              // Fill timetable data
              let subjectRow = null;
              worksheet.eachRow((row, rowNumber) => {
                  const firstCell = row.getCell(1).value;
                  if (firstCell && firstCell.toString().toUpperCase().includes('SUBJECT')) {
                      subjectRow = rowNumber + 1;
                  }
              });

              if (subjectRow) {
                  const subjects = ['TELUGU', 'HINDI', 'ENGLISH', 'MATHEMATICS', 'GENERAL SCIENCE', 'SOCIAL STUDIES', 'OPTIONAL SUBJECT'];
                  subjects.forEach((subject, idx) => {
                      const row = worksheet.getRow(subjectRow + idx);
                      row.getCell(1).value = subject;

                      const tt = timetable.find(t => t.subject_name === subject);
                      if (tt && tt.exam_date) {
                          const date = new Date(tt.exam_date);
                          const d = date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' });
                          const day = date.toLocaleDateString('en-IN', { weekday: 'short' });
                          row.getCell(2).value = `${d} ${day}`;
                      }
                  });
              }

              // Set page setup for printing
              worksheet.pageSetup = {
                  paperSize: 1,
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
        const { hallTicketIds } = payload;

        let user;
        try {
            user = await base44.auth.me();
        } catch (e) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
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

        let schoolProfile = null;
        let examTypeData = null;
        let timetableList = [];

        try {
            const schoolProfiles = await base44.asServiceRole.entities.SchoolProfile.list();
            schoolProfile = schoolProfiles[0];
        } catch (e) {
            console.error('Failed to load school profile:', e.message);
        }

        try {
            examTypeData = await base44.asServiceRole.entities.ExamType.get(hallTickets[0].exam_type);
        } catch (e) {
            console.error('Failed to load exam type:', e.message);
        }

        try {
            timetableList = await base44.asServiceRole.entities.ExamTimetable.filter({
                exam_type: hallTickets[0].exam_type,
                academic_year: hallTickets[0].academic_year
            });
        } catch (e) {
            console.error('Failed to load timetable:', e.message);
        }

        const excelBuffer = await generateExcel(hallTickets, schoolProfile, timetableList, examTypeData, schoolProfile?.hall_ticket_template_url);

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