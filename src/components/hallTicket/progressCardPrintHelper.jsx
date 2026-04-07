/**
 * Generates a full A4 print-ready HTML string for a Progress Card.
 * Uses the same ink-efficient grey scheme as hall tickets.
 */
export function buildProgressCardHTML(card, schoolProfile, subjectOrder = [], examMarksConfig = null) {
  const schoolName = schoolProfile?.school_name || 'School';
  const schoolAddress = schoolProfile?.address || '';
  const logoUrl = schoolProfile?.logo_url
    ? `https://images.weserv.nl/?url=${encodeURIComponent(schoolProfile.logo_url)}`
    : '';
  const examName = card.exam_performance?.[0]?.exam_type_name || card.exam_performance?.[0]?.exam_name || 'Exam';
  const rawSubjects = card.exam_performance?.[0]?.subject_details || [];
  const subjects = subjectOrder.length > 0
    ? [...rawSubjects].sort((a, b) => {
        const ai = subjectOrder.indexOf(a.subject);
        const bi = subjectOrder.indexOf(b.subject);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      })
    : rawSubjects;

  // Detect internal/external from actual data first, fall back to config
  const hasInternal = rawSubjects.some(s => s.internal_marks != null) || examMarksConfig?.has_internal_marks || false;
  const maxInternal = examMarksConfig?.max_internal_marks || (hasInternal ? rawSubjects.reduce((m, s) => Math.max(m, s.internal_marks || 0), 0) : 0);
  const maxExternal = examMarksConfig?.max_external_marks || (hasInternal ? rawSubjects.reduce((m, s) => Math.max(m, s.external_marks || 0), 0) : 100);

  const att = card.attendance_summary || {};
  const attPct = parseFloat(att.attendance_percentage || 0);
  const monthlyBreakdown = att.monthly_breakdown || [];

  // Attendance Remark
  let attRemark = '';
  if (attPct < 60) {
    attRemark = 'Attendance is critically low. Immediate and sustained improvement is required to meet the minimum requirement.';
  } else if (attPct < 80) {
    attRemark = 'The student needs to attend classes more regularly to maintain satisfactory academic progress.';
  } else if (attPct >= 95) {
    attRemark = 'Excellent attendance. Keep up the consistent presence throughout the academic year.';
  } else {
    attRemark = 'Attendance is satisfactory. Continued regularity is encouraged.';
  }

  // Academic Remark
  let acaRemark = '';
  const lowSubjects = subjects.filter(s => s.max_marks > 0 && (s.marks_obtained / s.max_marks) * 100 < 70);
  const allExcellent = subjects.length > 0 && subjects.every(s => s.max_marks > 0 && (s.marks_obtained / s.max_marks) * 100 >= 90);
  if (allExcellent) {
    acaRemark = 'Outstanding academic performance across all subjects. The student has demonstrated exceptional dedication and consistency.';
  } else if (lowSubjects.length > 0) {
    const names = lowSubjects.map(s => s.subject).join(', ');
    acaRemark = `The student requires focused improvement in: <strong>${names}</strong>. Additional practice and guidance in these areas is strongly recommended.`;
  } else {
    acaRemark = 'Good academic performance overall. With continued effort, the student has the potential to achieve even greater results.';
  }

  // Totals for subject table
  const totalObtained = subjects.reduce((s, sub) => s + (sub.marks_obtained || 0), 0);
  const totalMax = subjects.reduce((s, sub) => s + (sub.max_marks || 0), 0);

  // Subject rows — dynamic columns based on hasInternal
  const subjectRows = subjects.map((sub, idx) => {
    const internal = sub.internal_marks != null ? sub.internal_marks : '—';
    const external = sub.external_marks != null ? sub.external_marks : '—';
    return `
      <tr style="background:#fff">
        <td style="text-align:center">${idx + 1}</td>
        <td><b>${sub.subject}</b></td>
        ${hasInternal ? `<td style="text-align:center">${internal}</td><td style="text-align:center">${external}</td>` : ''}
        <td style="text-align:center">${sub.marks_obtained ?? '—'} / ${sub.max_marks || '—'}</td>
        <td style="text-align:center;font-weight:700">${sub.grade || '—'}</td>
      </tr>`;
  }).join('');

  const totalRow = subjects.length > 0 ? `
    <tr style="background:#e8e8e8;font-weight:700;-webkit-print-color-adjust:exact;print-color-adjust:exact">
      <td colspan="2" style="text-align:right;padding-right:10px">Total</td>
      ${hasInternal ? '<td style="text-align:center">—</td><td style="text-align:center">—</td>' : ''}
      <td style="text-align:center">${totalObtained} / ${totalMax}</td>
      <td style="text-align:center">${(card.overall_stats?.overall_percentage || 0).toFixed(1)}% (${card.overall_stats?.overall_grade || '—'})</td>
    </tr>` : ''

  // Attendance rows
  let attendanceSection = '';
  if (monthlyBreakdown.length > 0) {
    const attRows = monthlyBreakdown.map(m => `
      <tr>
        <td>${m.month}</td>
        <td style="text-align:center">${m.working_days}</td>
        <td style="text-align:center">${m.present_days}</td>
        <td style="text-align:center">${m.absent_days ?? (m.working_days - m.present_days)}</td>
      </tr>`).join('');
    const totalWorking = monthlyBreakdown.reduce((s, m) => s + (m.working_days || 0), 0);
    const totalPresent = monthlyBreakdown.reduce((s, m) => s + (m.present_days || 0), 0);
    const totalAbsent = totalWorking - totalPresent;
    attendanceSection = `
      <table>
        <thead><tr>
          <th>Month</th>
          <th style="text-align:center">Working Days</th>
          <th style="text-align:center">Present Days</th>
          <th style="text-align:center">Absent Days</th>
        </tr></thead>
        <tbody>
          ${attRows}
          <tr style="background:#e8e8e8;font-weight:700;-webkit-print-color-adjust:exact;print-color-adjust:exact">
            <td>Total</td>
            <td style="text-align:center">${totalWorking}</td>
            <td style="text-align:center">${totalPresent}</td>
            <td style="text-align:center">${totalAbsent}</td>
          </tr>
        </tbody>
      </table>`;
  } else {
    const wd = att.working_days || 0;
    const pd = att.total_present_days || 0;
    const ab = wd - pd;
    attendanceSection = `
      <table>
        <thead><tr>
          <th>Period</th>
          <th style="text-align:center">Working Days</th>
          <th style="text-align:center">Present Days</th>
          <th style="text-align:center">Absent Days</th>
          <th style="text-align:center">Attendance %</th>
        </tr></thead>
        <tbody>
          <tr>
            <td>${att.range_start || ''} – ${att.range_end || ''}</td>
            <td style="text-align:center">${wd}</td>
            <td style="text-align:center">${pd}</td>
            <td style="text-align:center">${ab}</td>
            <td style="text-align:center;font-weight:700">${att.attendance_percentage || 0}%</td>
          </tr>
        </tbody>
      </table>`;
  }

  const photoHtml = card.student_photo_url
    ? `<img src="https://images.weserv.nl/?url=${encodeURIComponent(card.student_photo_url)}" style="width:90px;height:115px;object-fit:cover;border:1.5px solid #333;border-radius:3px;flex-shrink:0" />`
    : `<div style="width:90px;height:115px;background:#eee;border:1.5px solid #333;border-radius:3px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:700;color:#555">${(card.student_name || '?').charAt(0).toUpperCase()}</div>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Progress Card - ${card.student_name}</title>
  <style>
    @page { size: A4; margin: 10mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 14px; color: #111; background: #fff; }

    /* HEADER */
    .header {
      background: #f2f2f2;
      color: #111;
      padding: 16px 20px 14px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      border-bottom: 1.5px solid #333;
      text-align: center;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header-logo { width: 64px; height: 64px; object-fit: contain; border-radius: 3px; flex-shrink: 0; }
    .header-school { font-size: 24px; font-weight: 800; letter-spacing: 0.07em; text-transform: uppercase; color: #111; }
    .header-addr { font-size: 12px; color: #444; margin-top: 4px; letter-spacing: 0.04em; }

    /* BADGE */
    .badge-row {
      background: #e8e8e8;
      color: #111;
      text-align: center;
      font-size: 13px;
      font-weight: 700;
      padding: 6px 0;
      letter-spacing: 0.06em;
      border-bottom: 1.5px solid #333;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* STUDENT INFO */
    .student-row {
      display: flex;
      align-items: flex-start;
      gap: 18px;
      padding: 14px 16px;
      border-bottom: 1.5px solid #333;
      background: #fafafa;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .student-fields { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px 22px; flex: 1; }
    .lbl { font-size: 10px; color: #666; line-height: 1.2; }
    .val { font-size: 14px; font-weight: 700; color: #111; line-height: 1.4; }

    /* SECTION HEADERS */
    .sec-header {
      background: #e8e8e8;
      color: #111;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      padding: 6px 16px;
      border-bottom: 1.5px solid #333;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* TABLES */
    table { border-collapse: collapse; width: 100%; font-size: 12.5px; }
    th {
      background: #e8e8e8;
      color: #111;
      padding: 6px 10px;
      text-align: left;
      font-size: 12px;
      font-weight: 700;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      border: 1.5px solid #333;
    }
    td { border: 1.5px solid #333; padding: 7px 10px; vertical-align: middle; background: #fff; }

    /* REMARKS */
    .remarks-box { border: 1.5px solid #333; border-top: none; padding: 12px 16px; background: #fafafa; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .remark-label { font-size: 10px; font-weight: 700; color: #555; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }
    .remark-text { font-size: 12px; color: #333; line-height: 1.7; }

    /* SIGNATURES */
    .sig-row { display: flex; justify-content: space-between; align-items: flex-end; padding: 10px 36px 8px; border-top: 1.5px solid #333; background: #fafafa; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .sig-block { text-align: center; display: flex; flex-direction: column; align-items: center; }
    .sig-line { border-top: 1.5px solid #333; width: 110px; margin-bottom: 30px; }
    .sig-name { font-size: 12px; font-weight: 700; color: #111; margin-bottom: 2px; }
    .sig-label { font-size: 10px; color: #444; }

    /* FOOTER */
    .footer { text-align: center; border-top: 1.5px solid #333; margin-top: 6px; padding-top: 5px; background: #fafafa; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .footer p { font-size: 10px; color: #666; }

    .table-wrap { padding: 10px 16px; }
  </style>
</head>
<body>
  <div style="border: 2px solid #000; margin: 15px auto; max-width: 850px; border-radius: 4px;">

  <!-- 1. HEADER: centered — logo + school name + address -->
  <div class="header">
    ${logoUrl ? `<img src="${logoUrl}" class="header-logo" />` : ''}
    <div>
      <div class="header-school">${schoolName}</div>
      ${schoolAddress ? `<div class="header-addr">${schoolAddress}</div>` : ''}
    </div>
  </div>

  <!-- BADGE: exam type + Progress Card -->
  <div class="badge-row">${examName.toUpperCase()} PROGRESS CARD</div>

  <!-- 2. STUDENT INFO -->
  <div class="student-row">
    ${photoHtml}
    <div class="student-fields">
      <div><div class="lbl">Student Name</div><div class="val">${card.student_name || '—'}</div></div>
      <div><div class="lbl">Parent / Guardian</div><div class="val">${card.parent_name || '—'}</div></div>
      <div><div class="lbl">Academic Year</div><div class="val">${card.academic_year || '—'}</div></div>
      <div><div class="lbl">Class &amp; Section</div><div class="val">${card.class_name || '—'} – ${card.section || '—'}</div></div>
      <div><div class="lbl">Roll Number</div><div class="val">${card.roll_number || '—'}</div></div>
      <div><div class="lbl">Overall %</div><div class="val">${(card.overall_stats?.overall_percentage || 0).toFixed(1)}%${card.overall_stats?.overall_grade ? ` (${card.overall_stats.overall_grade})` : ''}</div></div>
    </div>
  </div>

  <!-- 3. MARKS TABLE with Total row -->
  <div class="sec-header">Subject-wise Marks</div>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th style="width:5%;text-align:center">S.No</th>
          <th style="width:${hasInternal ? '25%' : '45%'}">Subject</th>
          ${hasInternal ? `<th style="width:15%;text-align:center">Internal (${maxInternal})</th><th style="width:15%;text-align:center">External (${maxExternal})</th>` : ''}
          <th style="width:20%;text-align:center">${hasInternal ? 'Total Marks' : 'Marks'}</th>
          <th style="width:15%;text-align:center">Grade</th>
        </tr>
      </thead>
      <tbody>
        ${subjectRows || '<tr><td colspan="6" style="text-align:center;padding:10px;color:#999;background:#fff">No marks data available</td></tr>'}
        ${totalRow}
      </tbody>
    </table>
  </div>

  <!-- 4. ATTENDANCE SUMMARY -->
  <div class="sec-header" style="margin-top:4px">Attendance Summary</div>
  <div class="table-wrap">
    ${attendanceSection}
  </div>

  <!-- 5. REMARKS -->
  <div class="sec-header" style="margin-top:4px">Remarks</div>
  <div class="remarks-box">
    <div style="display:flex;gap:14px">
      <div style="flex:1;border-right:1.25px solid #ccc;padding-right:12px">
        <div class="remark-label">Attendance Remark</div>
        <div class="remark-text">${attRemark}</div>
      </div>
      <div style="flex:1;padding-left:4px">
        <div class="remark-label">Academic Remark</div>
        <div class="remark-text">${acaRemark}</div>
      </div>
    </div>
    ${card.class_teacher_remarks ? `
      <div style="margin-top:6px;padding-top:5px;border-top:1.25px solid #ccc">
        <div class="remark-label">Class Teacher Remarks</div>
        <div class="remark-text">${card.class_teacher_remarks}</div>
      </div>` : ''}
  </div>

  <!-- 6. SIGNATURES -->
  <div class="sig-row">
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-name">${schoolProfile?.principal_name || 'Principal'}</div>
      <div class="sig-label">Principal</div>
    </div>
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-name">${card.class_teacher_name || 'Class Teacher'}</div>
      <div class="sig-label">Class Teacher</div>
    </div>
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-label">Parent / Guardian Signature</div>
    </div>
  </div>

  <!-- FOOTER -->
  <div class="footer">
    <p>Generated: ${new Date(card.generated_at || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} &nbsp;|&nbsp; This is an official document from the school management system.</p>
  </div>

  </div>
  </div>
</body>
</html>`;
}

export function printProgressCard(card, schoolProfile, subjectOrder = [], examMarksConfig = null) {
  const html = buildProgressCardHTML(card, schoolProfile, subjectOrder, examMarksConfig);
  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 400);
}

export function printMultipleProgressCards(cards, schoolProfile, subjectOrder = [], examMarksConfig = null) {
  if (!cards || cards.length === 0) return;

  const pagesHtml = cards.map((card, i) => {
    const cardHtml = buildProgressCardHTML(card, schoolProfile, subjectOrder, examMarksConfig);
    const bodyMatch = cardHtml.match(/<body>([\s\S]*)<\/body>/);
    const body = bodyMatch ? bodyMatch[1] : '';
    return `<div style="${i < cards.length - 1 ? 'page-break-after:always;' : ''}">${body}</div>`;
  }).join('');

  const firstHtml = buildProgressCardHTML(cards[0], schoolProfile, subjectOrder, examMarksConfig);
  const stylesMatch = firstHtml.match(/<style>([\s\S]*?)<\/style>/);
  const styles = stylesMatch ? stylesMatch[1] : '';

  const combinedHtml = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/><title>Progress Cards Bulk Print</title><style>${styles}</style></head>
<body>${pagesHtml}</body>
</html>`;

  const win = window.open('', '_blank');
  win.document.write(combinedHtml);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 500);
}