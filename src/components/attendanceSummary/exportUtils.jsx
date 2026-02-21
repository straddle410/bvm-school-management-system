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
  
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 10;

  // Title
  doc.setFontSize(16);
  doc.setFont(undefined, 'bold');
  doc.text('Attendance Summary Report', 10, yPos);
  yPos += 8;
  
  // Info
  doc.setFontSize(10);
  doc.setFont(undefined, 'normal');
  doc.text(`Period: ${format(new Date(fromDate), 'dd MMM yyyy')} to ${format(new Date(toDate), 'dd MMM yyyy')}`, 10, yPos);
  yPos += 6;
  doc.text(`Total Students: ${data.length}`, 10, yPos);
  yPos += 8;

  // Table headers
  const colWidths = [35, 15, 15, 18, 15, 15, 15, 18];
  const columns = ['Student Name', 'Roll No', 'Class', 'Working Days', 'Holidays', 'Present', 'Absent', 'Attendance %'];
  const startX = 8;
  
  // Draw header
  doc.setFillColor(30, 64, 175);
  doc.setTextColor(255, 255, 255);
  doc.setFont(undefined, 'bold');
  doc.setFontSize(9);
  
  let xPos = startX;
  columns.forEach((col, idx) => {
    doc.text(col, xPos + colWidths[idx] / 2, yPos, { align: 'center', maxWidth: colWidths[idx] - 2 });
    xPos += colWidths[idx];
  });
  yPos += 7;

  // Draw rows
  doc.setTextColor(0, 0, 0);
  doc.setFont(undefined, 'normal');
  
  data.forEach((student) => {
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

    // Check if we need a new page
    if (yPos > pageHeight - 15) {
      doc.addPage();
      yPos = 10;
    }

    // Highlight low attendance row
    if (student.attendancePercent < 75) {
      doc.setFillColor(239, 83, 80);
    } else {
      doc.setFillColor(245, 245, 245);
    }
    
    xPos = startX;
    rowData.forEach((cell, idx) => {
      const cellX = xPos + colWidths[idx] / 2;
      if (student.attendancePercent < 75 && idx === 7) {
        doc.setTextColor(255, 255, 255);
        doc.setFont(undefined, 'bold');
      } else {
        doc.setTextColor(0, 0, 0);
        doc.setFont(undefined, 'normal');
      }
      doc.text(cell, cellX, yPos, { align: 'center', maxWidth: colWidths[idx] - 2 });
      xPos += colWidths[idx];
    });
    
    yPos += 6;
  });

  doc.save(filename);
};