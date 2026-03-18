import PDFDocument from 'npm:pdfkit@0.13.0';

Deno.serve(async (req) => {
  try {
    const { marks, className, section, examType, subject } = await req.json();

    if (!marks || marks.length === 0) {
      return Response.json({ error: 'No marks data provided' }, { status: 400 });
    }

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument();
        const chunks = [];

        doc.on('data', chunk => chunks.push(new Uint8Array(chunk)));
        doc.on('end', () => {
          const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
          const buffer = new Uint8Array(totalLength);
          let offset = 0;
          for (const chunk of chunks) {
            buffer.set(chunk, offset);
            offset += chunk.length;
          }
          resolve(new Response(buffer, {
            headers: {
              'Content-Type': 'application/pdf',
              'Content-Disposition': `attachment; filename="Marks_${className}_${section}_${examType}.pdf"`
            }
          }));
        });

        // Title
        doc.fontSize(18).font('Helvetica-Bold').text('MARKS REPORT', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(12).font('Helvetica-Bold').text(`${className}-${section} | ${subject} | ${examType}`, { align: 'center' });
        doc.moveDown(1);

        // Header info
        doc.fontSize(10).font('Helvetica');
        doc.text(`Class: ${className}-${section}`);
        doc.text(`Subject: ${subject}`);
        doc.text(`Exam Type: ${examType}`);
        doc.text(`Total Students: ${marks.length}`);
        
        const totalMarks = marks.reduce((sum, m) => sum + m.marks_obtained, 0);
        const maxMarks = marks.length > 0 ? marks[0].max_marks * marks.length : 0;
        const avgPercentage = maxMarks > 0 ? Math.round((totalMarks / maxMarks) * 100) : 0;
        doc.text(`Class Average: ${avgPercentage}%`);
        doc.moveDown(1);

        // Table header
        doc.fontSize(9).font('Helvetica-Bold');
        doc.rect(50, doc.y, 500, 20).fillAndStroke('#1a237e', '#1a237e');
        
        const columns = [
          { label: 'Student Name', x: 60, width: 200 },
          { label: 'Student ID', x: 270, width: 80 },
          { label: 'Marks', x: 360, width: 70 },
          { label: 'Grade', x: 440, width: 60 }
        ];

        doc.fillColor('white');
        columns.forEach(col => {
          doc.text(col.label, col.x, doc.y + 5, { width: col.width, height: 20 });
        });
        doc.moveDown(1.2);

        // Table rows
        doc.fillColor('black').font('Helvetica');
        marks.forEach((mark) => {
          const yPos = doc.y;
          doc.fontSize(9);
          doc.text(mark.student_name, 60, yPos, { width: 200 });
          doc.text(mark.student_id, 270, yPos, { width: 80 });
          doc.text(`${mark.marks_obtained}/${mark.max_marks}`, 360, yPos, { width: 70 });
          doc.text(mark.grade, 440, yPos, { width: 60 });
          doc.moveDown(1);
        });

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  } catch (error) {
    console.error('PDF Export Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});