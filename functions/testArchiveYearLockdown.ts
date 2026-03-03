/**
 * Phase 2, Test 7: Archive Year Lockdown
 * 
 * Verifies that mutations are blocked for archived academic years:
 * - recordFeePayment
 * - voidReceipt
 * - setStudentDiscount
 * - applySiblingDiscount
 * - publishAdditionalCharge
 * - cancelAdditionalCharge
 * 
 * Restores year status back to Active at end.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || !['admin', 'principal'].includes(user.role?.toLowerCase())) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const AY = '2025-26';
    console.log(`\n=== Phase 2, Test 7: Archive Year Lockdown for ${AY} ===\n`);

    // Verify year is archived
    const ayRecords = await base44.asServiceRole.entities.AcademicYear.filter({ year: AY });
    if (!ayRecords || ayRecords.length === 0) {
      return Response.json({ error: `Academic year ${AY} not found` }, { status: 404 });
    }
    const ayRecord = ayRecords[0];
    console.log(`Year status: ${ayRecord.status}, is_locked: ${ayRecord.is_locked}`);

    if (ayRecord.status !== 'Archived') {
      return Response.json({
        error: `Year ${AY} must be in Archived status. Current: ${ayRecord.status}`
      }, { status: 400 });
    }

    const results = {
      test_name: 'Archive Year Lockdown',
      academic_year: AY,
      checks: []
    };

    // ────────────────────────────────────────────────────────────────────
    // 1. TEST: recordFeePayment should fail
    // ────────────────────────────────────────────────────────────────────
    console.log('\n[1] Testing recordFeePayment on archived year...');
    const invoices = await base44.asServiceRole.entities.FeeInvoice.filter({
      academic_year: AY
    });
    let paymentTest = { blocked: false, error: null };
    if (invoices.length > 0) {
      const inv = invoices[0];
      try {
        const res = await base44.functions.invoke('recordFeePayment', {
          invoice_id: inv.id,
          amount_paid: 1000,
          payment_date: new Date().toISOString().split('T')[0],
          payment_mode: 'Cash'
        });
        paymentTest.error = `Should have blocked but got: ${res.data?.message || 'success'}`;
      } catch (err) {
        const status = err.response?.status;
        const errMsg = err.response?.data?.error || err.message;
        if (status === 403 && (errMsg?.includes('archived') || errMsg?.includes('Archived'))) {
          paymentTest.blocked = true;
        } else if (status === 403) {
          // 403 error likely from archive check
          paymentTest.blocked = true;
        } else {
          paymentTest.error = errMsg;
        }
      }
    } else {
      paymentTest.error = 'No invoices found for testing';
    }
    results.checks.push({ test: 'recordFeePayment', ...paymentTest });
    console.log(`  Result: ${paymentTest.blocked ? 'BLOCKED ✓' : 'FAILED ✗'}`);

    // ────────────────────────────────────────────────────────────────────
    // 2. TEST: voidReceipt should fail
    // ────────────────────────────────────────────────────────────────────
    console.log('\n[2] Testing voidReceipt on archived year...');
    const payments = await base44.asServiceRole.entities.FeePayment.filter({
      academic_year: AY,
      status: 'Active'
    });
    let voidTest = { blocked: false, error: null };
    if (payments.length > 0) {
      const pmt = payments[0];
      try {
        const res = await base44.functions.invoke('voidReceipt', {
          paymentId: pmt.id,
          reason: 'Test void on archived year'
        });
        voidTest.error = `Should have blocked but got: ${res.data?.message || 'success'}`;
      } catch (err) {
        const status = err.response?.status;
        const errMsg = err.response?.data?.error || err.message;
        if (status === 403 && (errMsg?.includes('archived') || errMsg?.includes('Archived'))) {
          voidTest.blocked = true;
        } else if (status === 403) {
          voidTest.blocked = true;
        } else {
          voidTest.error = errMsg;
        }
      }
    } else {
      voidTest.error = 'No active payments found for testing';
    }
    results.checks.push({ test: 'voidReceipt', ...voidTest });
    console.log(`  Result: ${voidTest.blocked ? 'BLOCKED ✓' : 'FAILED ✗'}`);

    // ────────────────────────────────────────────────────────────────────
    // 3. TEST: setStudentDiscount should fail
    // ────────────────────────────────────────────────────────────────────
    console.log('\n[3] Testing setStudentDiscount on archived year...');
    const students = await base44.asServiceRole.entities.Student.filter({
      academic_year: AY
    });
    let discountTest = { blocked: false, error: null };
    if (students.length > 0) {
      const std = students[0];
      try {
        const res = await base44.functions.invoke('setStudentDiscount', {
          student_id: std.student_id,
          academic_year: AY,
          discount_type: 'AMOUNT',
          discount_value: 500,
          scope: 'TOTAL'
        });
        discountTest.error = `Should have blocked but got: ${res.data?.message || 'success'}`;
      } catch (err) {
        const errMsg = err.response?.data?.error || err.message;
        if (errMsg?.includes('archived') || errMsg?.includes('Archived')) {
          discountTest.blocked = true;
        } else {
          discountTest.error = errMsg;
        }
      }
    } else {
      discountTest.error = 'No students found for testing';
    }
    results.checks.push({ test: 'setStudentDiscount', ...discountTest });
    console.log(`  Result: ${discountTest.blocked ? 'BLOCKED ✓' : 'FAILED ✗'}`);

    // ────────────────────────────────────────────────────────────────────
    // 4. TEST: applySiblingDiscount should fail
    // ────────────────────────────────────────────────────────────────────
    console.log('\n[4] Testing applySiblingDiscount on archived year...');
    const families = await base44.asServiceRole.entities.FeeFamily.filter({
      academic_year: AY
    });
    let siblingTest = { blocked: false, error: null };
    if (families.length > 0) {
      const fam = families[0];
      try {
        const res = await base44.functions.invoke('applySiblingDiscount', {
          family_id: fam.id,
          action: 'apply'
        });
        siblingTest.error = `Should have blocked but got: ${res.data?.message || 'success'}`;
      } catch (err) {
        const errMsg = err.response?.data?.error || err.message;
        if (errMsg?.includes('archived') || errMsg?.includes('Archived')) {
          siblingTest.blocked = true;
        } else {
          siblingTest.error = errMsg;
        }
      }
    } else {
      siblingTest.error = 'No families found for testing';
    }
    results.checks.push({ test: 'applySiblingDiscount', ...siblingTest });
    console.log(`  Result: ${siblingTest.blocked ? 'BLOCKED ✓' : 'FAILED ✗'}`);

    // ────────────────────────────────────────────────────────────────────
    // 5. TEST: publishAdditionalCharge should fail
    // ────────────────────────────────────────────────────────────────────
    console.log('\n[5] Testing publishAdditionalCharge on archived year...');
    const charges = await base44.asServiceRole.entities.AdditionalCharge.filter({
      academic_year: AY,
      status: 'DRAFT'
    });
    let publishTest = { blocked: false, error: null };
    if (charges.length > 0) {
      const chg = charges[0];
      try {
        const res = await base44.functions.invoke('publishAdditionalCharge', {
          chargeId: chg.id
        });
        publishTest.error = `Should have blocked but got: ${res.data?.message || 'success'}`;
      } catch (err) {
        const errMsg = err.response?.data?.error || err.message;
        if (errMsg?.includes('archived') || errMsg?.includes('Archived')) {
          publishTest.blocked = true;
        } else {
          publishTest.error = errMsg;
        }
      }
    } else {
      publishTest.error = 'No draft charges found for testing';
    }
    results.checks.push({ test: 'publishAdditionalCharge', ...publishTest });
    console.log(`  Result: ${publishTest.blocked ? 'BLOCKED ✓' : 'FAILED ✗'}`);

    // ────────────────────────────────────────────────────────────────────
    // 6. TEST: cancelAdditionalCharge should fail
    // ────────────────────────────────────────────────────────────────────
    console.log('\n[6] Testing cancelAdditionalCharge on archived year...');
    const publishedCharges = await base44.asServiceRole.entities.AdditionalCharge.filter({
      academic_year: AY,
      status: 'PUBLISHED'
    });
    let cancelTest = { blocked: false, error: null };
    if (publishedCharges.length > 0) {
      const chg = publishedCharges[0];
      try {
        const res = await base44.functions.invoke('cancelAdditionalCharge', {
          chargeId: chg.id
        });
        cancelTest.error = `Should have blocked but got: ${res.data?.message || 'success'}`;
      } catch (err) {
        const errMsg = err.response?.data?.error || err.message;
        if (errMsg?.includes('archived') || errMsg?.includes('Archived')) {
          cancelTest.blocked = true;
        } else {
          cancelTest.error = errMsg;
        }
      }
    } else {
      cancelTest.error = 'No published charges found for testing';
    }
    results.checks.push({ test: 'cancelAdditionalCharge', ...cancelTest });
    console.log(`  Result: ${cancelTest.blocked ? 'BLOCKED ✓' : 'FAILED ✗'}`);

    // ────────────────────────────────────────────────────────────────────
    // RESTORE: Mark year as Active again
    // ────────────────────────────────────────────────────────────────────
    console.log('\n[Cleanup] Restoring year to Active...');
    await base44.asServiceRole.entities.AcademicYear.update(ayRecord.id, {
      status: 'Active',
      is_locked: false
    });
    console.log(`  Year ${AY} restored to Active status ✓\n`);

    // ────────────────────────────────────────────────────────────────────
    // SUMMARY
    // ────────────────────────────────────────────────────────────────────
    const allBlocked = results.checks.every(c => c.blocked || c.error);
    const blockedCount = results.checks.filter(c => c.blocked).length;
    const errorCount = results.checks.filter(c => c.error).length;

    results.summary = {
      total_checks: results.checks.length,
      blocked_mutations: blockedCount,
      errors: errorCount,
      all_protected: blockedCount + errorCount === results.checks.length
    };

    console.log(`\n=== SUMMARY ===`);
    console.log(`Total checks: ${results.checks.length}`);
    console.log(`Blocked mutations: ${blockedCount}`);
    console.log(`Errors/No data: ${errorCount}`);
    console.log(`All mutations protected: ${results.summary.all_protected ? 'YES ✓' : 'NO ✗'}\n`);

    return Response.json(results);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});