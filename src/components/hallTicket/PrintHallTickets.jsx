// Utility to generate and print hall tickets in bulk (3 per A4 sheet)
export function printHallTickets(tickets, timetableMap, schoolProfile, examTypesMap) {
  const win = window.open('', '_blank');

  const ticketHTML = tickets.map(ticket => {
    const timetable = timetableMap[ticket.id] || [];
    const examName = examTypesMap[ticket.exam_type] || ticket.exam_type;
    const photoUrl = ticket.student_photo_url || '';
    const rows = timetable.map((entry, idx) => `
      <tr style="background:${idx % 2 === 0 ? '#f9f9f9' : '#fff'}">
        <td>${entry.exam_date ? new Date(entry.exam_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</td>
        <td>${entry.day || '—'}</td>
        <td><b>${entry.subject_name}</b></td>
        <td>${entry.start_time} – ${entry.end_time}</td>
        <td>${entry.room_number || '—'}</td>
      </tr>`).join('');

    return `
    <div class="ticket">
      <div class="header">
        ${schoolProfile?.logo_url ? `<img src="${schoolProfile.logo_url}" class="logo"/>` : ''}
        <div class="header-text">
          <h2>${schoolProfile?.school_name || 'School'}</h2>
          ${schoolProfile?.address ? `<p>${schoolProfile.address}</p>` : ''}
          <div class="badge">HALL TICKET — ${examName}</div>
        </div>
      </div>
      <div class="body-row">
        <div class="student-col">
          ${photoUrl ? `<img src="${photoUrl}" class="photo"/>` : '<div class="no-photo">No Photo</div>'}
          <div class="fields">
            <div><div class="lbl">Student Name</div><div class="val">${ticket.student_name}</div></div>
            <div><div class="lbl">Hall Ticket No.</div><div class="val ht">${ticket.hall_ticket_number}</div></div>
            <div><div class="lbl">Class &amp; Section</div><div class="val">${ticket.class_name} – ${ticket.section}</div></div>
            <div><div class="lbl">Roll No.</div><div class="val">${ticket.roll_number || '—'}</div></div>
            <div><div class="lbl">Academic Year</div><div class="val">${ticket.academic_year}</div></div>
          </div>
        </div>
        <div class="schedule-col">
          <div class="sec-title">Exam Schedule</div>
          ${timetable.length > 0 ? `
          <table><thead><tr><th>Date</th><th>Day</th><th>Subject</th><th>Time</th><th>Room</th></tr></thead>
          <tbody>${rows}</tbody></table>` : '<p style="color:#999;font-size:7px;padding:3px 0;">Timetable not yet assigned.</p>'}
        </div>
      </div>
      <div class="instr-sigs">
        <div class="instr">
          <b>Important Instructions:</b>
          <ul style="padding-left:10px">
            <li>Carry this hall ticket to every exam.</li>
            <li>Report 15 minutes before the exam starts.</li>
            <li>Electronic devices are not permitted in the exam hall.</li>
            <li>Hall ticket must be produced on demand by the invigilator.</li>
          </ul>
        </div>
        <div class="sigs">
          <div class="sig"><div class="sig-line"></div>Student Signature</div>
          <div class="sig"><div class="sig-line"></div>Principal Signature</div>
        </div>
      </div>
    </div>`;
  });

  // Group into pages of 3
  const pages = [];
  for (let i = 0; i < ticketHTML.length; i += 3) {
    pages.push(ticketHTML.slice(i, i + 3));
  }
  const pagesHTML = pages.map((group, pi) => `
    <div class="page${pi < pages.length - 1 ? ' page-break' : ''}">
      ${group.join('<div class="gap"></div>')}
    </div>`).join('');

  win.document.write(`<!DOCTYPE html><html><head><title>Hall Tickets</title>
  <style>
    @page { size: A4 portrait; margin: 4mm 4mm 4mm 4mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 9px; background: white; }
    .page { width: 202mm; display: flex; flex-direction: column; }
    .page-break { page-break-after: always; }
    .gap { height: 4mm; background: white; }
    .ticket { width: 100%; border-left: 1px solid #bbb; border-right: 1px solid #bbb; }
    .ticket:first-child { border-top: 1px solid #bbb; }
    .ticket:last-child { border-bottom: 1px solid #bbb; }
    .header { background: #1a237e; color: white; text-align: center; padding: 4px 4px 3px; -webkit-print-color-adjust: exact; print-color-adjust: exact; display: flex; align-items: center; gap: 6px; justify-content: center; }
    .header-text { text-align: center; }
    .header h2 { font-size: 10px; font-weight: bold; letter-spacing: 0.06em; text-transform: uppercase; }
    .header p { font-size: 7px; color: #c5cae9; margin-top: 1px; }
    .badge { display: inline-block; background: rgba(255,255,255,0.18); border-radius: 3px; padding: 1px 7px; font-size: 8px; font-weight: 600; margin-top: 2px; }
    .logo { height: 28px; width: 28px; object-fit: contain; border-radius: 3px; flex-shrink: 0; }
    .body-row { display: flex; gap: 0; }
    .student-col { display: flex; gap: 6px; padding: 4px 6px; border-right: 1px solid #eee; align-items: flex-start; width: 52mm; flex-shrink: 0; border-bottom: 1px solid #eee; }
    .photo { width: 38px; height: 48px; object-fit: cover; border: 1px solid #ccc; border-radius: 2px; flex-shrink: 0; }
    .no-photo { width: 38px; height: 48px; background: #eee; border: 1px solid #ccc; border-radius: 2px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 6px; color: #999; text-align: center; }
    .fields { display: grid; grid-template-columns: 1fr; gap: 2px; flex: 1; }
    .lbl { font-size: 6px; color: #888; line-height: 1; }
    .val { font-size: 8px; font-weight: 700; color: #222; line-height: 1.2; }
    .val.ht { color: #1a237e; font-size: 9px; }
    .schedule-col { flex: 1; padding: 4px 5px; border-bottom: 1px solid #eee; }
    .sec-title { font-size: 8px; font-weight: 700; color: #333; margin-bottom: 2px; }
    table { border-collapse: collapse; width: 100%; font-size: 7px; }
    th { background: #1a237e; color: white; padding: 2px 3px; text-align: left; -webkit-print-color-adjust: exact; print-color-adjust: exact; border: 1px solid #3949ab; }
    td { border: 1px solid #ccc; padding: 1px 3px; }
    .instr-sigs { display: flex; gap: 4px; padding: 3px 6px; align-items: flex-start; }
    .instr { flex: 1; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 2px; padding: 2px 4px; }
    .instr b { font-size: 6px; color: #92400e; display: block; margin-bottom: 1px; }
    .instr li { font-size: 6px; color: #78350f; line-height: 1.4; }
    .sigs { display: flex; gap: 10px; flex-shrink: 0; align-items: flex-end; padding-bottom: 2px; }
    .sig { text-align: center; font-size: 6px; color: #666; }
    .sig-line { border-top: 1px solid #999; width: 55px; margin: 12px auto 2px; }
  </style></head><body>${pagesHTML}</body></html>`);

  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 500);
}