/**
 * Daily Closing Summary Endpoint
 * Returns payment collections for a specific date, with breakdown by mode.
 * Matches Day Book logic exactly: VOID/CANCELLED never counted in totals.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const staffInfo = body.staffInfo;
    
    // Check if user is authenticated (staff session from body for mobile, or Base44 auth for web)
    if (!staffInfo?.staff_id) {
      const base44 = createClientFromRequest(req);
      const baseUser = await base44.auth.me().catch(() => null);
      if (!baseUser) {
        return Response.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const userRole = (baseUser?.role || staffInfo?.role || '').toLowerCase();
    const allowedRoles = ['admin', 'principal', 'accountant'];
    if (!allowedRoles.includes(userRole)) {
      return Response.json({ error: 'Forbidden: Only Admin/Principal/Accountant can access' }, { status: 403 });
    }

    // Parse request
    let date, includeVoided;
    
    if (req.method === 'POST') {
      const body = await req.json();
      date = body.date;
      includeVoided = body.includeVoided === true || body.includeVoided === 'true';
    } else {
      const params = new URL(req.url).searchParams;
      date = params.get('date');
      includeVoided = params.get('includeVoided') === 'true';
    }

    if (!date) {
      return Response.json({ error: 'date parameter required (YYYY-MM-DD)' }, { status: 400 });
    }

    // Fetch all payments for the date
    const allPayments = await base44.asServiceRole.entities.FeePayment.filter({
      payment_date: date
    });

    // Separate valid and voided payments
    const validPayments = allPayments.filter(p => p.status !== 'VOID' && p.status !== 'CANCELLED' && p.amount_paid > 0);
    const voidedPayments = allPayments.filter(p => (p.status === 'VOID' || p.status === 'CANCELLED') && p.amount_paid > 0);

    // Calculate totals (valid only)
    let totalCollected = 0;
    let totalReceipts = 0;
    let totalVoidedAmount = 0;
    let totalVoidedCount = 0;

    validPayments.forEach(p => {
      totalCollected += p.amount_paid || 0;
      totalReceipts += 1;
    });

    voidedPayments.forEach(p => {
      totalVoidedAmount += p.amount_paid || 0;
      totalVoidedCount += 1;
    });

    // Breakdown by mode (valid only)
    const modeMap = {};
    validPayments.forEach(p => {
      const mode = p.payment_mode || 'Cash';
      if (!modeMap[mode]) {
        modeMap[mode] = { mode, collected: 0, receiptCount: 0 };
      }
      modeMap[mode].collected += p.amount_paid || 0;
      modeMap[mode].receiptCount += 1;
    });

    const byMode = Object.values(modeMap).sort((a, b) => b.collected - a.collected);

    // Build receipts list (valid + voided if included)
    const receiptsToShow = includeVoided ? [...validPayments, ...voidedPayments] : validPayments;

    const receipts = receiptsToShow.map(p => ({
      receiptNo: p.receipt_no,
      studentName: p.student_name,
      className: p.class_name,
      mode: p.payment_mode || 'Cash',
      amount: p.amount_paid,
      status: p.status
    })).sort((a, b) => {
      // Valid first, then voided; within each group sort by amount desc
      if (a.status === b.status) {
        return b.amount - a.amount;
      }
      return a.status === 'VOID' ? 1 : -1;
    });

    return Response.json({
      date: date,
      totals: {
        totalCollected: totalCollected,
        totalReceipts: totalReceipts,
        totalVoidedAmount: totalVoidedAmount,
        totalVoidedCount: totalVoidedCount
      },
      byMode: byMode,
      receipts: receipts
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});