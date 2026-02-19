import { ExcelJS } from 'npm:exceljs@4.3.0';

Deno.serve(async (req) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Students');

    // Headers
    const headers = [
      'student_id',
      'name',
      'class_name',
      'section',
      'roll_no',
      'parent_name',
      'parent_phone',
      'parent_email',
      'dob',
      'gender',
      'address',
      'blood_group',
      'admission_date',
      'academic_year',
      'status'
    ];

    worksheet.addRow(headers);

    // Style header row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a237e' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'center' };

    // Add sample empty rows (10 rows for data entry)
    for (let i = 0; i < 10; i++) {
      worksheet.addRow([
        `STU${String(i + 1).padStart(3, '0')}`,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '2024-25',
        'Approved'
      ]);
    }

    // Set column widths
    worksheet.columns = [
      { width: 12 },
      { width: 20 },
      { width: 15 },
      { width: 10 },
      { width: 10 },
      { width: 20 },
      { width: 15 },
      { width: 25 },
      { width: 15 },
      { width: 10 },
      { width: 25 },
      { width: 12 },
      { width: 15 },
      { width: 12 },
      { width: 12 }
    ];

    // Freeze header row
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename=student_import_template.xlsx'
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});