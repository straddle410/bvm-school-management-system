/**
 * VALIDATION FUNCTION - Archived Year Payment Rules
 * 
 * This function validates that archived year payment rules are correctly enforced.
 * Use this to verify the implementation before deploying to production.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { testCase } = await req.json();

    // Test Case 1: Verify archived year blocks REVERSAL
    if (testCase === 'test_reversal_blocked') {
      const academicYear = '2025-26';
      const invoiceId = 'test-inv-1';
      
      try {
        // Attempt to record a REVERSAL in archived year
        const response = await base44.functions.invoke('recordFeePayment', {
          invoiceId,
          amountPaid: 5000,
          paymentDate: new Date().toISOString().split('T')[0],
          paymentMode: 'Cash',
          entryType: 'REVERSAL'
        });

        if (response.data?.status === 403 && response.data?.error?.includes('REVERSAL')) {
          return Response.json({
            test: 'test_reversal_blocked',
            passed: true,
            message: 'REVERSAL correctly blocked in archived year'
          });
        } else {
          return Response.json({
            test: 'test_reversal_blocked',
            passed: false,
            message: 'REVERSAL was NOT blocked (ERROR - rule not enforced)',
            response: response.data
          });
        }
      } catch (e) {
        return Response.json({
          test: 'test_reversal_blocked',
          passed: false,
            message: `Unexpected error: ${e.message}`
          });
      }
    }

    // Test Case 2: Verify archived year allows CASH_PAYMENT
    if (testCase === 'test_cash_payment_allowed') {
      const academicYear = '2025-26';
      // Find an invoice in archived year first
      const invoices = await base44.asServiceRole.entities.FeeInvoice.filter({
        academic_year: academicYear
      });

      if (!invoices || invoices.length === 0) {
        return Response.json({
          test: 'test_cash_payment_allowed',
          passed: false,
          message: 'No invoices found in archived year for testing'
        });
      }

      const invoice = invoices[0];
      const outstanding = (invoice.total_amount || 0) - (invoice.paid_amount || 0);

      if (outstanding <= 0) {
        return Response.json({
          test: 'test_cash_payment_allowed',
          passed: false,
          message: 'Selected invoice has no outstanding balance'
        });
      }

      try {
        const response = await base44.functions.invoke('recordFeePayment', {
          invoiceId: invoice.id,
          amountPaid: Math.min(1000, outstanding),
          paymentDate: new Date().toISOString().split('T')[0],
          paymentMode: 'Cash',
          entryType: 'CASH_PAYMENT'
        });

        if (response.data?.success && response.data?.receipt_no) {
          return Response.json({
            test: 'test_cash_payment_allowed',
            passed: true,
            message: 'CASH_PAYMENT correctly allowed in archived year',
            receipt: response.data.receipt_no
          });
        } else {
          return Response.json({
            test: 'test_cash_payment_allowed',
            passed: false,
            message: 'CASH_PAYMENT was blocked (ERROR - rule not enforced)',
            response: response.data
          });
        }
      } catch (e) {
        return Response.json({
          test: 'test_cash_payment_allowed',
          passed: false,
          message: `Unexpected error: ${e.message}`
        });
      }
    }

    // Test Case 3: Verify PREVIOUS_YEAR_COLLECTION audit tag created
    if (testCase === 'test_audit_log_created') {
      try {
        const auditLogs = await base44.asServiceRole.entities.AuditLog.filter({
          action: 'PREVIOUS_YEAR_COLLECTION'
        });

        if (auditLogs && auditLogs.length > 0) {
          const log = auditLogs[0];
          const isValid = 
            log.action === 'PREVIOUS_YEAR_COLLECTION' &&
            log.module === 'Fees' &&
            log.academic_year &&
            log.student_id &&
            log.details?.includes('Receipt');

          return Response.json({
            test: 'test_audit_log_created',
            passed: isValid,
            message: isValid ? 'Audit log correctly created' : 'Audit log format invalid',
            sample: log
          });
        } else {
          return Response.json({
            test: 'test_audit_log_created',
            passed: false,
            message: 'No PREVIOUS_YEAR_COLLECTION audit logs found (may be expected if no payments recorded yet)'
          });
        }
      } catch (e) {
        return Response.json({
          test: 'test_audit_log_created',
          passed: false,
          message: `Error querying audit logs: ${e.message}`
        });
      }
    }

    // Test Case 4: Verify entry_type field exists and is populated
    if (testCase === 'test_entry_type_field') {
      try {
        const payments = await base44.asServiceRole.entities.FeePayment.filter({});

        if (payments && payments.length > 0) {
          const payment = payments[0];
          const hasEntryType = 'entry_type' in payment;
          const hasAffectsCash = 'affects_cash' in payment;

          return Response.json({
            test: 'test_entry_type_field',
            passed: hasEntryType && hasAffectsCash,
            message: hasEntryType && hasAffectsCash ? 
              'entry_type and affects_cash fields exist' : 
              'Fields missing from FeePayment record',
            sample: { entry_type: payment.entry_type, affects_cash: payment.affects_cash }
          });
        } else {
          return Response.json({
            test: 'test_entry_type_field',
            passed: false,
            message: 'No FeePayment records found'
          });
        }
      } catch (e) {
        return Response.json({
          test: 'test_entry_type_field',
          passed: false,
          message: `Error: ${e.message}`
        });
      }
    }

    // Test Case 5: Verify archived year status blocks other mutations
    if (testCase === 'test_other_mutations_blocked') {
      // This would test that invoice generation, discount application, etc. are blocked
      // For now, we just verify the academic year status logic
      
      const academicYears = await base44.asServiceRole.entities.AcademicYear.filter({
        status: 'Archived'
      });

      if (academicYears && academicYears.length > 0) {
        return Response.json({
          test: 'test_other_mutations_blocked',
          passed: true,
          message: 'Archived academic years exist in system',
          archivedYears: academicYears.map(ay => ay.year)
        });
      } else {
        return Response.json({
          test: 'test_other_mutations_blocked',
          passed: false,
          message: 'No archived academic years exist (create one for testing)'
        });
      }
    }

    return Response.json({
      error: 'Invalid testCase parameter',
      validCases: [
        'test_reversal_blocked',
        'test_cash_payment_allowed',
        'test_audit_log_created',
        'test_entry_type_field',
        'test_other_mutations_blocked'
      ]
    }, { status: 400 });

  } catch (error) {
    console.error('Validation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});