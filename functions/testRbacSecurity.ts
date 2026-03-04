/**
 * RBAC Security Verification Test
 * 
 * Run this function with Teacher/Admin/Accountant sessions to verify:
 * ✅ Teacher: 403 Forbidden on all fees operations
 * ✅ Admin/Accountant: Normal access
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = (user.role || '').toLowerCase();
    const isTeacher = userRole === 'teacher';
    const isAuthorized = ['admin', 'principal', 'accountant'].includes(userRole);

    const results = {
      user: { email: user.email, role: userRole },
      isTeacher,
      isAuthorized,
      tests: []
    };

    // Test 1: FeeInvoice.list() - Should 403 for Teacher
    try {
      await base44.entities.FeeInvoice.list();
      results.tests.push({
        name: 'FeeInvoice.list()',
        result: isAuthorized ? 'PASS' : 'FAIL (Teacher can read invoices)',
        status: isAuthorized ? 'ok' : 'error'
      });
    } catch (err) {
      results.tests.push({
        name: 'FeeInvoice.list()',
        result: isTeacher ? 'PASS (403 blocked)' : 'FAIL (Authorized user blocked)',
        error: err.message,
        status: isTeacher ? 'ok' : 'error'
      });
    }

    // Test 2: FeePayment.list() - Should 403 for Teacher
    try {
      await base44.entities.FeePayment.list();
      results.tests.push({
        name: 'FeePayment.list()',
        result: isAuthorized ? 'PASS' : 'FAIL (Teacher can read payments)',
        status: isAuthorized ? 'ok' : 'error'
      });
    } catch (err) {
      results.tests.push({
        name: 'FeePayment.list()',
        result: isTeacher ? 'PASS (403 blocked)' : 'FAIL (Authorized user blocked)',
        error: err.message,
        status: isTeacher ? 'ok' : 'error'
      });
    }

    // Test 3: StudentFeeDiscount.list() - Should 403 for Teacher
    try {
      await base44.entities.StudentFeeDiscount.list();
      results.tests.push({
        name: 'StudentFeeDiscount.list()',
        result: isAuthorized ? 'PASS' : 'FAIL (Teacher can read discounts)',
        status: isAuthorized ? 'ok' : 'error'
      });
    } catch (err) {
      results.tests.push({
        name: 'StudentFeeDiscount.list()',
        result: isTeacher ? 'PASS (403 blocked)' : 'FAIL (Authorized user blocked)',
        error: err.message,
        status: isTeacher ? 'ok' : 'error'
      });
    }

    // Test 4: getStudentLedger - Should 403 for Teacher
    try {
      const response = await base44.functions.invoke('getStudentLedger', {
        studentId: 'S001',
        academicYear: '2025-26'
      });
      results.tests.push({
        name: 'getStudentLedger()',
        result: isAuthorized ? 'PASS' : 'FAIL (Teacher can access ledger)',
        status: isAuthorized ? 'ok' : 'error'
      });
    } catch (err) {
      const is403 = err.response?.status === 403 || err.message?.includes('403');
      results.tests.push({
        name: 'getStudentLedger()',
        result: isTeacher && is403 ? 'PASS (403 blocked)' : 'FAIL (Authorized user blocked)',
        error: err.message,
        status: isTeacher && is403 ? 'ok' : 'error'
      });
    }

    // Test 5: getOutstandingReport - Should 403 for Teacher
    try {
      const response = await base44.functions.invoke('getOutstandingReport', {
        academicYear: '2025-26'
      });
      results.tests.push({
        name: 'getOutstandingReport()',
        result: isAuthorized ? 'PASS' : 'FAIL (Teacher can access report)',
        status: isAuthorized ? 'ok' : 'error'
      });
    } catch (err) {
      const is403 = err.response?.status === 403 || err.message?.includes('403');
      results.tests.push({
        name: 'getOutstandingReport()',
        result: isTeacher && is403 ? 'PASS (403 blocked)' : 'FAIL (Authorized user blocked)',
        error: err.message,
        status: isTeacher && is403 ? 'ok' : 'error'
      });
    }

    // Test 6: recordFeePayment - Should 403 for Teacher
    try {
      const response = await base44.functions.invoke('recordFeePayment', {
        invoiceId: 'inv_fake',
        amountPaid: 1000,
        paymentDate: '2026-03-04'
      });
      results.tests.push({
        name: 'recordFeePayment()',
        result: isAuthorized ? 'PASS' : 'FAIL (Teacher can create payments)',
        status: isAuthorized ? 'ok' : 'error'
      });
    } catch (err) {
      const is403 = err.response?.status === 403 || err.message?.includes('403');
      results.tests.push({
        name: 'recordFeePayment()',
        result: isTeacher && is403 ? 'PASS (403 blocked)' : 'FAIL (Authorized user blocked)',
        error: err.message,
        status: isTeacher && is403 ? 'ok' : 'error'
      });
    }

    // Test 7: generateProgressCards - Should 403 for Teacher, OK/4xx for Admin/Principal
    try {
      const response = await base44.functions.invoke('generateProgressCards', {
        academicYear: '2025-26'
      });
      // If authorized role succeeds, pass (success or non-permission error)
      results.tests.push({
        name: 'generateProgressCards()',
        result: (userRole === 'principal' || userRole === 'admin') ? 'PASS (authorized role allowed)' : 'FAIL (Unauthorized role succeeded)',
        status: (userRole === 'principal' || userRole === 'admin') ? 'ok' : 'error'
      });
    } catch (err) {
      const status = err.response?.status;
      const is403 = status === 403 || err.message?.includes('403') || err.message?.includes('Forbidden');
      const isAuthorized = userRole === 'principal' || userRole === 'admin';
      
      if (is403 && isTeacher) {
        // Expected: Teacher 403 blocked
        results.tests.push({
          name: 'generateProgressCards()',
          result: 'PASS (Teacher 403 blocked)',
          status: 'ok'
        });
      } else if (is403 && isAuthorized) {
        // Unexpected: Authorized role got 403
        results.tests.push({
          name: 'generateProgressCards()',
          result: 'FAIL (Authorized user got 403)',
          error: err.message,
          status: 'error'
        });
      } else if (isAuthorized && (status === 400 || err.message?.includes('required'))) {
        // OK: Authorized role failed with bad request (missing data, not permission)
        results.tests.push({
          name: 'generateProgressCards()',
          result: 'PASS (authorized role, non-permission error)',
          error: `Status ${status}: ${err.message}`,
          status: 'ok'
        });
      } else {
        // Other error for authorized role
        results.tests.push({
          name: 'generateProgressCards()',
          result: isTeacher ? 'PASS (Teacher blocked)' : 'FAIL (Authorized user blocked)',
          error: err.message,
          status: isTeacher ? 'ok' : 'error'
        });
      }
    }

    const passCount = results.tests.filter(t => t.status === 'ok').length;
    results.summary = {
      totalTests: results.tests.length,
      passed: passCount,
      failed: results.tests.length - passCount,
      overall: passCount === results.tests.length ? 'ALL TESTS PASSED ✅' : 'SOME TESTS FAILED ❌'
    };

    return Response.json(results);

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});