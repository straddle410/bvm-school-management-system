import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Test calling calculateAttendanceSummary directly
    const result = await base44.asServiceRole.functions.invoke('calculateAttendanceSummary', {
      student_id: 'STU111',
      class_name: '9',
      section: 'A',
      start_date: '2025-12-15',
      end_date: '2026-02-28'
    });

    return Response.json({
      test_result: result,
      result_type: typeof result,
      result_keys: Object.keys(result),
      has_data: !!result?.data,
      data_type: typeof result?.data,
      data_keys: result?.data ? Object.keys(result?.data) : null
    });
  } catch (error) {
    return Response.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});