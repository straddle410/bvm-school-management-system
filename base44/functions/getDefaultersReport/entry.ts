/**
 * Defaulters Report - uses same proven logic as getStudentLedger
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

const VOID_STATUSES = new Set(['VOID', 'CANCELLED']);

function toArray(val) {
  let iterations = 0;
  while (typeof val === 'string' && iterations++ < 3) {
    try { val = JSON.parse(val); } catch { return []; }
  }
  if (Array.isArray(val)) return val;
  if (val && typeof val === 'object') {
    if (val.results !== undefined) return toArray(val.results);
    if (val.data !== undefined) return toArray(val.data);
    if (val.items !== undefined) return toArray(val.items);
    const keys = Object.keys(val);
    if (keys.length > 0 && keys.every(k => !isNaN(k))) return Object.values(val);
  }
  return [];
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const academicYear = body.academicYear || '2025-26';
    const filterClass = body.className || null;
    const filterSection = body.section || null;
    const minDue = parseFloat(body.minDue) || 1;
    const daysSinceMin = (body.daysSinceLastPaymentMin !== undefined && body.daysSinceLastPaymentMin !== '')
      ? parseInt(body.daysSinceLastPaymentMin) : null;
    const followUpStatuses = body.status ? body.status.split(',') : null;
    const search = body.search?.trim().toLowerCase() || null;
    const page = parseInt(body.page) || 1;
    const pageSize = parseInt(body.pageSize) || 50;

    // Paginate payments in batches of 50 to stay under 64KB SDK limit
    const fetchAllPay = async () => {
      let all = [];
      let skip = 0;
      while (true) {
        const bRaw = await base44.asServiceRole.entities.FeePayment.list('-payment_date', 50, skip);
        const b = toArray(bRaw);
        if (b.length === 0) break;
        all = all.concat(b);
        skip += 50;
        if (b.length < 50) break;
      }
      return all;
    };

    const [rawInv, rawStudents, rawFollowUps, rawAcYears, rawPay] = await Promise.all([
      base44.asServiceRole.entities.FeeInvoice.filter({ academic_year: academicYear }),
      base44.asServiceRole.entities.Student.filter({ academic_year: academicYear }, '-created_date', 5000),
      base44.asServiceRole.entities.StudentFollowUp.filter({ academic_year: academicYear }, '-created_date', 5000),
      base44.asServiceRole.entities.AcademicYear.filter({ year: academicYear }),
      fetchAllPay()
    ]);

    const allInvoices = toArray(rawInv);
    const allPayments = rawPay.filter(p => p.academic_year === academicYear);
    const allStudents = toArray(rawStudents);
    const allFollowUps = toArray(rawFollowUps);
    const acYears = toArray(rawAcYears);

    const today = new Date();
    let ayStart;
    if (acYears.length > 0 && acYears[0].start_date) {
      ayStart = new Date(acYears[0].start_date);
    } else {
      const yr = parseInt(academicYear.split('-')[0]);
      ayStart = new Date(yr, 3, 1);
    }

    const studentLookup = {};
    allStudents.forEach(s => { studentLookup[s.student_id] = s; });

    const followUpMap = {};
    allFollowUps.forEach(fu => {
      const prev = followUpMap[fu.student_id];
      if (!prev || fu.created_date > prev.created_date) followUpMap[fu.student_id] = fu;
    });

    // Active invoices
    const activeInvoices = allInvoices.filter(inv => !['Cancelled', 'Waived'].includes(inv.status));

    // Active payments
    const activePayments = allPayments.filter(p => {
      const s = (p.status || '').toUpperCase();
      return !VOID_STATUSES.has(s);
    });

    console.log(`activeInvoices=${activeInvoices.length} activePayments=${activePayments.length}`);

    // Per-student aggregation
    const studentMap = {};
    const ensure = (sid) => {
      if (!studentMap[sid]) studentMap[sid] = { netInvoiced: 0, paidAmount: 0, lastPaymentDate: null };
      return studentMap[sid];
    };

    for (const inv of activeInvoices) {
      if (!inv.student_id) continue;
      ensure(inv.student_id).netInvoiced += inv.total_amount ?? 0;
    }

    for (const p of activePayments) {
      let contribution = p.amount_paid || 0;
      if (p.entry_type !== 'CREDIT_ADJUSTMENT' && contribution < 0) contribution = 0;
      if (contribution === 0) continue;

      const inv = allInvoices.find(i => i.id === p.invoice_id);
      const sid = p.student_id || inv?.student_id;
      if (!sid) continue;

      const row = ensure(sid);
      row.paidAmount += contribution;
      if (p.payment_date && (!row.lastPaymentDate || p.payment_date > row.lastPaymentDate)) {
        row.lastPaymentDate = p.payment_date;
      }
    }

    // Earliest due date
    const dueDateMap = {};
    for (const inv of activeInvoices) {
      if (!inv.student_id || !inv.due_date) continue;
      if (!dueDateMap[inv.student_id] || inv.due_date < dueDateMap[inv.student_id]) {
        dueDateMap[inv.student_id] = inv.due_date;
      }
    }

    const defaulters = [];

    for (const [sid, data] of Object.entries(studentMap)) {
      const due = Math.max(data.netInvoiced - data.paidAmount, 0);
      if (due < minDue) continue;

      const student = studentLookup[sid];
      if (!student) continue;
      if (student.is_deleted === true || student.is_active === false) continue;

      if (filterClass && student.class_name !== filterClass) continue;
      if (filterSection && student.section !== filterSection) continue;

      let daysSince;
      if (data.lastPaymentDate) {
        daysSince = Math.floor((today - new Date(data.lastPaymentDate)) / 86400000);
      } else {
        daysSince = Math.floor((today - ayStart) / 86400000);
      }

      if (daysSinceMin !== null && daysSince < daysSinceMin) continue;

      const latestFU = followUpMap[sid];
      if (followUpStatuses) {
        const fuStatus = latestFU ? latestFU.status : 'NEW';
        if (!followUpStatuses.includes(fuStatus)) continue;
      }

      if (search) {
        const fields = [(student.name || '').toLowerCase(), (student.student_id || '').toLowerCase(), (student.parent_phone || '').toLowerCase()];
        if (!fields.some(f => f.includes(search))) continue;
      }

      defaulters.push({
        student: { id: student.student_id, name: student.name, admissionNo: student.student_id },
        class: { name: student.class_name },
        section: student.section,
        net: data.netInvoiced,
        paid: data.paidAmount,
        due,
        due_date: dueDateMap[sid] || null,
        lastPaymentDate: data.lastPaymentDate,
        daysSinceLastPayment: daysSince,
        phone1: student.parent_phone || null,
        phone2: null,
        latestFollowUp: latestFU ? {
          status: latestFU.status,
          note: latestFU.note,
          next_followup_date: latestFU.next_followup_date,
          updated_at: latestFU.updated_date
        } : null
      });
    }

    defaulters.sort((a, b) => b.due - a.due || b.daysSinceLastPayment - a.daysSinceLastPayment);

    const totalDue = defaulters.reduce((s, d) => s + d.due, 0);
    const countNeverPaid = defaulters.filter(d => !d.lastPaymentDate).length;
    const countNoPayment90 = defaulters.filter(d => d.daysSinceLastPayment >= 90).length;
    const total = defaulters.length;
    const rows = defaulters.slice((page - 1) * pageSize, page * pageSize);

    return Response.json({
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      summary: { countStudents: total, totalDue, avgDue: total > 0 ? Math.round(totalDue / total) : 0, countNeverPaid, countNoPayment90Days: countNoPayment90 },
      rows
    });

  } catch (err) {
    console.error('Error:', err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
});