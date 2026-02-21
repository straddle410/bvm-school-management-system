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
  const doc = new jsPDF('l', 'mm', 'a4');
  
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPos = 12;

  // Title
  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.text('Attendance Summary Report', 14, yPos);
  yPos += 8;
  
  // Info
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text(`Period: ${format(new Date(fromDate), 'dd MMM yyyy')} to ${format(new Date(toDate), 'dd MMM yyyy')}`, 14, yPos);
  yPos += 6;
  doc.text(`Total Students: ${data.length}`, 14, yPos);
  yPos += 10;

  // Table setup
  const columns = ['Student Name', 'Roll No', 'Class', 'Working Days', 'Holidays', 'Present', 'Absent', 'Attendance %'];
  const colWidths = [28, 12, 12, 16, 14, 12, 12, 16];
  const startX = 14;
  const headerHeight = 6;
  const rowHeight = 5;

  // Draw header row
  doc.setFillColor(30, 64, 175);
  doc.setTextColor(255, 255, 255);
  doc.setFont(undefined, 'bold');
  doc.setFontSize(8);

  let xPos = startX;
  for (let i = 0; i < columns.length; i++) {
    doc.rect(xPos, yPos, colWidths[i], headerHeight, 'F');
    doc.text(columns[i], xPos + colWidths[i] / 2, yPos + 3.5, { align: 'center' });
    xPos += colWidths[i];
  }
  yPos += headerHeight;

  // Draw data rows
  doc.setFontSize(7);
  
  data.forEach((student) => {
    // Check for new page
    if (yPos > pageHeight - 12) {
      doc.addPage();
      yPos = 12;
    }

    const rowData = [
      student.name,
      String(student.rollNo),
      `${student.class}-${student.section}`,
      String(student.totalWorkingDays),
      String(student.totalHolidays),
      String(student.presentDays),
      String(student.absentDays),
      `${student.attendancePercent}%`
    ];

    // Set row background
    const isLowAttendance = student.attendancePercent < 75;
    if (isLowAttendance) {
      doc.setFillColor(239, 83, 80);
      doc.rect(startX, yPos, colWidths.reduce((a, b) => a + b, 0), rowHeight, 'F');
      doc.setTextColor(255, 255, 255);
    } else {
      doc.setFillColor(240, 240, 240);
      doc.rect(startX, yPos, colWidths.reduce((a, b) => a + b, 0), rowHeight, 'F');
      doc.setTextColor(0, 0, 0);
    }

    // Draw cells
    xPos = startX;
    for (let i = 0; i < rowData.length; i++) {
      doc.text(rowData[i], xPos + colWidths[i] / 2, yPos + 3.5, { align: 'center', maxWidth: colWidths[i] - 1 });
      doc.rect(xPos, yPos, colWidths[i], rowHeight);
      xPos += colWidths[i];
    }
    
    yPos += rowHeight;
  });

  doc.save(filename);
};