import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  return Response.json({
    error: 'DEPRECATED_USE_AUTHORITATIVE',
    message: 'This function is deprecated. Use generateStudentIdAuthoritative instead.',
    code: 'FUNCTION_DEPRECATED'
  }, { status: 410 });
});