/**
 * MINIMAL FIX: Correct SectionConfig misspelling
 * Update NURSARY → Nursery for 2025-26
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.role || (user.role !== 'admin' && user.role !== 'principal')) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const academicYear = '2025-26';

    // Find all NURSARY records for this academic year
    const misspelledRecords = await base44.asServiceRole.entities.SectionConfig.filter({
      academic_year: academicYear,
      class_name: 'NURSARY'
    });

    if (misspelledRecords.length === 0) {
      return Response.json({
        status: 'NO_CHANGES',
        message: 'No misspelled NURSARY records found',
        academicYear,
        recordsChecked: 0,
        recordsUpdated: 0
      });
    }

    // Update each record
    const updates = [];
    for (const record of misspelledRecords) {
      await base44.asServiceRole.entities.SectionConfig.update(record.id, {
        class_name: 'Nursery'
      });

      updates.push({
        record_id: record.id,
        old_value: 'NURSARY',
        new_value: 'Nursery',
        section: record.section,
        is_active: record.is_active,
        class_display_order: record.class_display_order,
        section_display_order: record.section_display_order
      });
    }

    return Response.json({
      status: 'SUCCESS',
      message: `Fixed ${misspelledRecords.length} misspelled SectionConfig record(s)`,
      academicYear,
      recordsUpdated: updates.length,
      updates,
      next_step: 'Refresh the Timetable form. Subject dropdown for Nursery should now load correctly.'
    });

  } catch (error) {
    return Response.json({
      status: 'ERROR',
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});