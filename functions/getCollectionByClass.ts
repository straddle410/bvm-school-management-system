/**
 * Collection Summary by Class Report
 *
 * VOID-ONLY POLICY:
 *   - VOID/CANCELLED payments are NEVER counted in totals.
 *   - includeVoided=true shows them for audit only (voidedReceiptsCount/voidedAmount).
 *
 * Body params:
 *   dateFrom       (required YYYY-MM-DD)
 *   dateTo         (required YYYY-MM-DD)
 *   academicYear   (optional)
 *   className      (optional — filter to single class)
 *   mode           (optional — string or array of payment modes)
 *   includeVoided  (default false)
 *   reportMode     "summary" | "details" | "export" (default "summary")
 *   classId        (alias for className in details mode)
 *   page / pageSize
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

const VOID_STATUSES = new Set(['VOID', 'CANCELLED']);

function isVoidPayment(p) {
  return VOID_STATUSES.has((p.status || '').toUpperCase());
}

function isValidPayment(p) {
  if (isVoidPayment(p)) return false;
  if (p.entry_type === 'CREDIT_ADJUSTMENT') return false;
  if ((p.amount_paid ?? 0) <= 0) return false;
  return true;
}

const CLASS_ORDER = ['Nursery', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];

function classSort(a, b) {
  const ai = CLASS_ORDER.indexOf(a);
  const bi = CLASS_ORDER.indexOf(b);
  if (ai === -1 && bi === -1) return a.localeCompare(b);
  if (ai === -1) return 1;
  if (bi === -1) return -1;
  return ai - bi;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    
    // Check if user is authenticated (staff session or Base44 auth)
    const baseUser = await base44.auth.me().catch(() => null);
    const staffInfo = body.staffInfo;
    
    if (!baseUser && !staffInfo?.staff_id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allowedRoles = ['admin', 'principal', 'accountant'];
    // Extract effective role with normalization
    const user = baseUser || { role: staffInfo?.role };
    const candidates = [
      user?.role,
      user?.roleName,
      user?.user_metadata?.role,
      user?.app_metadata?.role
    ].filter(v => v !== null && v !== undefined && v !== '');
    const userRole = String(candidates[0] || '').trim().toLowerCase();
    
    if (!allowedRoles.includes(userRole)) {
      console.log(`[RBAC-BLOCK] role="${userRole}" not in ${JSON.stringify(allowedRoles)}`);
      return Response.json({ error: 'Forbidden', userRole, allowedRoles }, { status: 403 });
    }

    const {
      dateFrom,
      dateTo,
      academicYear,
      className,
      classId,       // alias
      mode: filterMode,
      includeVoided = false,
      reportMode = 'summary',
      page = 1,
      pageSize = 200,
    } = body;

    const targetClass = className || classId || null;
    const showVoided = !!includeVoided;

    if (!dateFrom || !dateTo) {
      return Response.json({ error: 'dateFrom and dateTo are required' }, { status: 400 });
    }

    const modeFilter = filterMode
      ? (Array.isArray(filterMode) ? filterMode : [filterMode]).map(m => m.toUpperCase())
      : null;

    // ── Fetch payments + invoices in parallel ───────────────────────────────
    const invoiceFilter = academicYear ? { academic_year: academicYear } : {};
    const [payments_raw, invoices_raw] = await Promise.all([
      base44.asServiceRole.entities.FeePayment.filter(
        academicYear ? { academic_year: academicYear } : {}
      ),
      base44.asServiceRole.entities.FeeInvoice.filter(invoiceFilter),
    ]);
    let payments = payments_raw;

    // Build class → invoiced net map (exclude Cancelled/Waived)
    const EXCLUDED_INVOICE_STATUSES = new Set(['Cancelled', 'Waived']);
    const classInvoicedNet = {};
    for (const inv of invoices_raw) {
      if (EXCLUDED_INVOICE_STATUSES.has(inv.status)) continue;
      const cls = inv.class_name || 'Unknown';
      classInvoicedNet[cls] = (classInvoicedNet[cls] || 0) + (inv.total_amount ?? 0);
    }

    // Date filter
    payments = payments.filter(p => {
      const d = p.payment_date || (p.created_date || '').split('T')[0];
      return d && d >= dateFrom && d <= dateTo;
    });

    // Mode filter
    if (modeFilter && modeFilter.length > 0) {
      payments = payments.filter(p => modeFilter.includes((p.payment_mode || 'CASH').toUpperCase()));
    }

    // Class filter
    if (targetClass) {
      payments = payments.filter(p => p.class_name === targetClass);
    }

    // Separate valid vs voided
    const validPayments = payments.filter(isValidPayment);
    const voidedPayments = payments.filter(p => isVoidPayment(p));

    // ── DETAILS MODE ─────────────────────────────────────────────────────────
    if (reportMode === 'details') {
      if (!targetClass) {
        return Response.json({ error: 'className/classId required for details mode' }, { status: 400 });
      }

      const rows = [];
      for (const p of validPayments) {
        rows.push({
          postedAt: p.payment_date || (p.created_date || '').split('T')[0],
          receiptNo: p.receipt_no || '',
          student: { id: p.student_id || '', name: p.student_name || '' },
          mode: p.payment_mode || 'Cash',
          amount: p.amount_paid ?? 0,
          status: 'POSTED',
          isVoided: false,
        });
      }
      if (showVoided) {
        for (const p of voidedPayments) {
          rows.push({
            postedAt: p.payment_date || (p.created_date || '').split('T')[0],
            receiptNo: p.receipt_no || '',
            student: { id: p.student_id || '', name: p.student_name || '' },
            mode: p.payment_mode || 'Cash',
            amount: p.amount_paid ?? 0,
            status: (p.status || 'VOID').toUpperCase(),
            isVoided: true,
          });
        }
      }

      rows.sort((a, b) => b.postedAt.localeCompare(a.postedAt));

      const total = rows.length;
      const start = (page - 1) * pageSize;
      const paged = rows.slice(start, start + pageSize);

      return Response.json({
        meta: { classId: targetClass, page, pageSize, totalRows: total },
        class: { id: targetClass, name: targetClass },
        rows: paged,
      });
    }

    // ── SUMMARY MODE ─────────────────────────────────────────────────────────
    // Group valid payments by class
    const classMap = {};

    for (const p of validPayments) {
      const cls = p.class_name || 'Unknown';
      if (!classMap[cls]) classMap[cls] = { validPayments: [], voidedPayments: [] };
      classMap[cls].validPayments.push(p);
    }
    if (showVoided) {
      for (const p of voidedPayments) {
        const cls = p.class_name || 'Unknown';
        if (!classMap[cls]) classMap[cls] = { validPayments: [], voidedPayments: [] };
        classMap[cls].voidedPayments.push(p);
      }
    }

    const rows = Object.entries(classMap).map(([cls, data]) => {
      const collected = data.validPayments.reduce((s, p) => s + (p.amount_paid ?? 0), 0);
      const uniqueStudents = new Set(data.validPayments.map(p => p.student_id).filter(Boolean));
      const voidedAmt = data.voidedPayments.reduce((s, p) => s + Math.abs(p.amount_paid ?? 0), 0);
      const totalInvoicedNet = classInvoicedNet[cls] || 0;
      const coveragePercent = totalInvoicedNet > 0 ? (collected / totalInvoicedNet) * 100 : 0;
      return {
        class: { id: cls, name: cls },
        collectedAmount: collected,
        receiptsCount: data.validPayments.length,
        studentsPaidCount: uniqueStudents.size,
        voidedReceiptsCount: data.voidedPayments.length,
        voidedAmount: voidedAmt,
        totalInvoicedNet,
        coveragePercent,
      };
    });

    rows.sort((a, b) => classSort(a.class.name, b.class.name));

    const totalCollected = rows.reduce((s, r) => s + r.collectedAmount, 0);
    const totalReceipts = rows.reduce((s, r) => s + r.receiptsCount, 0);
    const totalInvoicedNetAllClasses = rows.reduce((s, r) => s + r.totalInvoicedNet, 0);
    const overallCoveragePercent = totalInvoicedNetAllClasses > 0
      ? (totalCollected / totalInvoicedNetAllClasses) * 100
      : 0;

    // ── EXPORT MODE ──────────────────────────────────────────────────────────
    if (reportMode === 'export') {
      const headers = ['Class', 'Invoiced Net (₹)', 'Collected (₹)', 'Coverage %', 'Receipts', 'Students Paid', 'Voided Receipts', 'Voided Amount (₹)'];
      const csvRows = rows.map(r => [
        r.class.name,
        r.totalInvoicedNet.toFixed(2),
        r.collectedAmount.toFixed(2),
        r.coveragePercent.toFixed(1) + '%',
        r.receiptsCount,
        r.studentsPaidCount,
        r.voidedReceiptsCount,
        r.voidedAmount.toFixed(2),
      ]);
      const csvLines = [
        headers.join(','),
        ...csvRows.map(row => row.join(',')),
        '',
        `Total,${totalInvoicedNetAllClasses.toFixed(2)},${totalCollected.toFixed(2)},${overallCoveragePercent.toFixed(1)}%,${totalReceipts}`,
      ];
      return new Response(csvLines.join('\n'), {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename=collection-by-class-${dateFrom}-to-${dateTo}.csv`,
        },
      });
    }

    return Response.json({
      meta: { dateFrom, dateTo, academicYear: academicYear || null },
      summary: {
        totalCollected,
        totalReceipts,
        classesCount: rows.length,
        totalInvoicedNetAllClasses,
        overallCoveragePercent,
        voidedAmount: showVoided ? rows.reduce((s, r) => s + r.voidedAmount, 0) : undefined,
      },
      rows,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});