import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Debug function: Query ClassSubjectConfig from DB for 2025-26 and class_name="7"
 * Show the exact record (or lack thereof) in the database.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || (user.role?.toLowerCase() !== 'admin' && user.role?.toLowerCase() !== 'principal')) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const academicYear = '2025-26';
    const className = '7';

    console.log(`[DB_DEBUG] Querying ClassSubjectConfig for ${academicYear} / ${className}`);

    // Query the database
    const records = await base44.asServiceRole.entities.ClassSubjectConfig.filter({
      academic_year: academicYear,
      class_name: className
    });

    if (records.length === 0) {
      return Response.json({
        status: 'NOT_FOUND',
        academicYear,
        className,
        message: `No ClassSubjectConfig record exists for ${academicYear}/${className}`
      });
    }

    const record = records[0];
    return Response.json({
      status: 'FOUND',
      academicYear: record.academic_year,
      className: record.class_name,
      subjectsCount: record.subject_names?.length || 0,
      subjects: record.subject_names || [],
      recordId: record.id,
      createdDate: record.created_date,
      updatedDate: record.updated_date,
      message: `✓ DB record exists: ${record.subject_names?.length || 0} subjects configured`
    });

  } catch (error) {
    console.error('[DB_DEBUG] Error:', error);
    return Response.json({
      status: 'ERROR',
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});