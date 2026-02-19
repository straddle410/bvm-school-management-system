import ExcelJS from 'npm:exceljs@4.3.0';

Deno.serve(async (req) => {
  try {
    const { marks, className, section, examType, subject } = await req.json();

    if (!marks || marks.length === 0) {
      return Response.json({ error: 'No marks data provided' }, { status: 400 });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Marks');

    // Title
    worksheet.columns = [
      { header: `${className}-${section} | ${subject} | ${examType}`, width: 50 }
    ];
    worksheet.getCell('A1').font = { bold: true, size: 14 };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };
    worksheet.mergeCells('A1:D1');

    let row = 3;
    worksheet.getCell(`A${row}`).value = 'Class:';
    worksheet.getCell(`B${row}`).value = `${className}-${section}`;
    worksheet.getCell(`A${row}`).font = { bold: true };
    row++;

    worksheet.getCell(`A${row}`).value = 'Subject:';
    worksheet.getCell(`B${row}`).value = subject;
    worksheet.getCell(`A${row}`).font = { bold: true };
    row++;

    worksheet.getCell(`A${row}`).value = 'Exam Type:';
    worksheet.getCell(`B${row}`).value = examType;
    worksheet.getCell(`A${row}`).font = { bold: true };
    row += 2;

    // Headers
    worksheet.getCell(`A${row}`).value = 'Student Name';
    worksheet.getCell(`B${row}`).value = 'Student ID';
    worksheet.getCell(`C${row}`).value = 'Marks';
    worksheet.getCell(`D${row}`).value = 'Grade';

    ['A', 'B', 'C', 'D'].forEach(col => {
      worksheet.getCell(`${col}${row}`).font = { bold: true };
      worksheet.getCell(`${col}${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a237e' } };
      worksheet.getCell(`${col}${row}`).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    });
    row++;

    // Data rows
    marks.forEach(mark => {
      worksheet.getCell(`A${row}`).value = mark.student_name;
      worksheet.getCell(`B${row}`).value = mark.student_id;
      worksheet.getCell(`C${row}`).value = `${mark.marks_obtained}/${mark.max_marks}`;
      worksheet.getCell(`D${row}`).value = mark.grade;
      row++;
    });

    // Summary
    row += 2;
    worksheet.getCell(`A${row}`).value = 'Summary';
    worksheet.getCell(`A${row}`).font = { bold: true, size: 12 };
    row++;

    const totalMarks = marks.reduce((sum, m) => sum + m.marks_obtained, 0);
    const maxMarks = marks.length > 0 ? marks[0].max_marks * marks.length : 0;
    const avgPercentage = maxMarks > 0 ? Math.round((totalMarks / maxMarks) * 100) : 0;

    worksheet.getCell(`A${row}`).value = 'Total Students:';
    worksheet.getCell(`B${row}`).value = marks.length;
    worksheet.getCell(`A${row}`).font = { bold: true };
    row++;

    worksheet.getCell(`A${row}`).value = 'Class Average %:';
    worksheet.getCell(`B${row}`).value = avgPercentage;
    worksheet.getCell(`A${row}`).font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Marks_${className}_${section}_${examType}.xlsx"`
      }
    });
  } catch (error) {
    console.error('Export Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});