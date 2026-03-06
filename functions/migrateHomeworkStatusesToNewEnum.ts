import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * One-time migration function to convert old HomeworkSubmission status strings to new enum values.
 * Old values: "Submitted", "Graded"
 * New values: "SUBMITTED", "GRADED", "REVISION_REQUIRED", "RESUBMITTED"
 * 
 * Safe to run multiple times - idempotent.
 * Only admin can run this.
 * 
 * Usage: POST /submitHomework with admin role
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Admin only
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fetch all HomeworkSubmission records
    const allSubmissions = await base44.asServiceRole.entities.HomeworkSubmission.list('-created_date', 10000);

    const statusMap = {
      'Submitted': 'SUBMITTED',
      'submitted': 'SUBMITTED',
      'Graded': 'GRADED',
      'graded': 'GRADED',
      'SUBMITTED': 'SUBMITTED',
      'GRADED': 'GRADED',
      'REVISION_REQUIRED': 'REVISION_REQUIRED',
      'RESUBMITTED': 'RESUBMITTED',
    };

    let updated = 0;
    let skipped = 0;
    const errors = [];

    for (const sub of allSubmissions) {
      const normalized = statusMap[sub.status];
      
      if (!normalized) {
        errors.push(`Unknown status "${sub.status}" for submission ${sub.id}`);
        skipped++;
        continue;
      }

      if (sub.status === normalized) {
        // Already migrated
        skipped++;
        continue;
      }

      try {
        await base44.asServiceRole.entities.HomeworkSubmission.update(sub.id, { status: normalized });
        updated++;
      } catch (err) {
        errors.push(`Failed to update ${sub.id}: ${err.message}`);
      }
    }

    return Response.json({
      success: true,
      message: `Migration complete: ${updated} updated, ${skipped} already correct`,
      updated,
      skipped,
      totalProcessed: allSubmissions.length,
      errors: errors.length > 0 ? errors : null
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});