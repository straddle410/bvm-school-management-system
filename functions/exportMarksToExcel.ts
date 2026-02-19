import ExcelJS from 'npm:exceljs@4.3.0';

Deno.serve(async (req) => {
  try {
    const { marks, className, section, examType } = await req.json();

    if (!marks || marks.length === 0) {
      return Response.json({ error: 'No marks data provided' }, { status: 400 });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Marks');

    // Get all unique subjects
    const subjects = [...new Set(marks.map(m => m.subject))];

    // Setup columns: Rank, Student Name, then all subjects, then Total
    const columns = [
      { header: 'Rank', width: 8 },
      { header: 'Student Name', width: 25 },
      ...subjects.map(s => ({ header: s, width: 15 })),
      { header: 'Total', width: 12 }
    ];
    worksheet.columns = columns;

    // Title
    worksheet.getCell('A1').value = `${className}-${section} | ${examType}`;
    worksheet.getCell('A1').font = { bold: true, size: 14 };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };
    worksheet.mergeCells(`A1:${String.fromCharCode(65 + columns.length - 1)}1`);

    // Header row
    const headerRow = 3;
    const headerCells = ['A', 'B'];
    subjects.forEach((_, i) => headerCells.push(String.fromCharCode(67 + i)));
    headerCells.push(String.fromCharCode(67 + subjects.length));

    headerCells.forEach((col, idx) => {
      const cell = worksheet.getCell(`${col}${headerRow}`);
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a237e' } };
    });

    // Group marks by student and calculate totals
    const studentMarks = {};
    marks.forEach(mark => {
      if (!studentMarks[mark.student_id]) {
        studentMarks[mark.student_id] = {
          student_name: mark.student_name,
          subjects: {},
          total: 0
        };
      }
      studentMarks[mark.student_id].subjects[mark.subject] = mark.marks_obtained;
      studentMarks[mark.student_id].total += mark.marks_obtained;
    });

    // Sort by total marks
    const sortedStudents = Object.entries(studentMarks)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([id, data], idx) => ({ student_id: id, ...data, rank: idx + 1 }));

    // Data rows
    let row = 4;
    sortedStudents.forEach(student => {
      let col = 0;
      worksheet.getCell(row, ++col).value = student.rank;
      worksheet.getCell(row, ++col).value = student.student_name;
      subjects.forEach(subject => {
        worksheet.getCell(row, ++col).value = student.subjects[subject] || '-';
      });
      worksheet.getCell(row, ++col).value = student.total;
      row++;
    });

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