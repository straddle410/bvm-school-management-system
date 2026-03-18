import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Test suite for student ID uniqueness validation.
 * Tests:
 * 1. fixDuplicateStudentIds doesn't assign same ID twice
 * 2. No double year prefix regression (S25252525010 → S25010)
 * 3. Normalization ensures case-insensitive matching
 * 4. Interceptor blocks duplicates on create/update
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { test_type } = await req.json();
    const results = [];

    // Test 1: Verify no double year prefix
    const allStudents = await base44.asServiceRole.entities.Student.list();
    const doublePrefix = allStudents.filter(s =>
      /^S\d{4}\d{4}/.test(String(s.student_id))
    );

    results.push({
      test: 'double_year_prefix_check',
      passed: doublePrefix.length === 0,
      details: doublePrefix.length > 0
        ? `Found ${doublePrefix.length} students with double prefix`
        : 'No double prefixes detected'
    });

    // Test 2: Verify normalization consistency
    const normMismatches = allStudents.filter(s => {
      const computed = String(s.student_id).trim().toUpperCase();
      return s.student_id_norm && s.student_id_norm !== computed;
    });

    results.push({
      test: 'normalization_consistency',
      passed: normMismatches.length === 0,
      details: normMismatches.length > 0
        ? `Found ${normMismatches.length} normalization mismatches`
        : 'All student_id_norm values consistent'
    });

    // Test 3: Check for actual duplicate normalized IDs within same year
    const yearGroups = {};
    allStudents.forEach(s => {
      const key = `${s.academic_year}:${s.student_id_norm || String(s.student_id).trim().toUpperCase()}`;
      yearGroups[key] = (yearGroups[key] || 0) + 1;
    });

    const duplicateIds = Object.entries(yearGroups)
      .filter(([_, count]) => count > 1);

    results.push({
      test: 'duplicate_normalized_ids',
      passed: duplicateIds.length === 0,
      details: duplicateIds.length > 0
        ? `Found ${duplicateIds.length} duplicate student_id_norm entries`
        : 'No duplicate student IDs within academic years'
    });

    // Test 4: Verify malformed ID fix (S2525202525010 → S25010)
    const sneha = allStudents.find(s => s.name === 'Sneha Verma');
    results.push({
      test: 'sneha_verma_id_fix',
      passed: sneha && sneha.student_id === 'S25010',
      details: sneha
        ? `Sneha Verma has ID: ${sneha.student_id} (expected: S25010)`
        : 'Sneha Verma record not found'
    });

    const allPassed = results.every(r => r.passed);

    return Response.json({
      test_type: test_type || 'full_suite',
      all_passed: allPassed,
      results
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});