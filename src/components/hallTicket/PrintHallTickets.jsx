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
        <h2>${schoolProfile?.school_name || 'School'}</h2>
        ${schoolProfile?.address ? `<p>${schoolProfile.address}</p>` : ''}
        <div class="badge">HALL TICKET — ${examName}</div>
      </div>
      <div class="student-row">
        ${photoUrl ? `<img src="${photoUrl}" class="photo"/>` : '<div class="no-photo">No Photo</div>'}
        <div class="fields">
          <div><div class="lbl">Student Name</div><div class="val">${ticket.student_name}</div></div>
          <div><div class="lbl">Hall Ticket No.</div><div class="val ht">${ticket.hall_ticket_number}</div></div>
          <div><div class="lbl">Class &amp; Section</div><div class="val">${ticket.class_name} – ${ticket.section}</div></div>
          <div><div class="lbl">Roll Number</div><div class="val">${ticket.roll_number || '—'}</div></div>
          <div><div class="lbl">Academic Year</div><div class="val">${ticket.academic_year}</div></div>
          <div><div class="lbl">Status</div><div class="val">${ticket.status}</div></div>
        </div>
      </div>
      <div class="sec">
        <div class="sec-title">📅 Exam Schedule</div>
        ${timetable.length > 0 ? `
        <table><thead><tr><th>Date</th><th>Day</th><th>Subject</th><th>Time</th><th>Room</th></tr></thead>
        <tbody>${rows}</tbody></table>` : '<p style="color:#999;font-size:8px;padding:4px 0;">Timetable not yet assigned.</p>'}
      </div>
      <div class="instr">
        <b>Important Instructions:</b>
        <ul style="padding-left:11px">
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
    </div>`;
  }).join('');

  win.document.write(`<!DOCTYPE html><html><head><title>Hall Tickets</title>
  <style>
    @page { size: A5; margin: 3mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 10px; background: white; }
    .ticket { width: 148mm; page-break-after: always; border: 1px solid #bbb; }
    .ticket:last-child { page-break-after: auto; }
    .header { background: #1a237e; color: white; text-align: center; padding: 6px 4px 5px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .header h2 { font-size: 12px; font-weight: bold; letter-spacing: 0.07em; text-transform: uppercase; }
    .header p { font-size: 8px; color: #c5cae9; margin-top: 1px; }
    .badge { display: inline-block; background: rgba(255,255,255,0.18); border-radius: 3px; padding: 2px 8px; font-size: 9px; font-weight: 600; margin-top: 3px; }
    .logo { height: 32px; width: 32px; object-fit: contain; border-radius: 3px; margin: 0 auto 3px; display: block; }
    .student-row { display: flex; gap: 8px; padding: 5px 7px; border-bottom: 1px solid #ddd; align-items: flex-start; }
    .photo { width: 46px; height: 58px; object-fit: cover; border: 1px solid #ccc; border-radius: 3px; flex-shrink: 0; }
    .no-photo { width: 46px; height: 58px; background: #eee; border: 1px solid #ccc; border-radius: 3px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-size: 7px; color: #999; text-align: center; }
    .fields { display: grid; grid-template-columns: 1fr 1fr; gap: 3px 10px; flex: 1; }
    .lbl { font-size: 7px; color: #888; }
    .val { font-size: 9px; font-weight: 700; color: #222; }
    .val.ht { color: #1a237e; font-size: 11px; }
    .sec { padding: 4px 7px; }
    .sec-title { font-size: 9px; font-weight: 700; color: #333; margin-bottom: 2px; }
    table { border-collapse: collapse; width: 100%; font-size: 8px; }
    th { background: #1a237e; color: white; padding: 2px 4px; text-align: left; -webkit-print-color-adjust: exact; print-color-adjust: exact; border: 1px solid #3949ab; }
    td { border: 1px solid #ccc; padding: 2px 4px; }
    .instr { margin: 3px 7px; background: #fffbeb; border: 1px solid #fcd34d; border-radius: 3px; padding: 3px 5px; }
    .instr b { font-size: 7px; color: #92400e; display: block; margin-bottom: 1px; }
    .instr li { font-size: 7px; color: #78350f; line-height: 1.5; }
    .sigs { display: flex; justify-content: space-between; padding: 4px 16px 3px; }
    .sig { text-align: center; font-size: 7px; color: #666; }
    .sig-line { border-top: 1px solid #999; width: 65px; margin: 14px auto 2px; }
  </style></head><body>${ticketHTML}</body></html>`);

  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 500);
}