import { format } from 'date-fns';
import jsPDF from 'jspdf';

export const exportToExcel = (data, filename, fromDate, toDate) => {
  const headers = ['Student Name', 'Roll No', 'Class', 'Working Days', 'Holidays', 'Present', 'Absent', 'Attendance %'];
  const rows = data.map(student => [
    student.name,
    student.rollNo,
    `${student.class}-${student.section}`,
    student.totalWorkingDays,
    student.totalHolidays,
    student.presentDays,
    student.absentDays,
    `${student.attendancePercent}%`
  ]);

  const csvContent = [
    [`Attendance Summary Report`],
    [`Period: ${format(new Date(fromDate), 'dd MMM yyyy')} to ${format(new Date(toDate), 'dd MMM yyyy')}`],
    [],
    headers,
    ...rows
  ].map(row => row.map(v => `"${v ?? ''}"`).join(',')).join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.replace(/\.xlsx?$/, '.csv');
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  a.remove();
};

export const exportToPDF = async (data, filename, fromDate, toDate) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPos = 12;

  // Title
  doc.setFontSize(14);
  doc.setFont(undefined, 'bold');
  doc.text('Attendance Summary Report', 10, yPos);
  yPos += 7;
  
  // Info
  doc.setFontSize(9);
  doc.setFont(undefined, 'normal');
  doc.text(`Period: ${format(new Date(fromDate), 'dd MMM yyyy')} to ${format(new Date(toDate), 'dd MMM yyyy')}`, 10, yPos);
  yPos += 5;
  doc.text(`Total Students: ${data.length}`, 10, yPos);
  yPos += 8;

  // Table setup - adjusted for portrait
  const columns = ['Student Name', 'Roll No', 'Class', 'Working Days', 'Holidays', 'Present', 'Absent', 'Attendance %'];
  const colWidths = [22, 10, 10, 15, 12, 10, 10, 15];
  const startX = 10;
  const headerHeight = 5;
  const rowHeight = 5;

  // Draw header row
  doc.setFillColor(30, 64, 175);
  doc.setTextColor(255, 255, 255);
  doc.setFont(undefined, 'bold');
  doc.setFontSize(7);

  let xPos = startX;
  for (let i = 0; i < columns.length; i++) {
    doc.rect(xPos, yPos, colWidths[i], headerHeight, 'F');
    doc.text(columns[i], xPos + colWidths[i] / 2, yPos + 3, { align: 'center' });
    xPos += colWidths[i];
  }
  yPos += headerHeight;

  // Draw data rows
  doc.setFontSize(7);
  doc.setTextColor(0, 0, 0);
  
  data.forEach((student) => {
    // Check for new page
    if (yPos > pageHeight - 10) {
      doc.addPage();
      yPos = 12;
      
      // Redraw header on new page
      doc.setFillColor(30, 64, 175);
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, 'bold');
      let xPosHeader = startX;
      for (let i = 0; i < columns.length; i++) {
        doc.rect(xPosHeader, yPos, colWidths[i], headerHeight, 'F');
        doc.text(columns[i], xPosHeader + colWidths[i] / 2, yPos + 3, { align: 'center' });
        xPosHeader += colWidths[i];
      }
      yPos += headerHeight;
      doc.setTextColor(0, 0, 0);
      doc.setFont(undefined, 'normal');
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

    // Light gray background for alternating rows
    doc.setFillColor(240, 240, 240);
    doc.rect(startX, yPos, colWidths.reduce((a, b) => a + b, 0), rowHeight, 'F');

    // Draw cells with borders
    xPos = startX;
    for (let i = 0; i < rowData.length; i++) {
      doc.text(rowData[i], xPos + colWidths[i] / 2, yPos + 3, { align: 'center', maxWidth: colWidths[i] - 1 });
      doc.rect(xPos, yPos, colWidths[i], rowHeight);
      xPos += colWidths[i];
    }
    
    yPos += rowHeight;
  });

  doc.save(filename);
};