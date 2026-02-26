import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // ADMIN-ONLY: Verify caller is admin
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    // Fetch current academic year
    const profiles = await base44.asServiceRole.entities.SchoolProfile.list();
    const currentAcademicYear = profiles.length > 0 ? profiles[0].academic_year : null;
    
    if (!currentAcademicYear) {
      return Response.json({ 
        error: 'No academic year configured',
        deleted: 0 
      }, { status: 400 });
    }

    // Calculate cutoff date: 90 days ago
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);
    const cutoffISO = cutoffDate.toISOString();

    console.log(`[Cleanup] Current academic year: ${currentAcademicYear}`);
    console.log(`[Cleanup] Cutoff date: ${cutoffISO} (90 days ago)`);

    // SAFETY FILTER: Fetch candidates (read + old + not current year)
    const allNotifications = await base44.asServiceRole.entities.Notification.list();
    
    const candidates = allNotifications.filter(n => {
      // Must be read
      if (!n.is_read) return false;
      
      // Must be from a different academic year (protect current year)
      if (n.academic_year === currentAcademicYear) return false;
      
      // Must be older than 90 days
      const createdDate = new Date(n.created_date);
      if (createdDate >= cutoffDate) return false;
      
      return true;
    });

    const candidateCount = candidates.length;
    console.log(`[Cleanup] Found ${candidateCount} candidates for deletion`);

    // SAFETY GUARD: Abort if count exceeds threshold
    const SAFETY_THRESHOLD = 1000;
    if (candidateCount > SAFETY_THRESHOLD) {
      console.error(`[Cleanup] ABORT: Deletion count (${candidateCount}) exceeds safety threshold (${SAFETY_THRESHOLD})`);
      return Response.json({
        success: false,
        error: 'Safety threshold exceeded',
        candidateCount,
        threshold: SAFETY_THRESHOLD,
        message: `Found ${candidateCount} notifications to delete, but safety limit is ${SAFETY_THRESHOLD}. Manual review required.`,
        deleted: 0
      }, { status: 200 });
    }

    // If no candidates, return early
    if (candidateCount === 0) {
      console.log('[Cleanup] No notifications to delete');
      return Response.json({
        success: true,
        deleted: 0,
        message: 'No old read notifications found'
      });
    }

    // DELETE: Remove candidates
    let deleted = 0;
    const errors = [];

    for (const notif of candidates) {
      try {
        await base44.asServiceRole.entities.Notification.delete(notif.id);
        deleted++;
      } catch (err) {
        errors.push({ id: notif.id, error: err.message });
      }
    }

    console.log(`[Cleanup] Deleted ${deleted} notifications`);
    if (errors.length > 0) {
      console.error(`[Cleanup] Errors during deletion:`, errors);
    }

    // Return summary
    return Response.json({
      success: true,
      deleted,
      candidateCount,
      cutoffDate: cutoffISO,
      currentAcademicYear,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully deleted ${deleted} old read notifications`
    });

  } catch (error) {
    console.error('[Cleanup] Unexpected error:', error);
    return Response.json({ 
      error: error.message,
      deleted: 0 
    }, { status: 500 });
  }
});