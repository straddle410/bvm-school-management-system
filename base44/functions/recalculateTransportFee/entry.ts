import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      studentIds = [],
      academicYear = '2025-26',
      previewOnly = false,
      voidAdjustments = false
    } = body;

    if (!studentIds.length) {
      return Response.json({ error: 'studentIds required' }, { status: 400 });
    }

    // Get config
    const [schoolProfile] = await Promise.all([
      base44.asServiceRole.entities.SchoolProfile.list().then(r => r[0] || {})
    ]);

    // Fetch transport routes and stops for route-based fee calculation
    const [routes, stops] = await Promise.all([
      base44.asServiceRole.entities.TransportRoute.list(),
      base44.asServiceRole.entities.TransportStop.list()
    ]);
    const routeMap = Object.fromEntries(routes.map(r => [r.id, r]));
    const stopMap = Object.fromEntries(stops.map(s => [s.id, s]));

    const getAnnualFee = (student) => {
      // New route-based system
      if (student.transport_route_id) {
        const route = routeMap[student.transport_route_id];
        if (!route) return 0;
        if (route.fee_type === 'yearly') return route.fixed_yearly_fee || 0;
        if (route.fee_type === 'monthly') return (route.fixed_monthly_fee || 0) * 12;
        if (route.fee_type === 'stop_based') {
          const stop = student.transport_stop_id ? stopMap[student.transport_stop_id] : null;
          return stop?.fee_amount || 0;
        }
      }
      // Fallback: legacy transport_enabled with school profile fixed fee
      if (student.transport_enabled) {
        return schoolProfile.transport_fee_amount || 0;
      }
      return 0;
    };

    // Fetch all related data
    const [students, invoices, payments] = await Promise.all([
      base44.asServiceRole.entities.Student.filter({ student_id: { $in: studentIds }, academic_year: academicYear }),
      base44.asServiceRole.entities.FeeInvoice.filter({ student_id: { $in: studentIds }, academic_year: academicYear, invoice_type: 'ANNUAL' }),
      base44.asServiceRole.entities.FeePayment.filter({ student_id: { $in: studentIds }, academic_year: academicYear })
    ]);

    const studentMap = Object.fromEntries(students.map(s => [s.student_id, s]));
    const invoicesByStudent = {};
    invoices.forEach(inv => {
      if (!invoicesByStudent[inv.student_id]) invoicesByStudent[inv.student_id] = [];
      invoicesByStudent[inv.student_id].push(inv);
    });

    const paymentsByInvoice = {};
    payments.forEach(p => {
      if (!paymentsByInvoice[p.invoice_id]) paymentsByInvoice[p.invoice_id] = [];
      paymentsByInvoice[p.invoice_id].push(p);
    });

    const results = [];

    for (const studentId of studentIds) {
      const student = studentMap[studentId];
      if (!student) {
        results.push({ student_id: studentId, status: 'SKIP', reason: 'Student not found' });
        continue;
      }

      const invoiceList = invoicesByStudent[studentId] || [];
      if (!invoiceList.length) {
        results.push({ student_id: studentId, status: 'SKIP', reason: 'No invoices found' });
        continue;
      }

      const invoice = invoiceList[0];
      const feeHeads = invoice.fee_heads || [];
      const targetTransportAmt = getAnnualFee(student);
      const transportEnabled = targetTransportAmt > 0 || student.transport_route_id || student.transport_enabled;

      // Calculate existing transport from fee_heads
      const existingTransportLine = feeHeads.find(fh => fh.fee_head_id === 'transport' || fh.fee_head_name === 'Transport');
      const existingTransportAmt = existingTransportLine ? (existingTransportLine.amount || 0) : 0;

      // Calculate deltas
      const delta = targetTransportAmt - existingTransportAmt;
      const oldTotal = invoice.gross_total || 0;
      const newTotal = Math.max(oldTotal + delta, 0);

      // Check if already correct
      if (delta === 0 && !voidAdjustments) {
        results.push({
          student_id: studentId,
          student_name: student.name,
          invoice_id: invoice.id,
          status: 'NO_CHANGE',
          reason: transportEnabled
            ? `Transport already applied (₹${existingTransportAmt.toLocaleString()})`
            : 'No transport on invoice, transport_enabled=false — nothing to do',
          old_total: oldTotal,
          new_total: oldTotal,
          transport_enabled: transportEnabled,
          existing_transport_amount: existingTransportAmt,
          target_transport_amount: targetTransportAmt
        });
        continue;
      }

      const action = delta > 0 ? 'ADD_TRANSPORT' : 'REMOVE_TRANSPORT';

      const preview = {
        student_id: studentId,
        student_name: student.name,
        invoice_id: invoice.id,
        action,
        transport_enabled: transportEnabled,
        existing_transport_amount: existingTransportAmt,
        target_transport_amount: targetTransportAmt,
        delta,
        old_total: oldTotal,
        new_total: newTotal
      };

      if (previewOnly) {
        results.push({ ...preview, status: 'PREVIEW' });
        continue;
      }

      // ── EXECUTE: Always update fee_heads directly (locked or unlocked) ──
      try {
        let updatedFeeHeads;
        if (transportEnabled) {
          if (existingTransportLine) {
            // Update existing transport line
            updatedFeeHeads = feeHeads.map(fh =>
              (fh.fee_head_id === 'transport' || fh.fee_head_name === 'Transport') && !fh.is_hostel
                ? { ...fh, amount: targetTransportAmt, gross_amount: targetTransportAmt, net_amount: targetTransportAmt, discount_amount: 0 }
                : fh
            );
          } else {
            // Add transport line
            updatedFeeHeads = [
              ...feeHeads,
              { fee_head_name: 'Transport', fee_head_id: 'transport', amount: targetTransportAmt, gross_amount: targetTransportAmt, net_amount: targetTransportAmt, discount_amount: 0 }
            ];
          }
        } else {
          // Remove transport line
          updatedFeeHeads = feeHeads.filter(fh => (fh.fee_head_id !== 'transport' && fh.fee_head_name !== 'Transport') || fh.is_hostel);
        }

        const newGross = updatedFeeHeads.reduce((s, fh) => s + (fh.amount || 0), 0);
        const discountTotal = invoice.discount_total || 0;
        const newNet = Math.max(newGross - discountTotal, 0);
        const paidSoFar = invoice.paid_amount || 0;
        const newBalance = Math.max(newNet - paidSoFar, 0);

        await base44.asServiceRole.entities.FeeInvoice.update(invoice.id, {
          fee_heads: updatedFeeHeads,
          gross_total: newGross,
          total_amount: newNet,
          balance: newBalance
        });

        results.push({ ...preview, status: 'DONE' });
      } catch (execErr) {
        results.push({ ...preview, status: 'ERROR', error: execErr.message });
      }
    }

    const summary = {
      total: results.length,
      done: results.filter(r => r.status === 'DONE').length,
      no_change: results.filter(r => r.status === 'NO_CHANGE').length,
      skipped: results.filter(r => r.status === 'SKIP').length,
      errors: results.filter(r => r.status === 'ERROR').length,
      transport_fee_amount: undefined
    };

    return Response.json({ success: true, previewOnly, summary, results });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});