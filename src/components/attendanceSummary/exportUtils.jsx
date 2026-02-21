import { format } from 'date-fns';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';

export const exportToExcel = async (data, filename, fromDate, toDate) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Attendance Report');

  // Set narrow margins
  sheet.pageSetup = { paperSize: 9, orientation: 'landscape' };
  sheet.margins = { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5 };

  // Title row
  sheet.addRow(['Attendance Summary Report']);
  const titleRow = sheet.getRow(1);
  titleRow.font = { bold: true, size: 14 };
  titleRow.alignment = { horizontal: 'left', vertical: 'center' };
  sheet.getCell('A1').alignment = { horizontal: 'left', vertical: 'center' };

  // Info row
  sheet.addRow([`Period: ${format(new Date(fromDate), 'dd MMM yyyy')} to ${format(new Date(toDate), 'dd MMM yyyy')}`]);
  const infoRow = sheet.getRow(2);
  infoRow.font = { size: 11 };

  // Empty row
  sheet.addRow([]);

  // Headers
  const headers = ['Student Name', 'Roll No', 'Class', 'Working Days', 'Holidays', 'Present', 'Absent', 'Attendance %'];
  const headerRowNum = 4;
  sheet.addRow(headers);
  
  const headerRow = sheet.getRow(headerRowNum);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
  headerRow.alignment = { horizontal: 'center', vertical: 'center' };

  // Data rows
  data.forEach((student, idx) => {
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

    // Color code low attendance
    if (student.attendancePercent < 75) {
      const cell = sheet.getRow(headerRowNum + idx + 1).getCell(8);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEF5350' } };
      cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
    }
  });

  // Adjust column widths for A4
  sheet.columns = [
    { width: 18 }, // Student Name
    { width: 8 },  // Roll No
    { width: 7 },  // Class
    { width: 11 }, // Working Days
    { width: 10 }, // Holidays
    { width: 8 },  // Present
    { width: 8 },  // Absent
    { width: 13 }  // Attendance %
  ];

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
  const doc = new jsPDF('l', 'mm', 'a4'); // landscape, A4

  // Title
  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.text('Attendance Summary Report', 10, 12);
  
  // Info
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text(`Period: ${format(new Date(fromDate), 'dd MMM yyyy')} to ${format(new Date(toDate), 'dd MMM yyyy')}`, 10, 18);
  doc.text(`Total Students: ${data.length}`, 10, 24);

  // Table
  const columns = ['Student Name', 'Roll No', 'Class', 'Working Days', 'Holidays', 'Present', 'Absent', 'Attendance %'];
  const rows = data.map(s => [
    s.name,
    String(s.rollNo),
    `${s.class}-${s.section}`,
    String(s.totalWorkingDays),
    String(s.totalHolidays),
    String(s.presentDays),
    String(s.absentDays),
    `${s.attendancePercent}%`
  ]);

  doc.autoTable({
    head: [columns],
    body: rows,
    startY: 30,
    margin: { left: 8, right: 8, top: 8, bottom: 8 },
    headStyles: { fillColor: [30, 64, 175], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 15, halign: 'center' },
      2: { cellWidth: 15, halign: 'center' },
      3: { cellWidth: 18, halign: 'center' },
      4: { cellWidth: 15, halign: 'center' },
      5: { cellWidth: 15, halign: 'center' },
      6: { cellWidth: 15, halign: 'center' },
      7: { cellWidth: 18, halign: 'center' }
    },
    didDrawCell: (cellData) => {
      // Highlight low attendance
      if (cellData.column.index === 7 && cellData.row.section === 'body') {
        const rowData = rows[cellData.row.index];
        const percent = parseFloat(rowData[7]);
        if (percent < 75) {
          cellData.cell.styles.fillColor = [239, 83, 80];
          cellData.cell.styles.textColor = [255, 255, 255];
          cellData.cell.styles.fontStyle = 'bold';
        }
      }
    }
  });

  doc.save(filename);
};