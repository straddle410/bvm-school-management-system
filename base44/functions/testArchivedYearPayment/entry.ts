/**
 * TEST CASES FOR ARCHIVED YEAR PAYMENT COLLECTION
 * 
 * Run these in your test suite or manually invoke via backend function testing
 * 
 * Test Framework: Jest / Mocha / Vitest
 * Expected: All tests should PASS after implementation
 */

// ──────────────────────────────────────────────────────────────────
// TEST CASE 1: Archived Year Payment Success
// ──────────────────────────────────────────────────────────────────
describe('Archived Year Payment Collection', () => {
  test('TC1: Should record payment in archived year successfully', async () => {
    // Setup
    const academicYear = '2025-26';
    const studentId = 'S001';
    const invoiceId = 'inv-123'; // Assume exists
    const amountPaid = 3000;
    const paymentDate = '2026-03-06';
    const paymentMode = 'Cash';

    // Execute
    const response = await recordFeePayment({
      invoiceId,
      amountPaid,
      paymentDate,
      paymentMode,
      referenceNo: '',
      remarks: 'Previous year balance collection',
      entryType: 'CASH_PAYMENT'
    });

    // Assertions
    expect(response.success).toBe(true);
    expect(response.receipt_no).toMatch(/^RCPT\/2025-26\/\d{4}$/);
    expect(response.new_status).toMatch(/^(Partial|Paid)$/);
    
    // Verify audit log created
    const auditLogs = await db.query(
      `SELECT * FROM AuditLog WHERE action = 'PREVIOUS_YEAR_COLLECTION' AND student_id = ?`,
      [studentId]
    );
    expect(auditLogs.length).toBeGreaterThan(0);
    expect(auditLogs[0].details).toContain(response.receipt_no);
  });

  // ──────────────────────────────────────────────────────────────────
  // TEST CASE 2: Archived Year Reversal Blocked
  // ──────────────────────────────────────────────────────────────────
  test('TC2: Should block REVERSAL entry in archived year', async () => {
    // Setup: Assume payment already exists in archived year
    const academicYear = '2025-26';
    const invoiceId = 'inv-456';

    // Execute: Try to void/reverse payment
    const response = await recordFeePayment({
      invoiceId,
      amountPaid: 5000, // Reversal amount
      paymentDate: '2026-03-07',
      paymentMode: 'Cash',
      entryType: 'REVERSAL' // This should be blocked
    });

    // Assertions
    expect(response.status).toBe(403); // Forbidden
    expect(response.error).toContain('Cannot apply REVERSAL');
    expect(response.error).toContain('archived academic year');
    
    // Verify no reversal entry created
    const reversals = await db.query(
      `SELECT * FROM FeePayment WHERE entry_type = 'REVERSAL' AND academic_year = ?`,
      [academicYear]
    );
    expect(reversals.length).toBe(0); // No new reversal
  });

  // ──────────────────────────────────────────────────────────────────
  // TEST CASE 3: Current Year Normal Payment Still Works
  // ──────────────────────────────────────────────────────────────────
  test('TC3: Should allow REVERSAL in current (active) year', async () => {
    // Setup: Current year 2026-27 is Active
    const academicYear = '2026-27';
    const invoiceId = 'inv-789';

    // Execute: Record payment first
    let response = await recordFeePayment({
      invoiceId,
      amountPaid: 5000,
      paymentDate: '2026-03-06',
      paymentMode: 'Cash',
      entryType: 'CASH_PAYMENT'
    });
    expect(response.success).toBe(true);
    const receiptNo = response.receipt_no;

    // Now reverse it
    response = await recordFeePayment({
      invoiceId,
      amountPaid: 5000,
      paymentDate: '2026-03-07',
      paymentMode: 'Cash',
      entryType: 'REVERSAL' // Should be ALLOWED in current year
    });

    // Assertions
    expect(response.success).toBe(true);
    
    // Verify REVERSAL entry created
    const reversals = await db.query(
      `SELECT * FROM FeePayment WHERE entry_type = 'REVERSAL' AND academic_year = ?`,
      [academicYear]
    );
    expect(reversals.length).toBeGreaterThan(0);
    
    // Verify NO PREVIOUS_YEAR_COLLECTION audit tag for current year
    const auditLogs = await db.query(
      `SELECT * FROM AuditLog WHERE action = 'PREVIOUS_YEAR_COLLECTION' AND academic_year = ?`,
      [academicYear]
    );
    expect(auditLogs.length).toBe(0); // Should be empty for current year
  });

  // ──────────────────────────────────────────────────────────────────
  // TEST CASE 4: Teacher Cannot Collect Archived Year Payment
  // ──────────────────────────────────────────────────────────────────
  test('TC4: Should block teacher from recording archived year payment', async () => {
    // Setup: Authenticate as teacher (role != admin/principal/accountant)
    const teacherUser = { email: 'teacher@school.com', role: 'teacher' };

    // Execute: Try to record payment
    const response = await recordFeePayment(
      {
        invoiceId: 'inv-999',
        amountPaid: 3000,
        paymentDate: '2026-03-06',
        paymentMode: 'Cash'
      },
      { user: teacherUser } // Simulate teacher context
    );

    // Assertions
    expect(response.status).toBe(403); // Forbidden
    expect(response.error).toContain('Forbidden');
    expect(response.userRole).toBe('teacher');
  });

  // ──────────────────────────────────────────────────────────────────
  // TEST CASE 5: Outstanding Balance Validation
  // ──────────────────────────────────────────────────────────────────
  test('TC5: Should reject payment exceeding outstanding balance', async () => {
    // Setup: Invoice with outstanding ₹20,000
    const invoiceId = 'inv-ov1';
    const outstanding = 20000;

    // Execute: Try to pay ₹25,000
    const response = await recordFeePayment({
      invoiceId,
      amountPaid: 25000, // More than outstanding
      paymentDate: '2026-03-06',
      paymentMode: 'Cash'
    });

    // Assertions
    expect(response.status).toBe(422); // Unprocessable entity
    expect(response.error).toContain('exceeds outstanding balance');
    expect(response.error).toContain(`₹${outstanding}`);
  });

  // ──────────────────────────────────────────────────────────────────
  // TEST CASE 6: Archived Year with No Outstanding Balance
  // ──────────────────────────────────────────────────────────────────
  test('TC6: Should show no outstanding balance for paid invoice in archived year', async () => {
    // Setup: Invoice fully paid (balance = 0)
    const studentId = 'S004';
    const academicYear = '2025-26';
    
    const invoices = await fetchInvoices({ student_id: studentId, academic_year: academicYear });
    const paidInvoice = invoices.find(i => i.status === 'Paid');

    // Assertion
    expect(paidInvoice).toBeDefined();
    expect(paidInvoice.balance).toBe(0);
    expect(paidInvoice.paid_amount).toBe(paidInvoice.total_amount);
  });

  // ──────────────────────────────────────────────────────────────────
  // TEST CASE 7: Audit Trail Completeness
  // ──────────────────────────────────────────────────────────────────
  test('TC7: Should create complete audit trail for archived year payments', async () => {
    // Setup: Record 3 payments in archived year
    const academicYear = '2025-26';
    const payments = [
      { studentId: 'S001', amount: 5000, mode: 'Cash' },
      { studentId: 'S002', amount: 8000, mode: 'Cheque' },
      { studentId: 'S003', amount: 12000, mode: 'Online' }
    ];

    const receipts = [];
    for (const payment of payments) {
      const response = await recordFeePayment({
        invoiceId: payment.invoiceId,
        amountPaid: payment.amount,
        paymentDate: '2026-03-06',
        paymentMode: payment.mode,
        entryType: 'CASH_PAYMENT'
      });
      receipts.push(response.receipt_no);
    }

    // Execute: Query audit log
    const auditLogs = await db.query(
      `SELECT * FROM AuditLog WHERE action = 'PREVIOUS_YEAR_COLLECTION' AND academic_year = ? ORDER BY timestamp`,
      [academicYear]
    );

    // Assertions
    expect(auditLogs.length).toBe(3);
    
    // Verify each log entry
    auditLogs.forEach((log, idx) => {
      expect(log.action).toBe('PREVIOUS_YEAR_COLLECTION');
      expect(log.module).toBe('Fees');
      expect(log.academic_year).toBe(academicYear);
      expect(log.details).toContain(`₹${payments[idx].amount}`);
      expect(log.details).toContain(receipts[idx]);
      expect(log.student_id).toBe(payments[idx].studentId);
      expect(log.timestamp).toBeDefined();
    });
  });

  // ──────────────────────────────────────────────────────────────────
  // TEST CASE 8: Entry Type Field Populated
  // ──────────────────────────────────────────────────────────────────
  test('TC8: Should populate entry_type field correctly', async () => {
    const response = await recordFeePayment({
      invoiceId: 'inv-et1',
      amountPaid: 5000,
      paymentDate: '2026-03-06',
      paymentMode: 'Cash',
      entryType: 'CASH_PAYMENT'
    });

    // Query FeePayment record
    const payment = await db.query(
      `SELECT * FROM FeePayment WHERE receipt_no = ?`,
      [response.receipt_no]
    );

    // Assertions
    expect(payment[0].entry_type).toBe('CASH_PAYMENT');
    expect(payment[0].affects_cash).toBe(true);
  });

  // ──────────────────────────────────────────────────────────────────
  // TEST CASE 9: Receipt Number Generation in Archived Year
  // ──────────────────────────────────────────────────────────────────
  test('TC9: Should generate correct receipt number format for archived year', async () => {
    const academicYear = '2025-26';

    const response = await recordFeePayment({
      invoiceId: 'inv-rcpt1',
      amountPaid: 5000,
      paymentDate: '2026-03-06',
      paymentMode: 'Cash'
    });

    // Assertions
    expect(response.receipt_no).toMatch(/^RCPT\/2025-26\/\d{4}$/);
    expect(response.receipt_no).toBe('RCPT/2025-26/XXXX'); // Where XXXX is incrementing number
  });

  // ──────────────────────────────────────────────────────────────────
  // TEST CASE 10: Credit Adjustment Blocked in Archived Year
  // ──────────────────────────────────────────────────────────────────
  test('TC10: Should block CREDIT_ADJUSTMENT in archived year', async () => {
    const response = await recordFeePayment({
      invoiceId: 'inv-ca1',
      amountPaid: 1000,
      paymentDate: '2026-03-06',
      paymentMode: 'Cash',
      entryType: 'CREDIT_ADJUSTMENT' // Should be blocked
    });

    expect(response.status).toBe(403);
    expect(response.error).toContain('Cannot apply CREDIT_ADJUSTMENT');
    expect(response.error).toContain('archived academic year');
  });
});

/**
 * INTEGRATION TEST: Full Workflow
 */
describe('Archived Year Payment - Full Workflow Integration', () => {
  test('Full workflow: Admin switches to archived year, collects balance, verifies receipt and audit', async () => {
    // 1. Admin switches academic year context to 2025-26
    const context = { academicYear: '2025-26' };

    // 2. Student has outstanding ₹20,000 in 2025-26
    const student = 'S005';
    const invoices = await fetchInvoices({ student_id: student, academic_year: '2025-26' });
    const invoice = invoices[0];
    expect(invoice.status).toBe('Partial');
    expect(invoice.balance).toBeGreaterThan(0);

    // 3. Admin records partial payment ₹12,000
    const paymentResponse = await recordFeePayment({
      invoiceId: invoice.id,
      amountPaid: 12000,
      paymentDate: '2026-03-06',
      paymentMode: 'Cash',
      remarks: 'Previous year collection from parent'
    });
    expect(paymentResponse.success).toBe(true);

    // 4. Verify receipt generated
    expect(paymentResponse.receipt_no).toBeDefined();
    const receipt = await fetchReceipt(paymentResponse.receipt_no);
    expect(receipt).toBeDefined();

    // 5. Verify invoice updated
    const updatedInvoice = await fetchInvoice(invoice.id);
    expect(updatedInvoice.paid_amount).toBe(invoice.paid_amount + 12000);
    expect(updatedInvoice.balance).toBe(invoice.balance - 12000);

    // 6. Verify audit log created
    const auditLog = await db.query(
      `SELECT * FROM AuditLog WHERE action = 'PREVIOUS_YEAR_COLLECTION' AND student_id = ?`,
      [student]
    );
    expect(auditLog.length).toBeGreaterThan(0);
    expect(auditLog[0].details).toContain('₹12000');

    // 7. Verify FeePayment has correct entry_type
    const feePayment = await db.query(
      `SELECT * FROM FeePayment WHERE receipt_no = ?`,
      [paymentResponse.receipt_no]
    );
    expect(feePayment[0].entry_type).toBe('CASH_PAYMENT');
    expect(feePayment[0].affects_cash).toBe(true);

    // 8. Try to void the payment (should fail)
    const voidResponse = await recordFeePayment({
      invoiceId: invoice.id,
      amountPaid: 12000,
      paymentDate: '2026-03-07',
      entryType: 'REVERSAL'
    });
    expect(voidResponse.status).toBe(403);
    expect(voidResponse.error).toContain('Cannot apply REVERSAL');
  });
});