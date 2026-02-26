import JSZip from 'npm:jszip@3.10.1';
import html2pdf from 'npm:html2pdf.js@0.10.1';

Deno.serve(async (req) => {
  try {
    const { progressCards } = await req.json();

    if (!progressCards || progressCards.length === 0) {
      return Response.json({ error: 'No progress cards provided' }, { status: 400 });
    }

    const zip = new JSZip();

    // Generate individual PDFs for each card
    for (const card of progressCards) {
      const fileName = `Class_${card.class_name}_${card.student_name}.pdf`;
      
      // Create HTML content for the progress card (full A4 page)
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; padding: 40px; }
            .container { max-width: 210mm; height: 297mm; margin: 0 auto; }
            .header { background: linear-gradient(135deg, #1a237e 0%, #283593 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
            .header h1 { font-size: 28px; margin-bottom: 10px; }
            .header p { font-size: 14px; opacity: 0.9; }
            .content { background: white; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #ddd; border-top: none; }
            .student-info { margin-bottom: 30px; padding-bottom: 20px; border-bottom: 2px solid #ddd; }
            .student-info h2 { font-size: 24px; color: #1a237e; margin-bottom: 10px; }
            .info-row { display: flex; justify-content: space-between; margin: 8px 0; font-size: 14px; }
            .info-label { color: #666; font-weight: bold; }
            .stats-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin: 20px 0; }
            .stat-box { background: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center; border-left: 4px solid #1a237e; }
            .stat-value { font-size: 32px; font-weight: bold; color: #1a237e; margin: 10px 0; }
            .stat-label { font-size: 12px; color: #666; text-transform: uppercase; }
            .exam-results { margin: 20px 0; }
            .exam-section { margin-bottom: 15px; }
            .exam-title { background: #f0f0f0; padding: 10px; font-weight: bold; color: #1a237e; margin: 10px 0 5px 0; }
            .subject-row { display: flex; justify-content: space-between; padding: 8px; border-bottom: 1px solid #eee; font-size: 13px; }
            .subject-name { flex: 1; }
            .subject-marks { text-align: right; }
            .page-break { page-break-after: always; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Progress Card</h1>
              <p>Academic Report</p>
            </div>
            <div class="content">
              <div class="student-info">
                <h2>${card.student_name}</h2>
                <div class="info-row">
                  <div><span class="info-label">Class:</span> ${card.class_name}</div>
                  <div><span class="info-label">Section:</span> ${card.section}</div>
                  <div><span class="info-label">Roll Number:</span> ${card.roll_number}</div>
                </div>
              </div>

              <div class="stats-grid">
                <div class="stat-box">
                  <div class="stat-label">Overall Percentage</div>
                  <div class="stat-value">${(card.overall_stats?.overall_percentage || 0).toFixed(1)}%</div>
                </div>
                <div class="stat-box">
                  <div class="stat-label">Overall Grade</div>
                  <div class="stat-value">${card.overall_stats?.overall_grade || '-'}</div>
                </div>
                <div class="stat-box">
                  <div class="stat-label">Overall Rank</div>
                  <div class="stat-value">#${card.overall_stats?.overall_rank || '-'}</div>
                </div>
              </div>

              <div class="exam-results">
                <h3 style="color: #1a237e; margin: 20px 0 10px 0;">Exam Results</h3>
                ${
                  card.exam_stats && Object.entries(card.exam_stats).map(([examName, stats]) => `
                    <div class="exam-section">
                      <div class="exam-title">${examName} (${stats.percentage?.toFixed(1) || 0}%)</div>
                      ${
                        stats.subject_marks && Object.entries(stats.subject_marks).map(([subject, marks]) => `
                          <div class="subject-row">
                            <span class="subject-name">${subject}</span>
                            <span class="subject-marks">${marks.obtained}/${marks.max}</span>
                          </div>
                        `).join('')
                      }
                    </div>
                  `).join('')
                }
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      // Convert HTML to PDF buffer
      const pdfBuffer = await new Promise((resolve, reject) => {
        html2pdf(htmlContent, {
          margin: 0,
          filename: fileName,
          html2canvas: { scale: 2 },
          jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' }
        }).then((doc) => {
          resolve(Buffer.from(doc.output('arraybuffer')));
        }).catch(reject);
      });

      zip.file(fileName, pdfBuffer);
    }

    const zipData = await zip.generateAsync({ type: 'uint8array' });
    const zipBase64 = Buffer.from(zipData).toString('base64');

    return Response.json({
      success: true,
      zipData: zipBase64,
      message: `${progressCards.length} progress cards packaged into ZIP`
    });
  } catch (error) {
    console.error('Error generating ZIP:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});