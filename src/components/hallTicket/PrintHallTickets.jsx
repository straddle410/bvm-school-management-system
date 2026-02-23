// Utility to generate and print hall tickets in bulk (3 per A4 sheet)
// Each ticket is always exactly 1/3 of an A4 page, regardless of count.
export function printHallTickets(tickets, timetableMap, schoolProfile, examTypesMap) {
  const win = window.open('', '_blank');

  const ticketHTML = tickets.map(ticket => {
    const timetable = timetableMap[ticket.id] || [];
    const examName = examTypesMap[ticket.exam_type] || ticket.exam_type;
    const photoUrl = ticket.student_photo_url || '';
    const MAX_ROWS = 9;
    const rowH = Math.floor(100 / MAX_ROWS);
    const rows = timetable.map((entry, idx) => `
      <tr style="background:${idx % 2 === 0 ? '#f0f4ff' : '#fff'}; height:${rowH}%">
        <td>${entry.exam_date ? new Date(entry.exam_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
        <td>${entry.day || '—'}</td>
        <td><b>${entry.subject_name}</b></td>
        <td>${entry.start_time} – ${entry.end_time}</td>
        <td></td>
      </tr>`).join('');

    return `
    <div class="ticket-slot">
      <div class="ticket">
        <div class="header">
          ${schoolProfile?.logo_url ? `<img src="${schoolProfile.logo_url}" class="logo"/>` : ''}
          <div class="header-text">
            <h2>${schoolProfile?.school_name || 'School'}</h2>
            ${schoolProfile?.address ? `<p>${schoolProfile.address}</p>` : ''}
          </div>
          ${schoolProfile?.logo_url ? `<img src="${schoolProfile.logo_url}" class="logo" style="visibility:hidden"/>` : ''}
        </div>
        <div class="badge-row">HALL TICKET — ${examName}</div>
        <div class="body-row">
          <div class="student-col">
            <div class="photo-wrap">
              ${photoUrl ? `<img src="${photoUrl}" class="photo"/>` : '<div class="no-photo">No Photo</div>'}
            </div>
            <div class="fields">
              <div class="field-item"><div class="lbl">Student Name</div><div class="val">${ticket.student_name}</div></div>
              <div class="field-item"><div class="lbl">Hall Ticket No.</div><div class="val ht">${ticket.hall_ticket_number}</div></div>
              <div class="field-item"><div class="lbl">Class &amp; Section</div><div class="val">${ticket.class_name} – ${ticket.section}</div></div>
              <div class="field-item"><div class="lbl">Roll No.</div><div class="val">${ticket.roll_number || '—'}</div></div>
              <div class="field-item"><div class="lbl">Academic Year</div><div class="val">${ticket.academic_year}</div></div>
            </div>
          </div>
          <div class="schedule-col">
            <div class="sec-title">Exam Schedule</div>
            ${timetable.length > 0 ? `
            <table style="height:100%; table-layout:fixed;">
              <thead><tr>
                <th style="width:22%">Date</th>
                <th style="width:13%">Day</th>
                <th style="width:28%">Subject</th>
                <th style="width:20%">Time</th>
                <th style="width:17%">Invigilator Sign</th>
              </tr></thead>
              <tbody>${rows}</tbody>
            </table>` : '<p style="color:#999;font-size:9px;padding:3px 0;">Timetable not yet assigned.</p>'}
          </div>
        </div>
        <div class="footer-row">
          <div class="instr">
            <b>Important Instructions:</b>
            <ul>
              <li>Carry this hall ticket to every exam.</li>
              <li>Report 15 minutes before the exam starts.</li>
              <li>Electronic devices are not permitted in the exam hall.</li>
              <li>Hall ticket must be produced on demand by the invigilator.</li>
            </ul>
          </div>
          <div class="sig ao-sig"><div class="sig-line"></div>AO Signature</div>
          <div class="sig"><div class="sig-line"></div>Principal Signature</div>
        </div>
      </div>
    </div>`;
  });

  // Pad to multiple of 3 with empty slots so layout stays fixed
  const padded = [...ticketHTML];
  while (padded.length % 3 !== 0) {
    padded.push(`<div class="ticket-slot ticket-slot-empty"></div>`);
  }

  // Group into pages of 3
  const pages = [];
  for (let i = 0; i < padded.length; i += 3) {
    pages.push(padded.slice(i, i + 3));
  }
  const pagesHTML = pages.map((group, pi) => `
    <div class="page${pi < pages.length - 1 ? ' page-break' : ''}">
      ${group.join('')}
    </div>`).join('');

  win.document.write(`<!DOCTYPE html><html><head><title>Hall Tickets</title>
  <style>
    @page { size: A4 portrait; margin: 4mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 10px; background: white; }

    /* Each page is exactly A4, split into 3 equal rows */
    .page { width: 202mm; height: 289mm; display: flex; flex-direction: column; }
    .page-break { page-break-after: always; }

    /* Each slot is always exactly 1/3 of A4 height */
    .ticket-slot { height: calc(289mm / 3); display: flex; flex-direction: column; padding: 1.2mm 0; }
    .ticket-slot:first-child { padding-top: 0; }
    .ticket-slot:nth-child(3) { padding-bottom: 0; }
    .ticket-slot-empty .ticket { visibility: hidden; }
    .ticket { flex: 1; display: flex; flex-direction: column; border: 1.5px solid #1a237e; border-radius: 3px; overflow: hidden; }

    /* HEADER */
    .header { background: #1a237e; color: white; padding: 5px 8px 4px; -webkit-print-color-adjust: exact; print-color-adjust: exact; display: flex; align-items: center; justify-content: space-between; gap: 6px; }
    .header-text { text-align: center; flex: 1; }
    .header h2 { font-size: 13px; font-weight: bold; letter-spacing: 0.07em; text-transform: uppercase; }
    .header p { font-size: 9px; color: #c5cae9; margin-top: 2px; }
    .logo { height: 34px; width: 34px; object-fit: contain; border-radius: 3px; flex-shrink: 0; }

    /* BADGE */
    .badge-row { background: #e8eaf6; color: #1a237e; text-align: center; font-size: 10px; font-weight: 700; padding: 2px 0; letter-spacing: 0.05em; border-bottom: 1px solid #c5cae9; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

    /* BODY */
    .body-row { display: flex; flex: 1; min-height: 0; }

    /* STUDENT COL */
    .student-col { display: flex; flex-direction: column; padding: 5px 6px; border-right: 1px solid #ddd; width: 52mm; flex-shrink: 0; gap: 5px; }
    .photo-wrap { display: flex; justify-content: center; }
    .photo { width: 60px; height: 75px; object-fit: cover; border: 1.5px solid #1a237e; border-radius: 3px; }
    .no-photo { width: 60px; height: 75px; background: #eee; border: 1.5px solid #ccc; border-radius: 3px; display: flex; align-items: center; justify-content: center; font-size: 8px; color: #999; text-align: center; }
    .fields { display: flex; flex-direction: column; justify-content: space-between; flex: 1; }
    .field-item { line-height: 1; }
    .lbl { font-size: 7.5px; color: #888; line-height: 1.1; }
    .val { font-size: 10px; font-weight: 700; color: #222; line-height: 1.3; }
    .val.ht { color: #1a237e; font-size: 11px; }

    /* SCHEDULE COL */
    .schedule-col { flex: 1; padding: 4px 5px; display: flex; flex-direction: column; }
    .sec-title { font-size: 10px; font-weight: 700; color: #1a237e; margin-bottom: 3px; text-transform: uppercase; letter-spacing: 0.04em; }
    table { border-collapse: collapse; width: 100%; font-size: 9px; flex: 1; }
    table tbody { display: table-row-group; }
    th { background: #1a237e; color: white; padding: 3px 4px; text-align: left; font-size: 9px; -webkit-print-color-adjust: exact; print-color-adjust: exact; border: 1px solid #3949ab; }
    td { border: 1px solid #ddd; padding: 1px 4px; font-size: 9px; vertical-align: middle; }

    /* FOOTER */
    .footer-row { display: flex; align-items: flex-end; gap: 6px; padding: 4px 6px 5px; border-top: 1px solid #ddd; background: #fafafa; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .instr { flex: 1; }
    .instr b { font-size: 8px; color: #92400e; display: block; margin-bottom: 2px; }
    .instr ul { padding-left: 12px; }
    .instr li { font-size: 7.5px; color: #555; line-height: 1.5; }
    .sigs { display: flex; gap: 14px; flex-shrink: 0; align-self: flex-end; }
    .sig { text-align: center; font-size: 8px; color: #444; font-weight: 600; }
    .sig-line { border-top: 1px solid #666; width: 62px; margin: 16px auto 2px; }
  </style></head><body>${pagesHTML}</body></html>`);

  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 600);
}