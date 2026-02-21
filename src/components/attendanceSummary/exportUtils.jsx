import { format } from 'date-fns';

export const exportToExcel = async (data, filename) => {
  const ExcelJS = await import('npm:exceljs@4.3.0').then(m => m.default || m);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Attendance Report');

  // Headers
  const headers = ['Student Name', 'Roll No', 'Class', 'Working Days', 'Holidays', 'Present', 'Absent', 'Attendance %'];
  sheet.addRow(headers);
  
  // Style header
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
  headerRow.alignment = { horizontal: 'center', vertical: 'center' };

  // Data rows
  data.forEach(student => {
    sheet.addRow([
      student.name,
      student.rollNo,
      `${student.class}-${student.section}`,
      student.totalWorkingDays,
      student.totalHolidays,
      student.presentDays,
      student.absentDays,
      `${student.attendancePercent}%`
    ]);
  });

  // Adjust column widths
  sheet.columns.forEach((col, idx) => {
    col.width = idx === 0 ? 20 : 12;
  });

  // Color code attendance % column
  data.forEach((_, idx) => {
    const cell = sheet.getRow(idx + 2).getCell(8);
    if (student.attendancePercent < 75) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEF5350' } };
      cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
    }
  });

  // Generate and download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  a.remove();
};

export const exportToPDF = async (data, filename, fromDate, toDate) => {
  const jsPDF = await import('npm:jspdf@4.0.0').then(m => m.jsPDF || m.default);
  const doc = new jsPDF();

  // Title
  doc.setFontSize(16);
  doc.text('Attendance Summary Report', 14, 15);
  
  doc.setFontSize(10);
  doc.text(`Period: ${format(new Date(fromDate), 'dd MMM yyyy')} to ${format(new Date(toDate), 'dd MMM yyyy')}`, 14, 22);
  doc.text(`Total Students: ${data.length}`, 14, 28);

  // Table
  const columns = ['Student Name', 'Roll No', 'Class', 'Working\nDays', 'Holidays', 'Present', 'Absent', 'Attendance %'];
  const rows = data.map(s => [
    s.name,
    s.rollNo,
    `${s.class}-${s.section}`,
    s.totalWorkingDays,
    s.totalHolidays,
    s.presentDays,
    s.absentDays,
    `${s.attendancePercent}%`
  ]);

  doc.autoTable({
    head: [columns],
    body: rows,
    startY: 35,
    didDrawCell: (data) => {
      // Highlight low attendance
      if (data.column.index === 7 && data.row.index > 0) {
        const rowData = rows[data.row.index - 1];
        const percent = parseFloat(rowData[7]);
        if (percent < 75) {
          data.cell.styles.fillColor = [239, 83, 80];
          data.cell.styles.textColor = [255, 255, 255];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    }
  });

  doc.save(filename);
};