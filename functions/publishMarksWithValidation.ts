import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const ALLOWED_ROLES = ['admin', 'principal'];

Deno.serve(async (req) => {
  try {
    console.log('[publishMarksWithValidation] Function invoked');
    const base44 = createClientFromRequest(req);
    const { marksIds, examType, className, section, academicYear, staffInfo } = await req.json();
    if (!staffInfo || !staffInfo.staff_id) {
      return Response.json({ error: 'Unauthorized: Missing staff info' }, { status: 401 });
    }
    const user = staffInfo;
    const role = String(staffInfo.role || '').trim().toLowerCase();
    if (!ALLOWED_ROLES.includes(role)) {
      return Response.json({ error: 'Forbidden: admin or principal only' }, { status: 403 });
    }

    console.log('[publishMarksWithValidation] Received payload:');
    console.log('[publishMarksWithValidation] marksIds.length:', marksIds?.length);
    console.log('[publishMarksWithValidation] marksIds[0-4]:', marksIds?.slice(0, 5));
    console.log('[publishMarksWithValidation] examType:', examType, 'type:', typeof examType);
    console.log('[publishMarksWithValidation] className:', className);
    console.log('[publishMarksWithValidation] section:', section);
    console.log('[publishMarksWithValidation] academicYear:', academicYear);

    if (!marksIds || !Array.isArray(marksIds) || marksIds.length === 0) {
      console.log('[publishMarksWithValidation] ERROR 400: marksIds invalid or empty');
      console.log('[publishMarksWithValidation] marksIds value:', marksIds);
      console.log('[publishMarksWithValidation] marksIds isArray:', Array.isArray(marksIds));
      return Response.json({ error: 'marksIds array required' }, { status: 400 });
    }
    if (!examType || !className || !academicYear) {
      console.log('[publishMarksWithValidation] ERROR 400: missing required fields');
      console.log('[publishMarksWithValidation] examType:', examType);
      console.log('[publishMarksWithValidation] className:', className);
      console.log('[publishMarksWithValidation] academicYear:', academicYear);
      return Response.json({ error: 'Required: examType, className, academicYear' }, { status: 400 });
    }

    // Fetch only the specific marks by ID (bypass filter since exam_type is ID, not name)
    console.log('[publishMarksWithValidation] Fetching marks by ID...');
    const marksToPublish = await Promise.all(
      marksIds.map(id => {
        console.log('[publishMarksWithValidation] Fetching ID:', id);
        return base44.asServiceRole.entities.Marks.get(id);
      })
    ).then(results => {
      console.log('[publishMarksWithValidation] Fetch results count:', results.length);
      console.log('[publishMarksWithValidation] First result sample:', results[0]);
      return results.filter(m => m !== null);
    });

    console.log('[publishMarksWithValidation] marksToPublish.length:', marksToPublish.length);
    if (marksToPublish.length > 0) {
      console.log('[publishMarksWithValidation] First mark record:');
      console.log('  id:', marksToPublish[0].id);
      console.log('  exam_type:', marksToPublish[0].exam_type);
      console.log('  class_name:', marksToPublish[0].class_name);
      console.log('  section:', marksToPublish[0].section);
      console.log('  academic_year:', marksToPublish[0].academic_year);
      console.log('  status:', marksToPublish[0].status);
    }

    if (marksToPublish.length === 0) {
      console.log('[publishMarksWithValidation] ERROR: No marks found after fetch');
      return Response.json({ error: 'No marks found matching the provided IDs' }, { status: 404 });
    }

    // VALIDATION: Only Submitted marks can be published
    const notPublishable = marksToPublish.filter(m =>
      m.status !== 'Submitted'
    );

    console.log('[publishMarksWithValidation] Status validation:');
    console.log('[publishMarksWithValidation] Total marks:', marksToPublish.length);
    console.log('[publishMarksWithValidation] Publishable status: Submitted only');
    console.log('[publishMarksWithValidation] Not publishable count:', notPublishable.length);
    if (notPublishable.length > 0) {
      console.log('[publishMarksWithValidation] First unpublishable mark:', notPublishable[0]);
      console.log('[publishMarksWithValidation] Status check failed: Status is', notPublishable[0].status);
      const errorMsg = `Cannot publish. ${notPublishable.length} mark(s) are in status "${notPublishable[0].status}" — only Submitted marks can be published.`;
      console.log('[publishMarksWithValidation] ERROR: 400 -', errorMsg);
      return Response.json({
        error: errorMsg,
        invalid_marks: notPublishable.map(m => ({
          id: m.id,
          student: m.student_name,
          subject: m.subject,
          status: m.status
        }))
      }, { status: 400 });
    }

    const previousStatus = 'Submitted';

    // Audit log
    await base44.asServiceRole.entities.AuditLog.create({
      action: 'marks_published',
      module: 'Marks',
      date: new Date().toISOString().split('T')[0],
      performed_by: user.email,
      details: JSON.stringify({
        exam_type: examType,
        class_name: className,
        section: section || '',
        academic_year: academicYear,
        records_published: marksIds.length,
        status_transition: `${previousStatus} → Published`,
        marks_ids: marksIds,
        timestamp: new Date().toISOString(),
        published_by_email: user.email
      }),
      academic_year: academicYear
    });

    // Publish
    console.log('[publishMarksWithValidation] All validations passed. Publishing now...');
    const updateResults = await Promise.all(marksIds.map(id =>
      base44.asServiceRole.entities.Marks.update(id, {
        status: 'Published',
        verified_by: user.email,
        approved_by: user.email
      })
    ));
    console.log('[publishMarksWithValidation] Update completed for', updateResults.length, 'marks');

    const response = {
      success: true,
      message: `Published ${marksIds.length} marks for ${className}${section ? ' ' + section : ''} (${examType}, ${academicYear})`,
      records_published: marksIds.length,
      status_transition: `${previousStatus} → Published`,
      published_by: user.email,
      timestamp: new Date().toISOString()
    };
    console.log('[publishMarksWithValidation] SUCCESS: Marks published');
    return Response.json(response);
    } catch (error) {
    console.error('[publishMarksWithValidation] CATCH block error:', error.message);
    console.error('[publishMarksWithValidation] Error stack:', error.stack);
    return Response.json({ error: error.message || 'Failed to publish marks' }, { status: 500 });
    }
});

// Marks publish endpoint deployed