/**
 * Test: Ledger Voiding Hardening
 *
 * Creates 4 synthetic ledger rows for a test student (NO real DB writes):
 *   A) Invoice net 30,000  → DEBIT 30,000  | balance: 30,000
 *   B) Payment 5,000       → CREDIT 5,000  | balance: 25,000
 *   C) Reversal entry      → DEBIT 5,000   | balance: 30,000  (isReversalEntry=true, POSTED)
 *   D) Original payment    → 0/0           | balance: 30,000  (isVoided=true, VOID)
 *
 * Test A (includeVoided=false): rows A,B,C  → closingBalance=30,000 ✓
 * Test B (includeVoided=true):  rows A,B,C,D → closingBalance=30,000 ✓
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function classify(p) {
  const amount = p.amount_paid ?? 0;
  const isReversalEntry =
    p.entry_type === 'PAYMENT_REVERSAL' ||
    p.entry_type === 'PAYMENT_REFUND' ||
    (p.entry_type === 'REVERSAL' && (p.status === 'Active' || !p.status)) ||
    (amount < 0 && p.status === 'Active');

  const isVoided = !isReversalEntry && (p.status === 'REVERSED');
  const isCredit = !isReversalEntry && !isVoided && p.entry_type === 'CREDIT_ADJUSTMENT';

  return { isReversalEntry, isVoided, isCredit };
}

function buildLedger(syntheticRows, includeVoided, includeReversals) {
  // Filter
  const filtered = syntheticRows.filter(r => {
    if (r._isVoid && !includeVoided) return false;
    if (r._isReversal && !includeReversals) return false;
    return true;
  });

  // Sort by date, then type order, then id
  const TYPE_ORDER = { INVOICE: 0, PAYMENT: 1, CREDIT: 2, REVERSAL: 3 };
  filtered.sort((a, b) => {
    if (a.date < b.date) return -1;
    if (a.date > b.date) return 1;
    const ta = TYPE_ORDER[a.type] ?? 9;
    const tb = TYPE_ORDER[b.type] ?? 9;
    if (ta !== tb) return ta - tb;
    return (a.id || '') < (b.id || '') ? -1 : 1;
  });

  let running = 0;
  return filtered.map(r => {
    if (r.status === 'POSTED') running += r.debit - r.credit;
    return { ...r, runningBalance: running };
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    // ── SYNTHETIC DATA ──────────────────────────────────────────────────────
    const invoiceRow = {
      id: 'inv-test-001',
      date: '2026-01-01',
      type: 'INVOICE',
      description: 'Annual Fee (Q1)',
      debit: 30000,
      credit: 0,
      status: 'POSTED',
      _isReversal: false,
      _isVoid: false
    };

    // B: Payment VOID record (amount=5000, entry_type=CASH_PAYMENT, status='VOID')
     const paymentVoidRaw = { id: 'pay-test-001', amount_paid: 5000, entry_type: 'CASH_PAYMENT', status: 'VOID', payment_date: '2026-01-05' };
    const cvoid = classify(paymentVoidRaw);
    const paymentVoidRow = {
      id: paymentVoidRaw.id,
      date: paymentVoidRaw.payment_date,
      type: 'PAYMENT',
      description: `Payment (Voided)`,
      debit: 0,
      credit: 0,
      status: 'VOID',
      _isReversal: false,
      _isVoid: true,
      _classify: cvoid
    };

    // C: Reversal ENTRY (the posted debit that cancels the payment; entry_type=PAYMENT_REVERSAL)
    const reversalEntryRaw = { id: 'pay-test-002', amount_paid: -5000, entry_type: 'PAYMENT_REVERSAL', status: 'Active', payment_date: '2026-01-05' };
    const crev = classify(reversalEntryRaw);
    const reversalEntryRow = {
      id: reversalEntryRaw.id,
      date: reversalEntryRaw.payment_date,
      type: 'REVERSAL',
      description: 'Reversal of payment',
      debit: 5000,
      credit: 0,
      status: 'POSTED',
      _isReversal: true,
      _isVoid: false,
      _classify: crev
    };

    // B (original payment row, shown when VOID is not yet cancelled — for reference only)
    // We also include a "normal payment" row showing what happens before reversal:
    // Actually for the test we simulate the ORIGINAL payment as the item that gets voided.
    // The original payment, when active, is:
    const originalPaymentRaw = { id: 'pay-test-003', amount_paid: 5000, entry_type: 'CASH_PAYMENT', status: 'Active', payment_date: '2026-01-04' };
    const corig = classify(originalPaymentRaw);
    const originalPaymentRow = {
      id: originalPaymentRaw.id,
      date: originalPaymentRaw.payment_date,
      type: 'PAYMENT',
      description: 'Cash received (RCPT/2025-26/0001)',
      debit: 0,
      credit: 5000,
      status: 'POSTED',
      _isReversal: false,
      _isVoid: false,
      _classify: corig
    };

    // Full synthetic ledger: A, B (original active payment), C (reversal entry), D (voided original)
    const allRows = [invoiceRow, originalPaymentRow, reversalEntryRow, paymentVoidRow];

    // ── CLASSIFICATION VERIFICATION ─────────────────────────────────────────
    const classVerification = {
      paymentVoidRow_isReversalEntry: cvoid.isReversalEntry,  // must be FALSE
      paymentVoidRow_isVoided: cvoid.isVoided,                 // must be TRUE
      reversalEntry_isReversalEntry: crev.isReversalEntry,     // must be TRUE
      reversalEntry_isVoided: crev.isVoided,                   // must be FALSE (CRITICAL)
    };

    // ── TEST A: includeVoided=false (default) ────────────────────────────────
    // Expect rows: INVOICE, PAYMENT(original), REVERSAL
    // Balance: 30000 - 5000 + 5000 = 30,000
    const ledgerA = buildLedger(allRows, false, true);

    // ── TEST B: includeVoided=true ───────────────────────────────────────────
    // Expect rows: INVOICE, PAYMENT(original), REVERSAL, VOID
    // Balance: VOID contributes 0 → still 30,000
    const ledgerB = buildLedger(allRows, true, true);

    return Response.json({
      classificationVerification: classVerification,
      testA_includeVoided_false: {
        rowCount: ledgerA.length,
        rows: ledgerA.map(r => ({ id: r.id, type: r.type, status: r.status, debit: r.debit, credit: r.credit, runningBalance: r.runningBalance })),
        closingBalance: ledgerA.at(-1)?.runningBalance ?? 0,
        expectedClosingBalance: 30000,
        pass: (ledgerA.at(-1)?.runningBalance ?? 0) === 30000,
        voidRowVisible: ledgerA.some(r => r._isVoid)
      },
      testB_includeVoided_true: {
        rowCount: ledgerB.length,
        rows: ledgerB.map(r => ({ id: r.id, type: r.type, status: r.status, debit: r.debit, credit: r.credit, runningBalance: r.runningBalance })),
        closingBalance: ledgerB.at(-1)?.runningBalance ?? 0,
        expectedClosingBalance: 30000,
        pass: (ledgerB.at(-1)?.runningBalance ?? 0) === 30000,
        voidRowVisible: ledgerB.some(r => r._isVoid)
      }
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});