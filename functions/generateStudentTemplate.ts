import ExcelJS from 'npm:exceljs@4.3.0';

Deno.serve(async (req) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Students');

    // Headers (student_id and roll_no are auto-generated)
    const headers = [
      'name',
      'class_name',
      'section',
      'parent_name',
      'parent_phone',
      'parent_email',
      'dob',
      'gender',
      'address',
      'blood_group',
      'admission_date',
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
        '', // name
        '', // class_name
        '', // section
        '', // parent_name
        '', // parent_phone
        '', // parent_email
        '', // dob
        '', // gender
        '', // address
        '', // blood_group
        '', // admission_date
        'Pending' // status
      ]);
    }

    // Set column widths
    worksheet.columns = [
      { width: 25 }, // name
      { width: 15 }, // class_name
      { width: 10 }, // section
      { width: 20 }, // parent_name
      { width: 15 }, // parent_phone
      { width: 25 }, // parent_email
      { width: 15 }, // dob
      { width: 10 }, // gender
      { width: 25 }, // address
      { width: 12 }, // blood_group
      { width: 15 }, // admission_date
      { width: 12 }  // status
    ];

    // Freeze header row
    worksheet.views = [{ state: 'frozen', ySplit: 1 }];

    const buffer = await workbook.xlsx.writeBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));

    return Response.json({ 
      file: base64
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});