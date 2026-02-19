import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import ExcelJS from 'npm:exceljs@4.3.0';
import PDFDocument from 'npm:pdfkit@0.13.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { studentId, marks, format } = await req.json();

    if (!marks || marks.length === 0) {
      return Response.json({ error: 'No marks data provided' }, { status: 400 });
    }

    // Calculate totals and remarks
    const reportData = calculateRemarks(marks);

    if (format === 'excel') {
      return await generateExcel(reportData);
    } else if (format === 'pdf') {
      return await generatePDF(reportData);
    } else {
      return Response.json(reportData);
    }
  } catch (error) {
    console.error('Report Generation Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function calculateRemarks(marks) {
  const subjects = {};
  let totalObtained = 0;
  let totalMax = 0;

  // Group by subject and calculate
  marks.forEach(mark => {
    if (!subjects[mark.subject]) {
      subjects[mark.subject] = {
        subject: mark.subject,
        marks_obtained: 0,
        max_marks: 0
      };
    }
    subjects[mark.subject].marks_obtained += mark.marks_obtained;
    subjects[mark.subject].max_marks += mark.max_marks;
    totalObtained += mark.marks_obtained;
    totalMax += mark.max_marks;
  });

  // Add percentages to each subject (no remarks)
  const subjectDetails = Object.values(subjects).map(subj => {
    const percentage = (subj.marks_obtained / subj.max_marks) * 100;
    return {
      ...subj,
      percentage: Math.round(percentage)
    };
  });

  // Calculate overall
  const overallPercentage = Math.round((totalObtained / totalMax) * 100);
  const lowSubjects = subjectDetails.filter(s => s.percentage < 50).length;
  const overallRemark = getOverallRemark(overallPercentage, lowSubjects);

  // Get student info from first mark
  const firstMark = marks[0];

  return {
    student_name: firstMark.student_name,
    student_id: firstMark.student_id,
    class_name: firstMark.class_name,
    section: firstMark.section,
    total_obtained: totalObtained,
    total_max: totalMax,
    overall_percentage: overallPercentage,
    overall_remark: overallRemark,
    subjects: subjectDetails,
    generated_date: new Date().toLocaleDateString('en-IN')
  };
}

function getOverallRemark(percentage, lowSubjects) {
  if (lowSubjects > 2) {
    return 'Work hard in all subjects.';
  } else if (percentage >= 80) {
    return 'Outstanding performance. Keep up the excellent work!';
  } else if (percentage >= 60) {
    return 'Good performance. Continue to work hard.';
  } else {
    return 'Needs improvement overall.';
  }
}

async function generateExcel(reportData) {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Progress Report');

  // Header
  worksheet.columns = [
    { header: 'Progress Report', width: 50 }
  ];
  worksheet.getCell('A1').font = { bold: true, size: 16 };
  worksheet.getCell('A1').alignment = { horizontal: 'center' };
  worksheet.mergeCells('A1:D1');

  // Student Info
  let row = 3;
  worksheet.getCell(`A${row}`).value = 'Student Name:';
  worksheet.getCell(`B${row}`).value = reportData.student_name;
  worksheet.getCell(`A${row}`).font = { bold: true };
  row++;

  worksheet.getCell(`A${row}`).value = 'Student ID:';
  worksheet.getCell(`B${row}`).value = reportData.student_id;
  worksheet.getCell(`A${row}`).font = { bold: true };
  row++;

  worksheet.getCell(`A${row}`).value = 'Class:';
  worksheet.getCell(`B${row}`).value = `${reportData.class_name}-${reportData.section}`;
  worksheet.getCell(`A${row}`).font = { bold: true };
  row++;

  worksheet.getCell(`A${row}`).value = 'Generated Date:';
  worksheet.getCell(`B${row}`).value = reportData.generated_date;
  worksheet.getCell(`A${row}`).font = { bold: true };
  row += 2;

  // Subject Details
  worksheet.getCell(`A${row}`).value = 'Subject';
  worksheet.getCell(`B${row}`).value = 'Obtained';
  worksheet.getCell(`C${row}`).value = 'Total';
  worksheet.getCell(`D${row}`).value = '%';
  
  ['A', 'B', 'C', 'D'].forEach(col => {
    worksheet.getCell(`${col}${row}`).font = { bold: true };
    worksheet.getCell(`${col}${row}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a237e' } };
    worksheet.getCell(`${col}${row}`).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  });
  row++;

  reportData.subjects.forEach(subj => {
    worksheet.getCell(`A${row}`).value = subj.subject;
    worksheet.getCell(`B${row}`).value = subj.marks_obtained;
    worksheet.getCell(`C${row}`).value = subj.max_marks;
    worksheet.getCell(`D${row}`).value = subj.percentage;
    row++;
  });

  // Overall Summary
  row += 2;
  worksheet.getCell(`A${row}`).value = 'Overall Performance';
  worksheet.getCell(`A${row}`).font = { bold: true, size: 12 };
  row++;

  worksheet.getCell(`A${row}`).value = 'Total Marks:';
  worksheet.getCell(`B${row}`).value = `${reportData.total_obtained}/${reportData.total_max}`;
  worksheet.getCell(`A${row}`).font = { bold: true };
  row++;

  worksheet.getCell(`A${row}`).value = 'Overall Percentage:';
  worksheet.getCell(`B${row}`).value = `${reportData.overall_percentage}%`;
  worksheet.getCell(`A${row}`).font = { bold: true };
  row++;

  worksheet.getCell(`A${row}`).value = 'Overall Remark:';
  worksheet.getCell(`B${row}`).value = reportData.overall_remark;
  worksheet.getCell(`A${row}`).font = { bold: true };
  worksheet.getCell(`B${row}`).font = { italic: true };

  const buffer = await workbook.xlsx.writeBuffer();
  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="Progress_Report_${reportData.student_id}.xlsx"`
    }
  });
}

async function generatePDF(reportData) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument();
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(new Response(buffer, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="Progress_Report_${reportData.student_id}.pdf"`
          }
        }));
      });

      // Title
      doc.fontSize(20).font('Helvetica-Bold').text('PROGRESS REPORT', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica').text(`Generated on: ${reportData.generated_date}`, { align: 'center' });
      doc.moveDown(1);

      // Student Info
      doc.fontSize(11).font('Helvetica-Bold').text('Student Information', { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica').text(`Name: ${reportData.student_name}`);
      doc.text(`Student ID: ${reportData.student_id}`);
      doc.text(`Class: ${reportData.class_name}-${reportData.section}`);
      doc.moveDown(1);

      // Subject Details Table
      doc.fontSize(11).font('Helvetica-Bold').text('Subject-wise Performance', { underline: true });
      doc.moveDown(0.3);

      // Table header
      doc.fontSize(9).font('Helvetica-Bold');
      doc.rect(50, doc.y, 500, 20).fillAndStroke('#1a237e', '#1a237e');
      
      const columns = [
        { label: 'Subject', x: 60, width: 120 },
        { label: 'Obtained', x: 190, width: 70 },
        { label: 'Total', x: 270, width: 70 },
        { label: '%', x: 350, width: 50 },
        { label: 'Remarks', x: 410, width: 130 }
      ];

      doc.fillColor('white');
      columns.forEach(col => {
        doc.text(col.label, col.x, doc.y + 5, { width: col.width, height: 20 });
      });
      doc.moveDown(1.2);

      // Table rows
      doc.fillColor('black').font('Helvetica');
      reportData.subjects.forEach((subj, idx) => {
        const yPos = doc.y;
        doc.fontSize(9);
        doc.text(subj.subject, 60, yPos, { width: 120 });
        doc.text(subj.marks_obtained.toString(), 190, yPos, { width: 70 });
        doc.text(subj.max_marks.toString(), 270, yPos, { width: 70 });
        doc.text(`${subj.percentage}%`, 350, yPos, { width: 50 });
        doc.text(subj.remark, 410, yPos, { width: 130, height: 30 });
        doc.moveDown(1.5);
      });

      doc.moveDown(0.5);

      // Overall Summary
      doc.fontSize(11).font('Helvetica-Bold').text('Overall Performance Summary', { underline: true });
      doc.moveDown(0.3);
      doc.fontSize(10).font('Helvetica');
      doc.text(`Total Marks Obtained: ${reportData.total_obtained}/${reportData.total_max}`);
      doc.text(`Overall Percentage: ${reportData.overall_percentage}%`);
      doc.moveDown(0.5);
      doc.font('Helvetica-Bold').text('Remark:');
      doc.font('Helvetica-Oblique').text(reportData.overall_remark, { align: 'justified' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}